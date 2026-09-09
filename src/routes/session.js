'use strict';
const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/session', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT snapshot, updated_at FROM current_session WHERE id = 1');
    res.json({ session: rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/session', async (req, res) => {
  try {
    const { snapshot } = req.body || {};
    if (!snapshot) return res.status(400).json({ error: 'snapshot is required' });
    await pool.query(
      `INSERT INTO current_session (id, snapshot, updated_at) VALUES (1, $1, now())
       ON CONFLICT (id) DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
      [snapshot]
    );
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/session', async (req, res) => {
  try {
    await pool.query('DELETE FROM current_session WHERE id = 1');
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
