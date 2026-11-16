import { neon } from '@neondatabase/serverless';
import { randomUUID,randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import orders from '../server/orders.cjs';
import admin from '../server/admin.cjs';
import notifications from '../server/notifications.cjs';
const sql=neon(process.env.DATABASE_URL),key=randomUUID();
const env={ADMIN_PASSWORD:randomBytes(24).toString('hex'),ADMIN_SESSION_SECRET:randomBytes(32).toString('hex')};
const handler=admin.createAdminHandler(()=>sql,{env});
const headers={host:'test.local',origin:'https://test.local','x-admin-request':'1','x-nf-client-connection-ip':'smoke-test'};
const event=(action,method='GET',body={},params={})=>({httpMethod:method,headers,queryStringParameters:{action,...params},body:JSON.stringify(body)});
const input={requestKey:key,client:{name:'PRUEBA ADMIN AUTOMATIZADA',phone:'5500000000',use:'Uso personal'},delivery:{method:'pickup',city:'Prueba'},design:{mode:'v',largo:40,ancho:30,grosor:3,vT:2,hT:1,grid:[['nogal','parota']],extras:[]}};
input.expectedAmountCents=orders.validate(input).productCents;
try{
 assert.equal((await handler(event('list'))).statusCode,401);
 const created=await orders.createHandler(()=>sql)({httpMethod:'POST',body:JSON.stringify(input)});assert.equal(created.statusCode,200);
 const [row]=await sql.query('SELECT id,revision FROM raiz_nudo.orders WHERE request_key=$1',[key]);
 const login=await handler(event('login','POST',{password:env.ADMIN_PASSWORD}));assert.equal(login.statusCode,200);
 headers.cookie=login.headers['Set-Cookie'].split(';')[0];
 const list=await handler(event('list','GET',{}, {search:JSON.parse(created.body).folio}));assert.equal(JSON.parse(list.body).items.length,1);
 const detail=await handler(event('detail','GET',{}, {id:row.id}));assert.equal(JSON.parse(detail.body).order.email_state,'pending');
 assert.equal((await handler(event('status','POST',{id:row.id,revision:0,status:'En producción'}))).statusCode,409);
 assert.equal((await handler(event('status','POST',{id:row.id,revision:0,status:'En revisión'}))).statusCode,200);
 assert.equal((await handler(event('status','POST',{id:row.id,revision:0,status:'Recibido'}))).statusCode,409);
 const paid=await handler(event('deposit','POST',{id:row.id,revision:1}));assert.equal(paid.statusCode,200);
 const order=JSON.parse(paid.body).order;assert.ok(order.paid_at);assert.ok(order.production_due);
 assert.equal((await handler(event('deposit','POST',{id:row.id,revision:2}))).statusCode,409);
 let sends=0;
 const mailOptions={env:{RESEND_API_KEY:'fake',MAIL_FROM:'test@example.com'},fetcher:async()=>{sends++;return {ok:true,json:async()=>({id:'fake-provider-id'})}}};
 assert.equal((await notifications.deliverNotification(sql,row.id,mailOptions)).state,'sent');
 await notifications.deliverNotification(sql,row.id,mailOptions);assert.equal(sends,1);
 console.log('PASS: admin login, protected listing, status history, stale-write prevention, deposit and email queue (no real email sent)');
}catch(e){console.error('Admin smoke failed:',e.code||e.name);process.exitCode=1}
finally{
 await sql.transaction([
  sql`delete from raiz_nudo.order_events where order_id in (select id from raiz_nudo.orders where request_key=${key})`,
  sql`delete from raiz_nudo.orders where request_key=${key}`
 ]);console.log('Temporary admin test order removed');
}
