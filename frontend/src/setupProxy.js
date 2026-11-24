const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function setupProxy(app) {
  app.use('/check-tools', (req, res, next) => {
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
      return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
    }
    next();
  });
  app.use(createProxyMiddleware('/check-tools/', {
    target: 'http://127.0.0.1:3200', changeOrigin: true,
    pathRewrite: { '^/check-tools': '' },
    onError(error, req, res) {
      console.error('Check tools proxy failed:', error.code || error.name);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Check service unavailable. Start scripts/check_service.py and reload.' }));
    },
  }));
  app.use('/dpi-tools', (req, res, next) => {
    // Check the browser origin before translating it for the local DPI server.
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) {
      return res.status(403).json({ error: { message: 'Cross-origin requests are not allowed' } });
    }
    next();
  });
  app.use(createProxyMiddleware('/dpi-tools/', {
    target: 'http://127.0.0.1:3100',
    changeOrigin: true,
    pathRewrite: { '^/dpi-tools': '' },
    onProxyReq(proxyReq, req) {
      if (req.headers.origin) proxyReq.setHeader('origin', 'http://127.0.0.1:3100');
    },
    onError(error, req, res) {
      console.error('DPI Tools proxy failed:', error.code || error.name);
      res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>DPI Tools unavailable</title><h1>DPI Tools is unavailable</h1><p>Start the DPI service and reload this page.</p>');
    },
  }));
  app.use('/iran-monitor-data', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) {
      return res.status(403).json({ error: 'Cross-origin requests are not allowed' });
    }
    next();
  });
  app.use(createProxyMiddleware('/iran-monitor-data/', {
    target: 'http://127.0.0.1:4174',
    changeOrigin: true,
    pathRewrite: { '^/iran-monitor-data': '' },
    onError(error, req, res) {
      console.error('Iran monitor data proxy failed:', error.code || error.name);
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Iran monitor data unavailable. Start its local data server and run a monitor pass.' }));
    },
  }));
};
