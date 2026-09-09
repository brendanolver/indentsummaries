'use strict';
const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/archives', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, label, collections, sell_date, created_at FROM archives ORDER BY created_at DESC'
    );
    res.json({ archives: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/archives/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM archives WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/archives', async (req, res) => {
  try {
    const { label, collections, sellDate, snapshot } = req.body || {};
    if (!label || !snapshot) return res.status(400).json({ error: 'label and snapshot are required' });
    const { rows } = await pool.query(
      `INSERT INTO archives (label, collections, sell_date, snapshot)
       VALUES ($1, $2, $3, $4)
       RETURNING id, label, collections, sell_date, created_at`,
      [label, collections || [], sellDate || null, snapshot]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
