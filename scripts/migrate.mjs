import { readFile, readdir } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
try {
 const url=process.env.DATABASE_URL_UNPOOLED;
 if(!url||new URL(url).hostname.includes('-pooler.')) throw Error('Use DATABASE_URL_UNPOOLED');
 const sql=neon(url);
 const directory=new URL('../db/migrations/',import.meta.url);
 for(const name of (await readdir(directory)).filter(n=>n.endsWith('.sql')).sort()) {
  const source=await readFile(new URL(name,directory),'utf8');
  const statements=source.split(';').map(s=>s.trim()).filter(Boolean);
  await sql.transaction(statements.map(s=>sql.query(s,[])));
  console.log('Migration applied:',name);
 }
} catch(e) { console.error('Migration failed:',e.code||e.name);process.exitCode=1; }
