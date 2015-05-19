import ES6Error from 'es6-error';

class MJSONWPError extends ES6Error {
  constructor (msg, jsonwpCode) {
    super(msg);
    this.jsonwpCode = jsonwpCode;
  }
}

class NoSuchDriverError extends MJSONWPError {
  constructor () {
    super('A session is either terminated or not started', 6);
  }
}

class NoSuchElementError extends MJSONWPError {
  constructor () {
    super('An element could not be located on the page using the given ' +
          'search parameters.', 7);
  }
}

class NoSuchFrameError extends MJSONWPError {
  constructor () {
    super('A request to switch to a frame could not be satisfied because ' +
          'the frame could not be found.', 8);
  }
}

class UnknownCommandError extends MJSONWPError {
  constructor () {
    super('The requested resource could not be found, or a request was ' +
          'received using an HTTP method that is not supported by the mapped ' +
          'resource.', 9);
  }
}

class StaleElementReferenceError extends MJSONWPError {
  constructor () {
    super('An element command failed because the referenced element is no ' +
          'longer attached to the DOM.', 10);
  }
}

class ElementNotVisibleError extends MJSONWPError {
  constructor () {
    super('An element command could not be completed because the element is ' +
          'not visible on the page.', 11);
  }
}

class InvalidElementStateError extends MJSONWPError {
  constructor () {
    super('An element command could not be completed because the element is ' +
          'in an invalid state (e.g. attempting to click a disabled element).'
          , 12);
  }
}

class UnknownError extends MJSONWPError {
  constructor () {
    super('An unknown server-side error occurred while processing the ' +
          'command.', 13);
  }
}

class ElementIsNotSelectableError extends MJSONWPError {
  constructor () {
    super('An attempt was made to select an element that cannot be selected.'
          , 15);
  }
}

class JavaScriptError extends MJSONWPError {
  constructor () {
    super('An error occurred while executing user supplied JavaScript.', 17);
  }
}

class XPathLookupError extends MJSONWPError {
  constructor () {
    super('An error occurred while searching for an element by XPath.', 19);
  }
}

class TimeoutError extends MJSONWPError {
  constructor () {
    super('An operation did not complete before its timeout expired.', 21);
  }
}

class NoSuchWindowError extends MJSONWPError {
  constructor () {
    super('A request to switch to a different window could not be satisfied ' +
          'because the window could not be found.', 23);
  }
}

class InvalidCookieDomainError extends MJSONWPError {
  constructor () {
    super('An illegal attempt was made to set a cookie under a different ' +
          'domain than the current page.', 24);
  }
}

class UnableToSetCookieError extends MJSONWPError {
  constructor () {
    super('A request to set a cookie\'s value could not be satisfied.', 25);
  }
}

class UnexpectedAlertOpenError extends MJSONWPError {
  constructor () {
    super('A modal dialog was open, blocking this operation', 26);
  }
}

class NoAlertOpenError extends MJSONWPError {
  constructor () {
    super('An attempt was made to operate on a modal dialog when one ' +
          'was not open.', 27);
  }
}

class ScriptTimeoutError extends MJSONWPError {
  constructor () {
    super('A script did not complete before its timeout expired.', 28);
  }
}

class InvalidElementCoordinatesError extends MJSONWPError {
  constructor () {
    super('The coordinates provided to an interactions operation are invalid.'
          , 29);
  }
}

class IMENotAvailableError extends MJSONWPError {
  constructor () {
    super('IME was not available.', 30);
  }
}

class IMEEngineActivationFailedError extends MJSONWPError {
  constructor () {
    super('An IME engine could not be started.', 31);
  }
}

class InvalidSelectorError extends MJSONWPError {
  constructor () {
    super('Argument was an invalid selector (e.g. XPath/CSS).', 32);
  }
}

class SessionNotCreatedError extends MJSONWPError {
  constructor () {
    super('A new session could not be created.', 33);
  }
}

class MoveTargetOutOfBoundsError extends MJSONWPError {
  constructor () {
    super('Target provided for a move action is out of bounds.', 34);
  }
}

class NoSuchContextError extends MJSONWPError {
  constructor () {
    super('No such context found.', 35);
  }
}

class NotYetImplementedError extends MJSONWPError {
  constructor () {
    super('Method has not yet been implemented', 13);
  }
}

class BadParametersError extends ES6Error {
  constructor (requiredParams, actualParams) {
    super(`Parameters were incorrect. We wanted ` +
          `${JSON.stringify(requiredParams)} and you ` +
          `sent ${JSON.stringify(actualParams)}`);
  }
}

const errors = {NotYetImplementedError,
                BadParametersError,
                NoSuchDriverError,
                NoSuchElementError,
                UnknownCommandError,
                StaleElementReferenceError,
                ElementNotVisibleError,
                InvalidElementStateError,
                UnknownError,
                ElementIsNotSelectableError,
                JavaScriptError,
                XPathLookupError,
                TimeoutError,
                NoSuchWindowError,
                InvalidCookieDomainError,
                UnableToSetCookieError,
                UnexpectedAlertOpenError,
                NoAlertOpenError,
                ScriptTimeoutError,
                InvalidElementCoordinatesError,
                IMENotAvailableError,
                IMEEngineActivationFailedError,
                InvalidSelectorError,
                SessionNotCreatedError,
                MoveTargetOutOfBoundsError,
                NoSuchContextError,
                NoSuchFrameError};

export { errors };
