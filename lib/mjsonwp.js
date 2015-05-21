import _ from 'lodash';
import { validators } from './validators';
import { errors, MJSONWPError } from './errors';
import { METHOD_MAP, NO_SESSION_ID_COMMANDS } from './routes';

const JSONWP_SUCCESS_STATUS_CODE = 0;

class MJSONWP {}

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

function getResponseForJsonwpError (err) {
  let httpStatus = 500;
  let httpResBody = {
    status: err.jsonwpCode,
    value: {
      message: err.message
    }
  };

  if (err instanceof errors.BadParametersError) {
    httpStatus = 400;
    httpResBody = err.message;
  } else if (err instanceof errors.NotImplementedError ||
             err instanceof errors.NotYetImplementedError) {
    httpStatus = 501;
    httpResBody = err.message;
  }
  return [httpStatus, httpResBody];
}

function routeConfiguringFunction (driver) {
  if (!driver.sessionExists) {
    throw new Error("Drivers used with MJSONWP must implement `sessionExists`");
  }

  if (!driver.execute) {
    throw new Error("Drivers used with MJSONWP must implement `execute`");
  }

  return function (app) {
    for (let [path, methods] of _.pairs(METHOD_MAP)) {
      for (let [method, spec] of _.pairs(methods)) {
        let isSessCmd = !_.contains(NO_SESSION_ID_COMMANDS, spec.command);

        // set up the express route handler
        app[method.toLowerCase()](path, async (req, res) => {
          let jsonObj = req.body; // TODO is this already an object?
          let httpResBody = {};
          let httpStatus = 200;
          let newSessionId;
          try {
            // if a command is not in our method map, it's because we
            // have no plans to ever implement it
            if (!spec.command) {
              throw new errors.NotImplementedError();
            }

            // ensure that the json payload conforms to the spec
            checkParams(spec.payloadParams, jsonObj);

            // ensure the session the user is trying to use is valid
            if (isSessCmd && !driver.sessionExists(req.params.sessionId)) {
              throw new errors.NoSuchDriverError();
            }

            // turn the command and json payload into an argument list for
            // the driver methods
            let args = makeArgs(req.params, jsonObj, spec.payloadParams || []);
            let driverRes;

            // validate command args according to MJSONWP
            if (validators[spec.command]) {
              validators[spec.command](...args);
            }

            // run the driver command wrapped inside the argument validators
            driverRes = await driver.execute(spec.command, ...args);

            // assuming that worked, set up the json response object
            httpResBody.status = JSONWP_SUCCESS_STATUS_CODE;
            httpResBody.value = driverRes || null;

            if (spec.command === 'createSession') {
              newSessionId = driverRes[0];
              driverRes = driverRes[1];
            }

            httpResBody.status = JSONWP_SUCCESS_STATUS_CODE;
            httpResBody.value = driverRes || null;
          } catch (err) {
            let actualErr = err;
            if (!(err instanceof MJSONWPError ||
                  err instanceof errors.BadParametersError)) {
              actualErr = new errors.UnknownError(err);
            }
            // if anything goes wrong, figure out what our response should be
            // based on the type of error that we encountered
            [httpStatus, httpResBody] = getResponseForJsonwpError(actualErr);
          }

          if (typeof httpResBody === "string") {
            res.status(httpStatus).send(httpResBody);
          } else {
            if (newSessionId) {
              httpResBody.sessionId = newSessionId;
            } else {
              httpResBody.sessionId = req.params.sessionId || null;
            }
            res.status(httpStatus).json(httpResBody);
          }
        });
      }
    }
  };
}

export { MJSONWP, routeConfiguringFunction };
