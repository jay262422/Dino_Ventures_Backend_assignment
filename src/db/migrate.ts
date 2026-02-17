import { pool } from './pool';
import * as fs from 'fs';
import * as path from 'path';

async function migrate() {
  const client = await pool.connect();
  try {
    const migrationPath = path.join(__dirname, '../../migrations/001_init_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('Migration completed successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
