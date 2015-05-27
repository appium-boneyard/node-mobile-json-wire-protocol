import _ from 'lodash';
import log from 'appium-logger';
import { validators } from './validators';
import { errors, MJSONWPError } from './errors';
import { METHOD_MAP, NO_SESSION_ID_COMMANDS } from './routes';

const JSONWP_SUCCESS_STATUS_CODE = 0;
const LOG_OBJ_LENGTH = 150;

class MJSONWP {}

function isSessionCommand (command) {
  return !_.contains(NO_SESSION_ID_COMMANDS, command);
}

function checkParams (paramSets, jsonObj) {
  let receivedParams = _.keys(jsonObj);
  let wrongParams = false;
  let requiredParams = []
    , optionalParams = [];
  if (paramSets) {
    if (paramSets.required) {
      // we might have an array of parameters,
      // or an array of arrays of parameters, so standardize
      if (!_.isArray(_.first(paramSets.required))) {
        requiredParams = [paramSets.required];
      } else {
        requiredParams = paramSets.required;
      }
    }
    // optional parameters are just an array
    if (paramSets.optional) {
      optionalParams = paramSets.optional;
    }
  }
  for (let params of requiredParams) {
    if (_.difference(receivedParams, params, optionalParams).length === 0 &&
        _.difference(params, receivedParams).length === 0) {
      // we have a set of parameters that is correct
      // so short-circuit
      return;
    } else {
      wrongParams = true;
    }
  }
  if (wrongParams) {
    throw new errors.BadParametersError(paramSets, receivedParams);
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
  let args = _.flatten(payloadParams.required).map(p => jsonObj[p]);
  if (payloadParams.optional) {
    args = args.concat(_.flatten(payloadParams.optional).map(p => jsonObj[p]));
  }
  args = args.concat(urlParams.map(u => reqParams[u]));
  return args;
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
        let isSessCmd = isSessionCommand(spec.command);

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
            log.info(`Calling driver.${spec.command}() with args: ` +
                      _.trunc(JSON.stringify(args), LOG_OBJ_LENGTH));
            driverRes = await driver.execute(spec.command, ...args);

            if (spec.command === 'createSession') {
              newSessionId = driverRes[0];
              driverRes = driverRes[1];
            }

            // convert undefined to null, but leave all other values the same
            if (_.isUndefined(driverRes)) {
              driverRes = null;
            }

            // TODO delete should not return anything even if successful

            // assuming everything worked, set up the json response object
            httpResBody.status = JSONWP_SUCCESS_STATUS_CODE;
            httpResBody.value = driverRes;
            log.info(`Responding to client with driver.${spec.command}() ` +
                     `result: ${_.trunc(JSON.stringify(driverRes), LOG_OBJ_LENGTH)}`);
          } catch (err) {
            let actualErr = err;
            if (!(err instanceof MJSONWPError ||
                  err instanceof errors.BadParametersError)) {
              log.error("Encountered internal error running command: " +
                        err.stack);
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

export { MJSONWP, routeConfiguringFunction, isSessionCommand };
