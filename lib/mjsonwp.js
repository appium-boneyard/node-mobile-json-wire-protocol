import _ from 'lodash';
import { getLogger } from 'appium-logger';
import { validators } from './validators';
import { errors, isErrorType, MJSONWPError } from './errors';
import { METHOD_MAP, NO_SESSION_ID_COMMANDS } from './routes';
import B from 'bluebird';


const log = getLogger('MJSONWP');
const JSONWP_SUCCESS_STATUS_CODE = 0;
const LOG_OBJ_LENGTH = 150;

class MJSONWP {}

function isSessionCommand (command) {
  return !_.contains(NO_SESSION_ID_COMMANDS, command);
}

function wrapParams (paramSets, jsonObj) {
  /* There are commands like performTouch which take a single parameter (primitive type or array).
   * Some drivers choose to pass this parameter as a value (eg. [action1, action2...]) while others to
   * wrap it within an object(eg' {gesture:  [action1, action2...]}), which makes it hard to validate.
   * The wrap option in the spec enforce wrapping before validation, so that all params are wrapped at
   * the time they are validated and later passed to the commands.
   */
  let res = jsonObj;
  if (_.isArray(jsonObj) || !_.isObject(jsonObj)) {
    res = {};
    res[paramSets.wrap] = jsonObj;
  }
  return res;
}

function unwrapParams (paramSets, jsonObj) {
  /* There are commands like setNetworkConnection which send parameters wrapped inside a key such as
   * "parameters". This function unwraps them (eg. {"parameters": {"type": 1}} becomes {"type": 1}).
   */
  let res = jsonObj;
  if (_.isObject(jsonObj)) {
    res = jsonObj[paramSets.unwrap];
  }
  return res;
}

function checkParams (paramSets, jsonObj) {
  let requiredParams = [];
  let optionalParams = [];
  let receivedParams = _.keys(jsonObj);
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
      throw new errors.BadParametersError(paramSets, receivedParams);
    }
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
    // respond with a 400 if we have bad parameters
    log.debug(`Bad parameters: ${err}`);
    httpStatus = 400;
    httpResBody = err.message;
  } else if (isErrorType(err, errors.NotYetImplementedError) ||
             isErrorType(err, errors.NotImplementedError)) {
    // respond with a 501 if the method is not implemented
    httpStatus = 501;
  }


  return [httpStatus, httpResBody];
}

