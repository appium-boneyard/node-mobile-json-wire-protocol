// transpile:mocha

import { FakeDriver } from './fake-driver';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import 'mochawait';

chai.should();
chai.use(chaiAsPromised);

describe('MJSONWP', () => {
  describe('direct to driver', () => {
    let d = new FakeDriver();

    describe('setUrl', () => {
      it('should fail when no url passed', async () => {
        await d.validated_setUrl().should.eventually.be.rejectedWith(/url/i);
      });
      it('should fail when given invalid url', async () => {
        await d.validated_setUrl("foo").should.eventually.be.rejectedWith(/url/i);
      });
      it('should succeed when given url starting with http', async () => {
        await d.validated_setUrl("http://appium.io").should.not.be.rejected;
      });
    });
    describe('implicitWait', () => {
      it('should fail when given no ms', async () => {
        await d.validated_implicitWait().should.eventually.be.rejectedWith(/ms/i);
      });
      it('should fail when given a non-numeric ms', async () => {
        await d.validated_implicitWait("five").should.eventually.be.rejectedWith(/ms/i);
      });
      it('should fail when given a negative ms', async () => {
        await d.validated_implicitWait(-1).should.eventually.be.rejectedWith(/ms/i);
      });
      it('should succeed when given an ms of 0', async () => {
        await d.validated_implicitWait(0).should.not.be.rejected;
      });
      it('should succeed when given an ms greater than 0', async () => {
        await d.validated_implicitWait(100).should.not.be.rejected;
      });
    });
    describe('clickCurrent', () => {
      it('should fail when given no button', async () => {
        await d.validated_clickCurrent().should.eventually.be.rejectedWith(/0, 1, or 2/i);
      });
      it('should fail when given an invalid button', async () => {
        await d.validated_clickCurrent(4).should.eventually.be.rejectedWith(/0, 1, or 2/i);
      });
      it('should succeed when given a valid button', async () => {
        await d.validated_clickCurrent(0).should.not.be.rejected;
        await d.validated_clickCurrent(1).should.not.be.rejected;
        await d.validated_clickCurrent(2).should.not.be.rejected;
      });
    });
    describe('setNetworkConnection', () => {
      it('should fail when given no type', async () => {
        await d.validated_setNetworkConnection().should.eventually.be.rejectedWith(/0, 1, 2, 4, 6/i);
      });
      it('should fail when given an invalid type', async () => {
        await d.validated_setNetworkConnection(8).should.eventually.be.rejectedWith(/0, 1, 2, 4, 6/i);
      });
      it('should succeed when given a valid type', async () => {
        await d.validated_setNetworkConnection(0).should.not.be.rejected;
        await d.validated_setNetworkConnection(1).should.not.be.rejected;
        await d.validated_setNetworkConnection(2).should.not.be.rejected;
        await d.validated_setNetworkConnection(4).should.not.be.rejected;
        await d.validated_setNetworkConnection(6).should.not.be.rejected;
      });
    });
  });
});
