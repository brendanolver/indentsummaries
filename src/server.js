'use strict';
require('dotenv').config();
const path = require('path');
const express = require('express');
const { runMigrations } = require('./db');
const amProxyRoutes = require('./routes/amProxy');
const amRoutes = require('./routes/am');
const archivesRoutes = require('./routes/archives');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use('/api', amProxyRoutes);
app.use('/api', amRoutes);
app.use('/api', archivesRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

async function start() {
  try {
    await runMigrations();
    console.log('Migrations applied');
  } catch (err) {
    console.error('Migration failed (archive features will be unavailable until DATABASE_URL is set correctly):', err.message);
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`indentsummaries listening on :${port}`));
}

start();