function routeConfiguringFunction (driver) {
  if (!driver.sessionExists) {
    throw new Error('Drivers used with MJSONWP must implement `sessionExists`');
  }

  if (!(driver.executeCommand || driver.execute)) {
    throw new Error('Drivers used with MJSONWP must implement `executeCommand` or `execute`');
  }

  // return a function which will add all the routes to the driver
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
  let asyncHandler = async (req, res) => {
    let jsonObj = req.body;
    let httpResBody = {};
    let httpStatus = 200;
    let newSessionId;
    try {
      // if the driver is currently proxying commands to another JSONWP
      // server, bypass all our checks and assume the upstream server knows
      // what it's doing. But keep this in the try/catch block so if proxying
      // itself fails, we give a message to the client. Of course we only
      // want to do these when we have a session command; the Appium driver
      // must be responsible for start/stop session, etc...
      if (isSessCmd && driverShouldDoJwpProxy(driver, req, spec.command)) {
        await doJwpProxy(driver, req, res);
        return;
      }

      // if a command is not in our method map, it's because we
      // have no plans to ever implement it
      if (!spec.command) {
        throw new errors.NotImplementedError();
      }

      // wrap params if necessary
      if (spec.payloadParams && spec.payloadParams.wrap) {
        jsonObj = wrapParams(spec.payloadParams, jsonObj);
      }

      // unwrap params if necessary
      if (spec.payloadParams && spec.payloadParams.unwrap) {
        jsonObj = unwrapParams(spec.payloadParams, jsonObj);
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

      if (driver.executeCommand) {
        driverRes = await driver.executeCommand(spec.command, ...args);
      } else {
        driverRes = await driver.execute(spec.command, ...args);
      }

      // unpack createSession response
      if (spec.command === 'createSession') {
        newSessionId = driverRes[0];
        driverRes = driverRes[1];
      }

      // convert undefined to null, but leave all other values the same
      if (_.isUndefined(driverRes)) {
        driverRes = null;
      }

      // delete should not return anything even if successful
      if (spec.command === 'deleteSession') {
        log.debug(`Received response: ${_.trunc(JSON.stringify(driverRes), LOG_OBJ_LENGTH)}`);
        log.debug('But deleting session, so not returning');
        driverRes = null;
      }

      // assuming everything worked, set up the json response object
      httpResBody.status = JSONWP_SUCCESS_STATUS_CODE;
      httpResBody.value = driverRes;
      log.info(`Responding to client with driver.${spec.command}() ` +
               `result: ${_.trunc(JSON.stringify(driverRes), LOG_OBJ_LENGTH)}`);
    } catch (err) {
      let actualErr = err;
      if (!(isErrorType(err, MJSONWPError) ||
            isErrorType(err, errors.BadParametersError))) {
        log.error(`Encountered internal error running command: ${err.stack}`);
        actualErr = new errors.UnknownError(err);
      }
      // if anything goes wrong, figure out what our response should be
      // based on the type of error that we encountered
      [httpStatus, httpResBody] = getResponseForJsonwpError(actualErr);
    }

    // decode the response, which is either a string or json
    if (_.isString(httpResBody)) {
      res.status(httpStatus).send(httpResBody);
    } else {
      if (newSessionId) {
        httpResBody.sessionId = newSessionId;
      } else {
        httpResBody.sessionId = req.params.sessionId || null;
      }

      res.status(httpStatus).json(httpResBody);
    }
  };
  // add the method to the app
  app[method.toLowerCase()](path, (req, res) => {
    B.resolve(asyncHandler(req, res)).done();
  });
}

function driverShouldDoJwpProxy (driver, req, command) {
  // get the actual driver
  driver = driver.driverForSession(req.params.sessionId);

  // drivers need to explicitly say when the proxy is active
  if (!driver.jwpProxyActive) {
    return false;
  }

  // we should never proxy deleteSession because we need to give the containing
  // driver an opportunity to clean itself up
  if (command === 'deleteSession') {
    return false;
  }

  // if a driver hasn't specified any paths to avoid, proxy everything
  if (!driver.jwpProxyAvoid) {
    return true;
  }

  if (!_.isArray(driver.jwpProxyAvoid)) {
    throw new Error('Proxy avoidance must be a list of pairs');
  }

  // validate avoidance schema, and say we shouldn't proxy if anything in the
  // avoid list matches our req
  for (let avoidSchema of driver.jwpProxyAvoid) {
    if (!_.isArray(avoidSchema) || avoidSchema.length !== 2) {
      throw new Error('Proxy avoidance must be a list of pairs');
    }
    let [avoidMethod, avoidPathRegex] = avoidSchema;
    if (!_.contains(['GET', 'POST', 'DELETE'], avoidMethod)) {
      throw new Error(`Unrecognized proxy avoidance method '${avoidMethod}'`);
    }
    if (!(avoidPathRegex instanceof RegExp)) {
      throw new Error('Proxy avoidance path must be a regular expression');
    }
    let normalizedUrl = req.originalUrl.replace(/^\/wd\/hub/, '');
    if (avoidMethod === req.method && avoidPathRegex.test(normalizedUrl)) {
      return false;
    }
  }

  return true;
}

async function doJwpProxy (driver, req, res) {
  log.info('Driver proxy active, passing request on via HTTP proxy');

  // get the actual driver
  driver = driver.driverForSession(req.params.sessionId);

  if (!_.isFunction(driver.proxyReqRes)) {
    throw new Error('Trying to proxy to a JSONWP server but proxyReqRes is ' +
                    'not defined');
  }
  try {
    await driver.proxyReqRes(req, res);
  } catch (err) {
    throw new Error(`Could not proxy. Proxy error: ${err.message}`);
  }
}

export { MJSONWP, routeConfiguringFunction, isSessionCommand };
