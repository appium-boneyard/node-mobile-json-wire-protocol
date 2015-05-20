// transpile:mocha

import { getExpressRouter } from '../..';
import { FakeDriver } from './fake-driver';
import { server } from 'appium-express';
import request from 'request-promise';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';

chai.should();
chai.use(chaiAsPromised);

describe('MJSONWP', () => {

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
      (await d.validated_getUrl()).should.equal("http://foobar.com");
    });
  });

  describe('via express router', () => {
    let driver = new FakeDriver();
    driver.sessionId = 'foo';
    let mjsonwpServer;
    before(async () => {
      mjsonwpServer = await server(getExpressRouter(driver), 8181);
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
    it('should get 404 for bad routes', async () => {
      await request({
        url: 'http://localhost:8181/wd/hub/blargimarg',
        method: 'GET'
      }).should.eventually.be.rejectedWith("404");
    });
    it('should throw not yet implemented for unfilledout commands', async () => {
      await request({
        url: 'http://localhost:8181/wd/hub/session/foo/element/bar/text',
        method: 'GET'
      }).should.eventually.be.rejectedWith("implemented");
    });
  });
});
