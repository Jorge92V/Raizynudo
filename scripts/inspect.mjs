import { neon } from '@neondatabase/serverless';
try {
 const sql=neon(process.env.DATABASE_URL);
 const tables=await sql`select table_schema,table_name from information_schema.tables where table_schema not in ('pg_catalog','information_schema') order by 1,2`;
 console.log(JSON.stringify({connected:true,tables},null,2));
} catch (e) { console.error('Database inspection failed:',e.code||e.name); process.exitCode=1; }
