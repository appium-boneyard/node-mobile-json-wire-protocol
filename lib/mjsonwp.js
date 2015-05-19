import _ from 'lodash';
import { validators } from './validators';
import { errors } from './errors';
import { METHOD_MAP, NO_SESSION_ID_COMMANDS } from './routes';

const JSONWP_SUCCESS_STATUS_CODE = 0;

class MJSONWP {}

function buildValidatedCommand (command) {
  return async function (...args) {
    if (validators[command]) {
      validators[command](...args);
    }
    if (this[command]) {
      return this[command](...args);
    } else {
      throw new errors.NotYetImplementedError();
    }
  };
}

(function annotateDriverWithValidation () {
  for (let [, methods] of _.pairs(METHOD_MAP)) {
    for (let [, spec] of _.pairs(methods)) {
      MJSONWP.prototype[`validated_${spec.command}`] = buildValidatedCommand(spec.command);
    }
  }
})();

function checkParams (params, jsonObj) {
  let sentParams = _.keys(jsonObj);
  let notPresentParams = _.difference(sentParams, params);
  let tooPresentParams = _.difference(params, sentParams);
  if (notPresentParams.length || tooPresentParams.length) {
    throw new errors.BadParametersError(params, _.keys(jsonObj));
  }
}

function makeArgs (reqParams, jsonObj, payloadParams) {
  // get a list of url parameters in order, but make sure sessionId is always
  // last, so we filter it out and then add it back if it exists
  let urlParams = _.keys(reqParams)
                    .filter(p => p !== 'sessionId');
  if (reqParams.sessionId) {
    urlParams.push('sessionId');
  }
  return payloadParams.map(p => jsonObj[p])
          .concat(urlParams.map(u => reqParams[u]));
}

function routeConfiguringFunction (driver) {
  if (!driver.sessionExists) {
    throw new Error("Drivers used with MJSONWP must implement `sessionExists`");
  }

  return function (app) {
    for (let [path, methods] of _.pairs(METHOD_MAP)) {
      for (let [method, spec] of _.pairs(methods)) {
        let isSessCmd = !_.contains(NO_SESSION_ID_COMMANDS, spec.command);
        app[method.toLowerCase()](path, async (req, res) => {
          let jsonObj = req.body; // TODO is this already an object?
          let httpResBody = {};
          let httpStatus = 200;
          try {
            checkParams(spec.payloadParams, jsonObj);
            if (isSessCmd && !driver.sessionExists(req.params.sessionId)) {
              throw new errors.NoSuchDriverError();
            }
            let args = makeArgs(req.params, jsonObj, spec.payloadParams || []);
            let driverRes = await driver[`validated_${spec.command}`](...args);
            httpResBody.status = JSONWP_SUCCESS_STATUS_CODE;
            httpResBody.value = driverRes;
            if (isSessCmd) {
              httpResBody.sessionId = req.params.sessionId;
            }
          } catch (err) {
            if (err instanceof errors.BadParametersError) {
              httpStatus = 400;
              httpResBody = err.message;
            } else {
              httpStatus = 500;
              httpResBody.status = err.jsonwpCode;
              httpResBody.value = err.message;
            }
          }
          res.status(httpStatus).send(httpResBody); // TODO convert to string?
        });
      }
    }
  };
}

export { MJSONWP, routeConfiguringFunction };
