import { MobileJsonWireProtocol } from '../..';

class FakeDriver extends MobileJsonWireProtocol {

  constructor () {
    super();
    this.sessionId = null;
  }

  sessionExists (sessionId) {
    if (!sessionId) return false;
    return sessionId === this.sessionId;
  }

  async createSession (caps) {
    this.sessionId = "1234";
    return [this.sessionId, caps];
  }

  async deleteSession () {
    this.sessionId = null;
  }

  async getStatus () {
    return "I'm fine";
  }

  async setUrl (url) {
    return `Navigated to: ${url}`;
  }

  async getUrl () {
    return "http://foobar.com";
  }

  async back (sessionId) {
    return sessionId;
  }

  async forward () {}

  async refresh () {
    throw new Error('Too Fresh!');
  }

  async click (elementId, sessionId) {
    return [elementId, sessionId];
  }

}

export { FakeDriver };
