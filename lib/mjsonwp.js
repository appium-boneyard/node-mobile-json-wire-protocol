import _ from 'lodash';
import { getLogger } from 'appium-logger';
import { validators } from './validators';
import { errors, isErrorType, MJSONWPError } from './errors';
import { METHOD_MAP, NO_SESSION_ID_COMMANDS } from './routes';

const log = getLogger('MJSONWP');
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
  // we want to pass the url parameters to the commands in reverse order
  // since the command will sometimes want to ignore, say, the sessionId
  let urlParams = _.keys(reqParams).reverse();
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

  if (isErrorType(err, errors.BadParametersError)) {
    httpStatus = 400;
    httpResBody = err.message;
  } else if (isErrorType(err, errors.NotYetImplementedError) ||
             isErrorType(err, errors.NotImplementedError)) {
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
        buildHandler(app, method, path, spec, driver, isSessCmd);
      }
    }
  };
}

function buildHandler (app, method, path, spec, driver, isSessCmd) {
  app[method.toLowerCase()](path, async (req, res) => {
    let jsonObj = req.body; // TODO is this already an object?
    let httpResBody = {};
    let httpStatus = 200;
    let newSessionId;
    try {
      // if the driver is currently proxying commands to another JSONWP
      // server, bypass all our checks and assume the upstream server knows
      // what it's doing. But keep this in the try/catch block so if proxying
      // itself fails, we give a message to the client
      if (driverShouldDoJwpProxy(driver, req)) {
        await doJwpProxy(driver, req, res);
        return;
      }

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
      log.info(`Calling ${driver.constructor.name}.${spec.command}() with args: ` +
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
      if (!(isErrorType(err, MJSONWPError) ||
            isErrorType(err, errors.BadParametersError))) {
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

function driverShouldDoJwpProxy (driver, req) {
  // drivers need to explicitly say when the proxy is active
  if (!driver.jwpProxyActive) {
    return false;
  }

  // if a driver hasn't specified any paths to avoid, proxy everything
  if (!driver.jwpProxyAvoid) {
    return true;
  }

  if (!_.isArray(driver.jwpProxyAvoid)) {
    throw new Error("Proxy avoidance must be a list of pairs");
  }

  // validate avoidance schema, and say we shouldn't proxy if anything in the
  // avoid list matches our req
  for (let avoidSchema of driver.jwpProxyAvoid) {
    if (!_.isArray(avoidSchema) || avoidSchema.length !== 2) {
      throw new Error("Proxy avoidance must be a list of pairs");
    }
    let [avoidMethod, avoidPathRegex] = avoidSchema;
    if (!_.contains(['GET', 'POST', 'DELETE'], avoidMethod)) {
      throw new Error(`Unrecognized proxy avoidance method '${avoidMethod}'`);
    }
    if (!(avoidPathRegex instanceof RegExp)) {
      throw new Error("Proxy avoidance path must be a regular expression");
    }
    let normalizedUrl = req.originalUrl.replace(/^\/wd\/hub/, '');
    if (avoidMethod === req.method && avoidPathRegex.test(normalizedUrl)) {
      return false;
    }
  }

  return true;
}

async function doJwpProxy (driver, req, res) {
  log.info("Driver proxy active, passing request on via HTTP proxy");
  if (typeof driver.proxyReqRes !== "function") {
    throw new Error("Trying to proxy to a JSONWP server but proxyReqRes is " +
                    "not defined");
  }
  try {
    await driver.proxyReqRes(req, res);
  } catch (e) {
    throw new Error(`Could not proxy. Proxy error: ${e.message}`);
  }
}

export { MJSONWP, routeConfiguringFunction, isSessionCommand };
