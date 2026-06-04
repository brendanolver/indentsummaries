'use strict';
const https  = require('https');
const http   = require('http');
const urlLib = require('url');

const AM_BASE  = 'https://kohindustries.app.apparelmagic.com/api';
const AM_TOKEN = 'cff4a1e4a3d0b3726a4117e4f14a618a';
const ALLOWED  = ['products', 'inventory', 'orders', 'warehouses'];

function doRequest(targetUrl) {
  return new Promise(function(resolve, reject) {
    var parsed  = urlLib.parse(targetUrl);
    var mod     = parsed.protocol === 'https:' ? https : http;
    var options = { hostname: parsed.hostname, path: parsed.path, method: 'GET', headers: { 'Accept': 'application/json' } };
    var req = mod.request(options, function(res) {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return doRequest(res.headers.location).then(resolve).catch(reject);
      }
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' };
  }

  var params   = event.queryStringParameters || {};
  var path     = params.path || '';
  if (!path) return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing path' }) };

  var endpoint = path.split('?')[0].split('/')[0];
  if (ALLOWED.indexOf(endpoint) === -1) {
    return { statusCode: 403, headers: cors(), body: JSON.stringify({ error: 'Forbidden' }) };
  }

  try {
    var t       = Math.floor(Date.now() / 1000);
    var sep     = path.indexOf('?') !== -1 ? '&' : '?';
    var fullUrl = AM_BASE + '/' + path + sep + 'token=' + AM_TOKEN + '&time=' + t;
    var result  = await doRequest(fullUrl);
    return { statusCode: result.status, headers: Object.assign(cors(), { 'Content-Type': 'application/json' }), body: result.body };
  } catch(err) {
    return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: err.message }) };
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type'
  };
}
