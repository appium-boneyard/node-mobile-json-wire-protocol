const METHOD_MAP = {
  '/wd/hub/session/:sessionId/back': {
    POST: {command: 'back'}
  },
  '/wd/hub/session/:sessionId/url': {
    GET: {command: 'getUrl'},
    POST: {command: 'setUrl', payloadParams: ['url']}
  },
  '/wd/hub/session/:sessionId/element/:elementId/click': {
    POST: {command: 'click'}
  },
  '/wd/hub/session/:sessionId/element/:elementId/text': {
    GET: {command: 'getText'}
  }
};

export { METHOD_MAP };
