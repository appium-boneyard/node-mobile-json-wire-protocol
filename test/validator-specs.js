// transpile:mocha

import { validators } from '../lib/validators';
import chai from 'chai';
import 'mochawait';

chai.should();

describe('MJSONWP', () => {
  describe('direct to driver', () => {
    // let d = new FakeDriver();

    describe('setUrl', () => {
      it('should fail when no url passed', async () => {
        (() => {validators.setUrl();}).should.throw(/url/i);
      });
      it('should fail when given invalid url', async () => {
        (() => {validators.setUrl('foo');}).should.throw(/url/i);
      });
      it('should succeed when given url starting with http', async () => {
        (() => {validators.setUrl('http://appium.io');}).should.not.throw;
      });
    });
    describe('implicitWait', () => {
      it('should fail when given no ms', async () => {
        (() => {validators.implicitWait();}).should.throw(/ms/i);
      });
      it('should fail when given a non-numeric ms', async () => {
        (() => {validators.implicitWait("five");}).should.throw(/ms/i);
      });
      it('should fail when given a negative ms', async () => {
        (() => {validators.implicitWait(-1);}).should.throw(/ms/i);
      });
      it('should succeed when given an ms of 0', async () => {
        (() => {validators.implicitWait(0);}).should.not.throw;
      });
      it('should succeed when given an ms greater than 0', async () => {
        (() => {validators.implicitWait(100);}).should.not.throw;
      });
    });
    describe('clickCurrent', () => {
      it('should fail when given no button', async () => {
        (() => {validators.clickCurrent();}).should.throw(/0, 1, or 2/i);
      });
      it('should fail when given an invalid button', async () => {
        (() => {validators.clickCurrent(4);}).should.throw(/0, 1, or 2/i);
      });
      it('should succeed when given a valid button', async () => {
        (() => {validators.clickCurrent(0);}).should.not.throw;
        (() => {validators.clickCurrent(1);}).should.not.throw;
        (() => {validators.clickCurrent(2);}).should.not.throw;
      });
    });
    describe('setNetworkConnection', () => {
      it('should fail when given no type', async () => {
        (() => {validators.setNetworkConnection();}).should.throw(/0, 1, 2, 4, 6/i);
      });
      it('should fail when given an invalid type', async () => {
        (() => {validators.setNetworkConnection(8);}).should.throw(/0, 1, 2, 4, 6/i);
      });
      it('should succeed when given a valid type', async () => {
        (() => {validators.setNetworkConnection(0);}).should.not.throw;
        (() => {validators.setNetworkConnection(1);}).should.not.throw;
        (() => {validators.setNetworkConnection(2);}).should.not.throw;
        (() => {validators.setNetworkConnection(4);}).should.not.throw;
        (() => {validators.setNetworkConnection(6);}).should.not.throw;
      });
    });
  });
});
