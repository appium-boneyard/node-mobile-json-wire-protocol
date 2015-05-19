import { MobileJsonWireProtocol } from '../..';

class FakeDriver extends MobileJsonWireProtocol {
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
