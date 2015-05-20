const METHOD_MAP = {
  '/wd/hub/status': {
    GET: {command: 'getStatus'}
  },

  '/wd/hub/session/:sessionId/back': {
    POST: {command: 'back'}
  },
  '/wd/hub/session/:sessionId/forward': {
    POST: {command: 'forward'}
  },
  '/wd/hub/session/:sessionId/refresh': {
    POST: {command: 'refresh'}
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

const NO_SESSION_ID_COMMANDS = ['createSession', 'getStatus', 'getSessions'];

export { METHOD_MAP, NO_SESSION_ID_COMMANDS };
