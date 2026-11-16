const { test }=require('node:test');
const assert=require('node:assert/strict');
const { message,deliverNotification,RECIPIENT }=require('../server/notifications.cjs');
const order={folio:'RN-TEST',customer:{name:'<script>bad</script>',phone:'5512345678',use:'Un regalo'},design:{mode:'v',largo:40,ancho:30,grosor:3,grid:[['nogal','parota']],extras:[]},delivery:{method:'shipping',city:'Prueba'},product_cents:100000,deposit_cents:30000,shipping_cents:null,status:'Recibido'};
test('aviso incluye cliente, diseño, anticipo, destino y envío pendiente; escapa HTML',()=>{
 const m=message(order);assert.ok(m.text.includes('30%'));assert.ok(m.text.includes('nogal / parota'));assert.ok(m.text.includes('según la zona'));assert.ok(m.text.includes('7 días naturales'));
 assert.ok(!m.html.includes('<script>'));assert.ok(m.html.includes('&lt;script&gt;'));
 assert.equal(RECIPIENT,'mike.valleg4@gmail.com');
});
test('sin configuración deja el aviso pendiente sin consultar o enviar',async()=>{
 const result=await deliverNotification({query(){throw Error('No query')}},'id',{env:{},fetcher(){throw Error('No send')}});
 assert.equal(result.state,'pending');
});
test('usa destinatario fijo e idempotencia y registra aceptación del servicio',async()=>{
 const queries=[];const sql={query:async(q,args)=>{queries.push([q,args]);if(q.startsWith('SELECT'))return [order];return [{order_id:'id'}]}};
 const result=await deliverNotification(sql,'id',{env:{RESEND_API_KEY:'test-key',MAIL_FROM:'taller@example.com'},fetcher:async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers['Idempotency-Key'],'raiz-order-id');assert.deepEqual(JSON.parse(options.body).to,[RECIPIENT]);return {ok:true,json:async()=>({id:'provider-id'})};
 }});
 assert.equal(result.state,'sent');assert.ok(queries.at(-1)[0].includes("state='sent'"));
});
test('si falla el proveedor conserva un error genérico y habilita reintento',async()=>{
 const queries=[];const sql={query:async(q,args)=>{queries.push([q,args]);return q.startsWith('SELECT')?[order]:[{order_id:'id'}]}};
 const result=await deliverNotification(sql,'id',{env:{RESEND_API_KEY:'test-key',MAIL_FROM:'taller@example.com'},fetcher:async()=>({ok:false,status:429})});
 assert.equal(result.state,'failed');assert.equal(queries.at(-1)[1][1],'provider_http_429');
});
test('un aviso ya reclamado o enviado no vuelve a enviarse',async()=>{
 const result=await deliverNotification({query:async()=>[]},'id',{env:{RESEND_API_KEY:'test-key',MAIL_FROM:'taller@example.com'},fetcher(){throw Error('No send')}});
 assert.equal(result.state,'unchanged');
});
