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

  async createSession () {
    this.sessionId = "1234";
  }

  async deleteSession () {
    this.sessionId = null;
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

  async click (elementId, sessionId) {
    return [elementId, sessionId];
  }
}

export { FakeDriver };
