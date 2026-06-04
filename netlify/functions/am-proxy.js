import https from 'https';
import http from 'http';
import { parse as urlParse } from 'url';

const AM_BASE  = 'https://kohindustries.app.apparelmagic.com/api';
const AM_TOKEN = 'cff4a1e4a3d0b3726a4117e4f14a618a';
const ALLOWED  = ['products', 'inventory', 'orders', 'warehouses'];

function doRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed  = urlParse(targetUrl);
    const mod     = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path:     parsed.path,
      method:   'GET',
      headers:  { Accept: 'application/json' }
    };
    const req = mod.request(options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        return doRequest(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(), body: '' };
  }

  const path = (event.queryStringParameters || {}).path || '';
  if (!path) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: 'Missing path' }) };
  }

  const endpoint = path.split('?')[0].split('/')[0];
  if (!ALLOWED.includes(endpoint)) {
    return { statusCode: 403, headers: cors(), body: JSON.stringify({ error: 'Forbidden' }) };
  }

  try {
    const t       = Math.floor(Date.now() / 1000);
    const sep     = path.includes('?') ? '&' : '?';
    const fullUrl = AM_BASE + '/' + path + sep + 'token=' + AM_TOKEN + '&time=' + t;
    const result  = await doRequest(fullUrl);
    return {
      statusCode: result.status,
      headers: { ...cors(), 'Content-Type': 'application/json' },
      body: result.body
    };
  } catch (err) {
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
