const RECIPIENT = 'Miguel.valleg@hotmail.com';
const DEFAULT_SENDER = 'Raíz & Nudo <onboarding@resend.dev>';
const mailConfigured = env => Boolean(env.RESEND_API_KEY);
const mailFrom = env => env.MAIL_FROM || DEFAULT_SENDER;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(cents/100);
function message(order) {
 const c=order.customer,d=order.design,e=order.delivery;
 const fields=[
  ['Folio',order.folio],['Cliente',c.name],['WhatsApp',c.phone],['Correo',c.email||'No indicado'],
  ['Uso',c.use],['Fecha solicitada',c.date||'No indicada'],['Comentarios',c.notes||'Sin comentarios'],
  ['Diseño',({v:'Vertical',h:'Horizontal',b:'Ajedrez'})[d.mode]],['Medidas',`${d.largo} × ${d.ancho} × ${d.grosor} cm`],
  ['Distribución',d.grid.map(row=>row.join(' / ')).join('\n')],['Extras',d.extras.join(', ')||'Sin extras'],
  ['Grabado',d.engraving?`${d.engraving.sizeCm} cm; X ${d.engraving.x}%, Y ${d.engraving.y}%. Archivo disponible en admin.`:'Sin grabado'],
  ['Entrega',e.method==='shipping'?'Envío a domicilio':'Recogida'],['Destino',`${e.city} ${e.zip||''} ${e.address||''}`],
  ['Producto',money(order.product_cents)],['Anticipo del 30%',money(order.deposit_cents)],
  ['Envío',order.shipping_cents===null?'Por cotizar según destino':money(order.shipping_cents)],
  ['Fabricación','7 días naturales desde la recepción del anticipo'],['Estado',order.status]
 ];
 return {
  subject:`Nuevo pedido ${order.folio} · Raíz & Nudo`,
  text:'Nuevo pedido recibido\n\n'+fields.map(([k,v])=>`${k}: ${v}`).join('\n'),
  html:`<div style="font-family:Arial;color:#293b2d;max-width:680px"><h1>Nuevo pedido · Raíz & Nudo</h1><p>La solicitud ya está guardada. Revisa los detalles en /admin de tu plataforma.</p><table style="border-collapse:collapse;width:100%">${fields.map(([k,v])=>`<tr><th style="padding:10px;text-align:left;border-bottom:1px solid #ddd">${escape(k)}</th><td style="padding:10px;white-space:pre-wrap;border-bottom:1px solid #ddd">${escape(v)}</td></tr>`).join('')}</table></div>`
 };
}
async function deliverNotification(sql,orderId,{env=process.env,fetcher=fetch}={}) {
 // No email credentials: leave the durable queue untouched for later retry.
 if(!mailConfigured(env))return {state:'pending',configured:false};
 const claimed=await sql.query(`UPDATE raiz_nudo.email_notifications SET state='sending',attempts=attempts+1,lease_until=now()+interval '90 seconds'
  WHERE order_id=$1 AND attempts<10 AND ((state IN ('pending','failed') AND next_attempt_at<=now()) OR (state='sending' AND lease_until<now())) RETURNING order_id`,[orderId]);
 if(!claimed.length)return {state:'unchanged'};
 try {
  const [order]=await sql.query('SELECT folio,customer,design,delivery,product_cents,deposit_cents,shipping_cents,status FROM raiz_nudo.orders WHERE id=$1',[orderId]);
  if(!order)throw Error('order_missing');
  const result=await fetcher('https://api.resend.com/emails',{
   method:'POST',signal:AbortSignal.timeout(8000),
   headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`raiz-order-${orderId}`},
   body:JSON.stringify({from:mailFrom(env),to:[RECIPIENT],...message(order)})
  });
  if(!result.ok)throw Error(`provider_http_${result.status}`);
  const data=await result.json();
  if(!data.id)throw Error('provider_response_invalid');
  await sql.query("UPDATE raiz_nudo.email_notifications SET state='sent',sent_at=now(),provider_id=$2,last_error=NULL,lease_until=NULL WHERE order_id=$1",[orderId,data.id]);
  return {state:'sent'};
 }catch(e){
  const reason=/^provider_http_\d{3}$/.test(e.message)?e.message:'delivery_failed';
  await sql.query("UPDATE raiz_nudo.email_notifications SET state='failed',last_error=$2,next_attempt_at=now()+interval '5 minutes',lease_until=NULL WHERE order_id=$1",[orderId,reason]);
  return {state:'failed'};
 }
}
module.exports={RECIPIENT,DEFAULT_SENDER,mailConfigured,message,deliverNotification};
