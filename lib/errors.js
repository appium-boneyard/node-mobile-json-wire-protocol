import ES6Error from 'es6-error';

class NotYetImplementedError extends ES6Error {
  constructor () {
    super("That method has not yet been implemented");
    this.jsonwpCode = 15; // TODO use status package
  }
}

class BadParametersError extends ES6Error {
  constructor (requiredParams, actualParams) {
    super(`Parameters were incorrect. We wanted ` +
          `${JSON.stringify(requiredParams)} and you ` +
          `sent ${JSON.stringify(actualParams)}`);
    this.jsonwpCode = 5; // TODO use status library for bad command
  }
}

export { NotYetImplementedError, BadParametersError };
