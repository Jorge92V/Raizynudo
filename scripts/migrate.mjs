import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
try {
 const url=process.env.DATABASE_URL_UNPOOLED;
 if(!url||new URL(url).hostname.includes('-pooler.')) throw Error('Use DATABASE_URL_UNPOOLED');
 const sql=neon(url);
 const source=await readFile(new URL('../db/migrations/001_orders.sql',import.meta.url),'utf8');
 const statements=source.split(';').map(s=>s.trim()).filter(Boolean);
 await sql.transaction(statements.map(s=>sql.query(s,[])));
 console.log('Migration 001_orders applied successfully');
} catch(e) { console.error('Migration failed:',e.code||e.name);process.exitCode=1; }
