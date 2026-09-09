'use strict';
const express = require('express');
const { amGetAllPages } = require('../lib/amClient');
const { pullIndentSummary } = require('../lib/indentPull');

const router = express.Router();

const CACHE_TTL_MS = 10 * 60 * 1000;
let collectionsCache = { at: 0, data: null };

router.get('/am/collections', async (req, res) => {
  try {
    if (collectionsCache.data && Date.now() - collectionsCache.at < CACHE_TTL_MS) {
      return res.json({ collections: collectionsCache.data });
    }
    const products = await amGetAllPages('products', {});
    const collections = [...new Set(products.map((p) => p.collection).filter(Boolean))].sort();
    collectionsCache = { at: Date.now(), data: collections };
    res.json({ collections });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/am/pull', async (req, res) => {
  try {
    const { collections, sellDate } = req.body || {};
    const result = await pullIndentSummary({ collections, sellDate });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
