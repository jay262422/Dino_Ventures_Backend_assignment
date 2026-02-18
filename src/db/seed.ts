import { pool } from './pool';
import * as fs from 'fs';
import * as path from 'path';

async function seed() {
  const client = await pool.connect();
  try {
    const seedPath = path.join(__dirname, '../../seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');
    await client.query(sql);
    console.log('Seed completed successfully.');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
