const { randomUUID, createHash } = require('node:crypto');
const prices = { nogal:147*1.16, tzalam:83.46*1.16, parota:78.45*1.16, fresno:72.41*1.16, encino:51.72*1.16 };
const extras = { canal:30, agarra:50, grabado:50 };
class InputError extends Error {}
function check(value, message) { if(!value)throw new InputError(message); }
function text(value,max=2000) { check(typeof value==='string'&&value.trim().length<=max,'Texto inválido');return value.trim(); }
function number(v,min,max,step=1) { check(Number.isFinite(v)&&v>=min&&v<=max&&Math.abs((v-min)/step-Math.round((v-min)/step))<1e-8,'Medida inválida');return v; }
function validate(input) {
 check(input&&typeof input==='object','Pedido inválido');
 check(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestKey),'Identificador inválido');
 const c=input.client||{},d=input.design||{},e=input.delivery||{};
 const client={name:text(c.name,150),phone:text(c.phone,30),email:text(c.email||'',254),use:text(c.use,30),date:text(c.date||'',10),notes:text(c.notes||'')};
 check(client.name.length>=2&&/^\+?[\d\s()-]{10,30}$/.test(client.phone)&&client.phone.replace(/\D/g,'').length>=10,'Nombre o teléfono inválido');
 check(!client.email||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email),'Correo inválido');
 check(['Uso personal','Un regalo','Mi negocio'].includes(client.use),'Uso inválido');
 check(!client.date||/^\d{4}-\d{2}-\d{2}$/.test(client.date),'Fecha inválida');
 check(['v','h','b'].includes(d.mode),'División inválida');
 const largo=number(d.largo,15,120),ancho=number(d.ancho,15,60),grosor=number(d.grosor,1.5,4,.5);
 const vT=number(d.vT,1,d.mode==='h'?1:d.mode==='b'?10:20),hT=number(d.hT,1,d.mode==='v'?1:d.mode==='b'?10:15);
 check(Array.isArray(d.grid)&&d.grid.length===hT&&d.grid.every(row=>Array.isArray(row)&&row.length===vT&&row.every(w=>Object.hasOwn(prices,w))),'Completa todas las secciones con maderas válidas');
 const grid=d.grid.map(row=>row.slice());
 if(d.mode==='b') { const woods=[...new Set(grid.flat())];check(woods.length<=2,'Ajedrez admite dos maderas');check(grid.every((row,r)=>row.every((w,c)=>w===grid[(r+c)%2===0?0:(hT>1?1:0)][(r+c)%2===0?0:(hT>1?0:1)])),'Patrón ajedrez inválido'); }
 check(Array.isArray(d.extras)&&new Set(d.extras).size===d.extras.length&&d.extras.every(k=>Object.hasOwn(extras,k)),'Extras inválidos');
 check(!d.extras.includes('agarra')||grosor>=3,'La agarradera requiere grosor mínimo de 3 cm');
 let engraving=null;
 if(d.extras.includes('grabado')) {
  const g=d.engraving||{};
  const sizeCm=number(g.sizeCm,2,10,.1),x=number(g.x,0,100),y=number(g.y,0,100);
  check(x/100*largo-sizeCm/2>=0&&x/100*largo+sizeCm/2<=largo&&y/100*ancho-sizeCm/2>=0&&y/100*ancho+sizeCm/2<=ancho,'Grabado fuera de la tabla');
  check(typeof g.image==='string'&&/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(g.image)&&g.image.length<=2100000,'Imagen inválida o demasiado grande');
  const bytes=Buffer.from(g.image.split(',')[1],'base64');
  check(bytes.length<=1500000&&(g.image.startsWith('data:image/png')?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255),'Formato de imagen inválido');
  engraving={image:g.image,x,y,sizeCm};
 }
 check(['pickup','shipping'].includes(e.method),'Entrega inválida');
 const delivery={method:e.method,city:text(e.city,150),zip:text(e.zip||'',5),address:e.method==='shipping'?text(e.address,1000):'',shippingCost:e.method==='shipping'?null:0};
 check(delivery.city.length>=2,'Indica una ciudad');
 check(e.method!=='shipping'||(/^\d{5}$/.test(delivery.zip)&&delivery.address.length>=5),'Completa dirección y CP');
 const design={mode:d.mode,largo,ancho,grosor,vT,hT,grid,extras:[...d.extras].sort(),engraving};
 const merma=d.mode==='b'?4:2,factor=d.mode==='b'?4.2:3.7;
 const unit=((grosor+.5)/2.54)*((ancho+merma)/hT/2.54)*((largo+merma)/vT/30.48)/12;
 const productCents=Math.round((grid.flat().reduce((sum,w)=>sum+prices[w]*unit,0)*factor+d.extras.reduce((sum,k)=>sum+extras[k],0))*100);
 const depositCents=Math.round(productCents*.3);
 const pricing={version:1,currency:'MXN',factor,merma:{l:merma,a:merma,g:.5},woodPrices:prices,extras,depositPercent:30};
 return {requestKey:input.requestKey,client,delivery,design,productCents,depositCents,pricing};
}
function response(statusCode,body) {return {statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify(body)};}
function createHandler(getSql, notify = async () => {}) { return async event=>{
 if(event.httpMethod!=='POST')return {...response(405,{error:'Método no permitido'}),headers:{Allow:'POST','Content-Type':'application/json'}};
 if(Buffer.byteLength(event.body||'')>2300000)return response(413,{error:'Pedido demasiado grande'});
 try {
  let input;try{input=JSON.parse(event.body)}catch{throw new InputError('JSON inválido')}
  const o=validate(input);
  if(input.expectedAmountCents!==o.productCents)return response(409,{error:'El precio cambió. Recarga la página y revisa la cotización antes de confirmar.'});
  const sql=getSql();
  const fingerprint=createHash('sha256').update(JSON.stringify({...o,requestKey:undefined})).digest('hex');
  const id=randomUUID(),folio='RN-'+new Date().getFullYear()+'-'+id.toUpperCase();
  const rows=await sql.query(`WITH saved AS (
   INSERT INTO raiz_nudo.orders(id,request_key,fingerprint,folio,customer,delivery,design,pricing,product_cents,deposit_cents,shipping_cents)
   VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9,$10,$11)
   ON CONFLICT (request_key) DO UPDATE SET request_key=EXCLUDED.request_key
   RETURNING id,folio,created_at,fingerprint,product_cents,deposit_cents,shipping_cents,status
  ), event AS (
   INSERT INTO raiz_nudo.order_events(order_id,status)
   SELECT id,'Recibido' FROM saved WHERE id=$1 RETURNING id
  ), notification AS (
   INSERT INTO raiz_nudo.email_notifications(order_id) SELECT id FROM saved
   ON CONFLICT (order_id) DO NOTHING RETURNING order_id
  ) SELECT id,folio,created_at,fingerprint,product_cents,deposit_cents,shipping_cents,status FROM saved`,
  [id,o.requestKey,fingerprint,folio,JSON.stringify(o.client),JSON.stringify(o.delivery),JSON.stringify(o.design),JSON.stringify(o.pricing),o.productCents,o.depositCents,o.delivery.method==='shipping'?null:0]);
  const saved=rows[0];
  if(saved.fingerprint!==fingerprint)return response(409,{error:'Esta confirmación ya fue utilizada con otro diseño. Recarga e inténtalo de nuevo.'});
  try { await notify(sql,saved.id); } catch { console.error('notification_pending'); }
  return response(200,{folio:saved.folio,created:saved.created_at,amount:saved.product_cents/100,depositAmount:saved.deposit_cents/100,shippingCost:saved.shipping_cents===null?null:saved.shipping_cents/100,status:saved.status,productionDays:7});
 }catch(e){if(e instanceof InputError)return response(400,{error:e.message});console.error('orders_failed',e.code||e.name);return response(503,{error:'No se pudo guardar el pedido. Conserva tu diseño e inténtalo de nuevo.'})}
};}
module.exports={validate,createHandler};
