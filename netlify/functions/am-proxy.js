const AM_BASE  = 'https://kohindustries.app.apparelmagic.com/api';
const AM_TOKEN = 'cff4a1e4a3d0b3726a4117e4f14a618a';
const ALLOWED  = ['products', 'inventory', 'orders', 'warehouses'];

exports.handler = async (event) => {
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

  const t   = Math.floor(Date.now() / 1000);
  const sep = path.includes('?') ? '&' : '?';
  const url = ;

  try {
    const res  = await fetch(url, { headers: { Accept: 'application/json' } });
    const body = await res.text();
    return {
      statusCode: res.status,
      headers: { ...cors(), 'Content-Type': 'application/json' },
      body
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: cors(),
      body: JSON.stringify({ error: 'Bad gateway', detail: err.message })
    };
  }
};

function cors() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept, Content-Type'
  };
}
