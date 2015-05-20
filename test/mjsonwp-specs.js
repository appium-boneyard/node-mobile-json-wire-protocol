// transpile:mocha

import { routeConfiguringFunction } from '../..';
import { FakeDriver } from './fake-driver';
import { server } from 'appium-express';
import request from 'request-promise';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';

let should = chai.should();
chai.use(chaiAsPromised);

describe('MJSONWP', () => {

  //TODO: more tests!:
  // Unknown commands should return 404

  describe('direct to driver', () => {
    let d = new FakeDriver();

    it('should return response values directly from the driver', async () => {
      (await d.setUrl("http://google.com")).should.contain("google");
    });

    it('should validate params when using validated_', async () => {
      await d.validated_setUrl().should.eventually.be.rejectedWith(/url/i);
      await d.validated_setUrl("foo").should.eventually.be.rejectedWith(/url/i);
    });

    it('should not care if we dont have a validated_ fn', async () => {
      await d.validated_getUrl().should.eventually.equal("http://foobar.com");
    });

    it('unimplemented validated commands should throw NotImplemented errors', async () => {
      should.not.exist(d.getText);
      await d.validated_getText().should.eventually.be.rejectedWith('implemented');
    });

  });

  describe('via express router', () => {
    let driver = new FakeDriver();
    driver.sessionId = 'foo';
    let mjsonwpServer;

    before(async () => {
      mjsonwpServer = await server(routeConfiguringFunction(driver), 8181);
    });

    after(async () => {
      mjsonwpServer.close();
    });

    it('should proxy to driver and return valid jsonwp response', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/url',
        method: 'POST',
        json: {url: 'http://google.com'}
      });
      res.should.eql({
        status: 0,
        value: "Navigated to: http://google.com",
        sessionId: "foo"
      });
    });

    it('should respond to x-www-form-urlencoded as well as json requests', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/url',
        method: 'POST',
        form: {url: 'http://google.com'}
      });
      JSON.parse(res).should.eql({
        status: 0,
        value: "Navigated to: http://google.com",
        sessionId: "foo"
      });
    });

    it('should include url request parameters for methods to use - sessionid', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/back',
        method: 'POST',
        json: {}
      });
      res.should.eql({
        status: 0,
        value: "foo",
        sessionId: "foo"
      });
    });

    it('should include url request parameters for methods to use - elementid', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/element/bar/click',
        method: 'POST',
        json: {}
      });
      res.status.should.equal(0);
      res.value.should.eql(["bar", "foo"]);
    });

    it('should respond with 400 Bad Request if parameters missing', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/url',
        method: 'POST',
        json: {},
        resolveWithFullResponse: true,
        simple: false
      });

      res.statusCode.should.equal(400);
      res.body.should.contain("url");
    });

    it('should reject requests with a badly formatted body and not crash', async () => {
      await request({
        url: 'http://localhost:8181/wd/hub/session/foo/url',
        method: 'POST',
        json: "oh hello"
      }).should.eventually.be.rejected;

      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/url',
        method: 'POST',
        json: {url: 'http://google.com'}
      });
      res.should.eql({
        status: 0,
        value: "Navigated to: http://google.com",
        sessionId: "foo"
      });

    });

    it('should get 404 for bad routes', async () => {
      await request({
        url: 'http://localhost:8181/wd/hub/blargimarg',
        method: 'GET'
      }).should.eventually.be.rejectedWith("404");
    });

    // TODO pass this test
    // https://github.com/appium/node-mobile-json-wire-protocol/issues/3
    it.skip('4xx responses should have content-type of text/plain', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/blargimargarita',
        method: 'GET',
        resolveWithFullResponse: true,
        simple: false // 404 errors fulfill the promise, rather than rejecting
      });

      res.headers['content-type'].should.eql('text/plain');
    });

    it('should throw not yet implemented for unfilledout commands', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/element/bar/text',
        method: 'GET',
        json: true,
        resolveWithFullResponse: true,
        simple: false
      });

      res.statusCode.should.equal(501);
      res.body.should.contain("implemented");
    });

    it('should throw not implemented for ignored commands', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/buttonup',
        method: 'POST',
        json: {},
        resolveWithFullResponse: true,
        simple: false
      });

      res.statusCode.should.equal(501);
      res.body.should.contain("implemented");
    });

    it('should get 400 for bad parameters', async () => {
      await request({
        url: 'http://localhost:8181/wd/hub/session/foo/url',
        method: 'POST',
        json: {}
      }).should.eventually.be.rejectedWith("400");
    });

    it('should handle commands with no response values', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/forward',
        method: 'POST',
        json: true,
      });
      res.should.eql({
        status: 0,
        value: null,
        sessionId: "foo"
      });
    });

    it('should send 500 response and an error object for rejected commands', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/session/foo/refresh',
        method: 'POST',
        json: true,
        resolveWithFullResponse: true,
        simple: false
      });

      res.statusCode.should.equal(500);
      res.body.should.eql({
        status: 13,
        value: {
          message: 'An unknown server-side error occurred while processing ' +
                   'the command. Original error: Too Fresh!'
        },
        sessionId: "foo"
      });
    });
  });

  describe('session Ids', () => {
    let driver = new FakeDriver();
    let mjsonwpServer;

    before(async () => {
      mjsonwpServer = await server(routeConfiguringFunction(driver), 8181);
    });

    after(async () => {
      mjsonwpServer.close();
    });

    afterEach( () => {
      driver.sessionId = null;
    });

    it('returns null SessionId for commands without sessionIds', async () => {
      let res = await request({
        url: 'http://localhost:8181/wd/hub/status',
        method: 'GET',
        json: true,
      });

      should.equal(res.sessionId, null);
    });

    it('responds with the same session ID in the request', async () => {
      let sessionId = 'Vader Sessions';
      driver.sessionId = sessionId;

      let res = await request({
        url: `http://localhost:8181/wd/hub/session/${sessionId}/url`,
        method: 'POST',
        json: {url: 'http://google.com'}
      });

      should.exist(res.sessionId);
      res.sessionId.should.eql(sessionId);
    });

    it('yells if no session exists', async () => {
      let sessionId = 'Vader Sessions';

      let res = await request({
        url: `http://localhost:8181/wd/hub/session/${sessionId}/url`,
        method: 'POST',
        json: {url: 'http://google.com'},
        resolveWithFullResponse: true,
        simple: false
      });

      res.statusCode.should.equal(500);
      res.body.status.should.equal(6);
      res.body.value.message.should.contain('session');
    });

    it('yells if invalid session is sent', async () => {
      let sessionId = 'Vader Sessions';
      driver.sessionId = 'recession';

      let res = await request({
        url: `http://localhost:8181/wd/hub/session/${sessionId}/url`,
        method: 'POST',
        json: {url: 'http://google.com'},
        resolveWithFullResponse: true,
        simple: false
      });

      res.statusCode.should.equal(500);
      res.body.status.should.equal(6);
      res.body.value.message.should.contain('session');
    });

    it('should have session IDs in error responses', async () => {
      let sessionId = 'Vader Sessions';
      driver.sessionId = sessionId;

      let res = await request({
        url: `http://localhost:8181/wd/hub/session/${sessionId}/refresh`,
        method: 'POST',
        json: true,
        resolveWithFullResponse: true,
        simple: false
      });

      res.statusCode.should.equal(500);
      res.body.should.eql({
        status: 13,
        value: {
          message: 'An unknown server-side error occurred while processing ' +
                   'the command. Original error: Too Fresh!'
        },
        sessionId: sessionId
      });
    });
  });
});
