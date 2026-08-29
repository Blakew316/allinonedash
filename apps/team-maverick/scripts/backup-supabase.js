#!/usr/bin/env node
// Fetches all Supabase tables and writes JSON backup files
// Run: node scripts/backup-supabase.js

const fs = require('fs');
const path = require('path');

const SUPA_URL = process.env.SUPA_URL || 'https://xeevmevxjuawskugedds.supabase.co';
// Prefer the service_role key so backups keep reading every table even after
// the public anon key is locked down. Falls back to SUPA_KEY / the anon key.
const SUPA_KEY = (process.env.SUPABASE_SERVICE_KEY || process.env.SUPA_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlZXZtZXZ4anVhd3NrdWdlZGRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODU1NzQsImV4cCI6MjA5NzU2MTU3NH0.-it_zqeDlzybZ1GL4swcWTL_MmhGnNG971i_x_burIw').trim();

const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'supabase');

const TABLES = [
  'merchant_overrides',
  'merchant_details',
  'app_settings',
  'call_logs',
  'email_replies',
  'sheet_transfers',
];

async function fetchTable(table) {
  const res = await fetch(
    SUPA_URL + '/rest/v1/' + table + '?select=*',
    {
      headers: {
        apikey: SUPA_KEY,
        Authorization: 'Bearer ' + SUPA_KEY,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Failed to fetch ' + table + ': ' + res.status + ' ' + text);
  }
  return res.json();
}

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  let totalRows = 0;
  for (const table of TABLES) {
    try {
      const rows = await fetchTable(table);
      const outPath = path.join(BACKUP_DIR, table + '.json');
      fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');
      console.log('  ' + table + ': ' + rows.length + ' rows');
      totalRows += rows.length;
    } catch (e) {
      console.log('  ' + table + ': FAILED - ' + e.message);
    }
  }
  console.log('\n' + totalRows + ' total rows backed up to ' + BACKUP_DIR);
}

main().catch(function (err) {
  console.error('Backup failed:', err.message || err);
  process.exit(1);
});
