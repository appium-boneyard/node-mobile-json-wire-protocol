"use strict";

var gulp = require('gulp'),
    boilerplate = require('appium-gulp-plugins').boilerplate.use(gulp);

boilerplate({
  buildName: 'mobile-json-wire-protocol',
  jscs: false,
  testReporter: process.env.TRAVIS ? 'spec' : 'nyan'
});
