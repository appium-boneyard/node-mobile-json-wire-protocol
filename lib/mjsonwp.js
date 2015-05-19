import _ from 'lodash';
import { validators } from './validators';
import { NotYetImplementedError, BadParametersError } from './errors';
import { METHOD_MAP } from './routes';

class MJSONWP {}

function buildValidatedCommand (command) {
  return async function (...args) {
    if (validators[command]) {
      validators[command](...args);
    }
    if (this[command]) {
      return this[command](...args);
    } else {
      throw new NotYetImplementedError();
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
    throw new BadParametersError(params, _.keys(jsonObj));
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

function getExpressRouter (driver) {
  return function (app) {
    for (let [path, methods] of _.pairs(METHOD_MAP)) {
      for (let [method, spec] of _.pairs(methods)) {
        app[method.toLowerCase()](path, async (req, res) => {
          let jsonObj = req.body; // TODO is this already an object?
          let jsonwpRes = {};
          let httpStatus = 200;
          try {
            checkParams(spec.payloadParams, jsonObj);
            let args = makeArgs(req.params, jsonObj, spec.payloadParams || []);
            let driverRes = await driver[`validated_${spec.command}`](...args);
            jsonwpRes.status = 0; // TODO use status library
            jsonwpRes.value = driverRes;
          } catch (err) {
            httpStatus = 500;
            jsonwpRes.status = err.jsonwpCode;
            jsonwpRes.value = err.message;
          }
          res.status(httpStatus).send(jsonwpRes); // TODO convert to string?
        });
      }
    }
  };
}

export { MJSONWP, getExpressRouter };
