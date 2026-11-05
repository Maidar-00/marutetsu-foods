/**
 * Netlify serverless function — wraps the shared Express app.
 * Everything under /api/* is routed here by netlify.toml.
 */
const serverless = require('serverless-http');
const app = require('../../src/app');

module.exports.handler = serverless(app);
