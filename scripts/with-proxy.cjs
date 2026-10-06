// Explicit agents are required by the ws client; fetch honors NODE_USE_ENV_PROXY=1.
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxy) {
  const https = require('https');
  const { HttpsProxyAgent } = require('https-proxy-agent');
  const original = https.request;
  https.request = function (...args) {
    if (typeof args[0] === 'string' || args[0] instanceof URL) {
      if (typeof args[1] === 'function' || args[1] === undefined) args.splice(1, 0, {agent: new HttpsProxyAgent(proxy)});
      else args[1] = {...args[1], agent: new HttpsProxyAgent(proxy)};
    } else args[0] = {...args[0], agent: new HttpsProxyAgent(proxy)};
    return original.apply(this, args);
  };
}
