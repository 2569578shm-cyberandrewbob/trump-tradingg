import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const seedFile = join(dirname(fileURLToPath(import.meta.url)), '../../seeds/seed.sql');

const sql = await readFile(seedFile, 'utf8');
await pool.query(sql);
await pool.end();
console.log('seed complete');
