'use strict';
const express = require('express');
const { AM_BASE } = require('../lib/amClient');

const ALLOWED = ['products', 'inventory', 'orders', 'warehouses'];

const router = express.Router();

router.get('/am-proxy', async (req, res) => {
  const path = req.query.path || '';
  if (!path) return res.status(400).json({ error: 'Missing path' });

  const endpoint = path.split('?')[0].split('/')[0];
  if (ALLOWED.indexOf(endpoint) === -1) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const token = process.env.AM_TOKEN;
  if (!token) return res.status(500).json({ error: 'AM_TOKEN is not set' });

  try {
    const sep = path.indexOf('?') !== -1 ? '&' : '?';
    const fullUrl = `${AM_BASE}/${path}${sep}token=${token}&time=${Math.floor(Date.now() / 1000)}`;
    const amRes = await fetch(fullUrl);
    const body = await amRes.text();
    res.status(amRes.status).type('application/json').send(body);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

module.exports = router;
