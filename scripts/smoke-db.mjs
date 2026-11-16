import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import api from '../server/orders.cjs';
const sql=neon(process.env.DATABASE_URL),key=randomUUID();
const input={requestKey:key,client:{name:'PRUEBA AUTOMATIZADA',phone:'5500000000',use:'Uso personal'},delivery:{method:'shipping',city:'Monterrey',zone:'Centro',zip:'64000',address:'Domicilio de prueba 123'},design:{mode:'v',largo:40,ancho:30,grosor:3,vT:2,hT:1,grid:[['nogal','parota']],extras:[]}};
input.expectedAmountCents=api.validate(input).productCents;
try {
 const handler=api.createHandler(()=>sql),event={httpMethod:'POST',body:JSON.stringify(input)};
 const first=await handler(event),second=await handler(event);
 assert.equal(first.statusCode,200);assert.equal(second.statusCode,200);
 assert.equal(JSON.parse(first.body).folio,JSON.parse(second.body).folio);
 const rows=await sql`select o.id,o.product_cents,o.deposit_cents,count(e.id)::int as events from raiz_nudo.orders o left join raiz_nudo.order_events e on e.order_id=o.id where request_key=${key} group by o.id`;
 assert.equal(rows.length,1);assert.equal(rows[0].events,1);assert.equal(rows[0].deposit_cents,Math.round(rows[0].product_cents*.3));
 const changed={...input,client:{...input.client,name:'CAMBIO'}};
 assert.equal((await handler({httpMethod:'POST',body:JSON.stringify(changed)})).statusCode,409);
 console.log('PASS: Neon order creation, server pricing, 30% deposit and idempotent retry');
} catch(e) { console.error('Smoke test failed:',e.code||e.name);process.exitCode=1; }
finally {
 await sql.transaction([
  sql`delete from raiz_nudo.order_events where order_id in (select id from raiz_nudo.orders where request_key=${key})`,
  sql`delete from raiz_nudo.orders where request_key=${key}`
 ]);
 console.log('Temporary test order removed');
}
