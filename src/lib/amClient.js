'use strict';

const AM_BASE = 'https://kohindustries.app.apparelmagic.com/api';

function getToken() {
  const token = process.env.AM_TOKEN;
  if (!token) throw new Error('AM_TOKEN is not set');
  return token;
}

async function amGet(pathSegment, extraParams = {}) {
  const params = new URLSearchParams({ ...extraParams, token: getToken(), time: Date.now() });
  const url = `${AM_BASE}/${pathSegment}/?${params.toString()}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`AM request failed: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  if (data.meta && data.meta.errors && data.meta.errors.length) {
    throw new Error(`AM API error: ${data.meta.errors.join('; ')}`);
  }
  return data;
}

async function amGetAllPages(pathSegment, extraParams = {}, onPage) {
  const all = [];
  let lastId;
  for (;;) {
    const params = lastId ? { ...extraParams, 'pagination[last_id]': lastId } : extraParams;
    const data = await amGet(pathSegment, params);
    const rows = data.response || [];
    if (rows.length === 0) break;
    all.push(...rows);
    if (onPage) onPage(rows, all.length);
    lastId = data.meta && data.meta.pagination && data.meta.pagination.last_id;
    if (!lastId) break;
  }
  return all;
}

module.exports = { AM_BASE, amGet, amGetAllPages };
