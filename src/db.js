'use strict';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const useSsl = process.env.NODE_ENV === 'production' && process.env.PGSSL !== 'disable';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

async function runMigrations() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
}

module.exports = { pool, runMigrations };
