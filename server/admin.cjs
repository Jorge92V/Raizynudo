const { createHmac, createHash, timingSafeEqual, randomBytes } = require('node:crypto');
const { STATUSES } = require('../assets/business.js');
const { deliverNotification } = require('./notifications.cjs');
const COOKIE='rn_admin';
class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
const digest=value=>createHash('sha256').update(value).digest();
const equal=(a,b)=>timingSafeEqual(digest(a),digest(b));
function configured(env){return typeof env.ADMIN_PASSWORD==='string'&&env.ADMIN_PASSWORD.length>=16&&typeof env.ADMIN_SESSION_SECRET==='string'&&env.ADMIN_SESSION_SECRET.length>=32;}
function signature(payload,env){return createHmac('sha256',env.ADMIN_SESSION_SECRET).update(payload+':'+digest(env.ADMIN_PASSWORD).toString('hex')).digest('base64url');}
function token(env,now=Date.now()){
 const body=Buffer.from(JSON.stringify({exp:now+8*60*60*1000,nonce:randomBytes(16).toString('hex')})).toString('base64url');
 return body+'.'+signature(body,env);
}
function authenticated(headers,env,now=Date.now()){
 if(!configured(env))return false;
 try{
  const cookie=(headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='));
  if(!cookie||cookie.length>4096)return false;
  const [body,sig,...extra]=cookie.slice(COOKIE.length+1).split('.');
  if(extra.length||!sig||!equal(sig,signature(body,env)))return false;
  const data=JSON.parse(Buffer.from(body,'base64url').toString());
  return Number.isFinite(data.exp)&&data.exp>now&&data.exp<=now+8*60*60*1000;
 }catch{return false}
}
function result(statusCode,data,headers={}){return {statusCode,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',...headers},body:JSON.stringify(data)};}
function cookie(value,headers,logout=false){const local=/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(headers.host||'');return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${logout?0:28800}${local?'':'; Secure'}`;}
function uuid(value){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value||''))throw new HttpError(400,'Pedido inválido');return value;}
function createAdminHandler(getSql,{env=process.env,notify=deliverNotification}={}){return async event=>{
 const headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
 const action=event.queryStringParameters?.action||'session';
 try{
  if(!configured(env))throw new HttpError(503,'Configura las credenciales de administración en el servidor.');
  if(!['GET','POST'].includes(event.httpMethod))throw new HttpError(405,'Método no permitido');
  let input={};
  if(event.httpMethod==='POST'){
   if(headers['x-admin-request']!=='1')throw new HttpError(403,'Solicitud no permitida');
   if(headers.origin){let origin;try{origin=new URL(headers.origin)}catch{throw new HttpError(403,'Origen inválido')};if(origin.host!==headers.host)throw new HttpError(403,'Origen no permitido');}
   if(Buffer.byteLength(event.body||'')>4096)throw new HttpError(413,'Solicitud demasiado grande');
   try{input=JSON.parse(event.body||'{}')}catch{throw new HttpError(400,'JSON inválido')}
  }
  if(action==='login'&&event.httpMethod==='POST'){
   const sql=getSql();
   const ip=headers['x-nf-client-connection-ip']||event.requestContext?.identity?.sourceIp||'unknown';
   const ipHash=createHmac('sha256',env.ADMIN_SESSION_SECRET).update(ip).digest('hex');
   const [attempt]=await sql.query(`INSERT INTO raiz_nudo.admin_login_attempts(ip_hash) VALUES ($1)
    ON CONFLICT(ip_hash) DO UPDATE SET attempts=CASE WHEN admin_login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE admin_login_attempts.attempts+1 END,
    window_start=CASE WHEN admin_login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE admin_login_attempts.window_start END RETURNING attempts`,[ipHash]);
   if(attempt.attempts>10)throw new HttpError(429,'Demasiados intentos. Intenta en 15 minutos.');
   if(typeof input.password!=='string'||!equal(input.password,env.ADMIN_PASSWORD))throw new HttpError(401,'Contraseña incorrecta');
   await sql.query('DELETE FROM raiz_nudo.admin_login_attempts WHERE ip_hash=$1',[ipHash]);
   return result(200,{authenticated:true},{'Set-Cookie':cookie(token(env),headers)});
  }
  if(!authenticated(headers,env))throw new HttpError(401,'Inicia sesión para continuar');
  if(action==='session'&&event.httpMethod==='GET')return result(200,{authenticated:true});
  if(action==='logout'&&event.httpMethod==='POST')return result(200,{authenticated:false},{'Set-Cookie':cookie('',headers,true)});
  const sql=getSql(),params=event.queryStringParameters||{};
  if(action==='list'&&event.httpMethod==='GET'){
   const search=String(params.search||'').trim().slice(0,100),status=params.status||'';
   if(status&&!STATUSES.includes(status))throw new HttpError(400,'Estado inválido');
   const page=Math.max(1,Math.min(10000,Number.parseInt(params.page)||1));
   const args=['%'+search+'%',status];
   const where="WHERE (o.folio ILIKE $1 OR o.customer->>'name' ILIKE $1 OR o.customer->>'phone' ILIKE $1) AND ($2='' OR o.status=$2)";
   const items=await sql.query(`SELECT o.id,o.folio,o.created_at,o.customer->>'name' AS name,o.customer->>'phone' AS phone,o.status,o.product_cents,o.deposit_cents,o.paid_at,o.production_due,o.revision,n.state AS email_state
    FROM raiz_nudo.orders o LEFT JOIN raiz_nudo.email_notifications n ON n.order_id=o.id ${where} ORDER BY o.created_at DESC LIMIT 25 OFFSET $3`,[...args,(page-1)*25]);
   const [count]=await sql.query(`SELECT count(*)::int AS total FROM raiz_nudo.orders o ${where}`,args);
   return result(200,{items,total:count.total,page,pageSize:25,statuses:STATUSES});
  }
  if(action==='detail'&&event.httpMethod==='GET'){
   const id=uuid(params.id);
   const [order]=await sql.query(`SELECT o.id,o.folio,o.created_at,o.customer,o.delivery,o.design,o.product_cents,o.deposit_cents,o.shipping_cents,o.status,o.paid_at,o.production_due,o.revision,n.state AS email_state,n.attempts AS email_attempts,n.sent_at AS email_sent_at,n.last_error AS email_error
    FROM raiz_nudo.orders o LEFT JOIN raiz_nudo.email_notifications n ON n.order_id=o.id WHERE o.id=$1`,[id]);
   if(!order)throw new HttpError(404,'Pedido no encontrado');
   const events=await sql.query('SELECT status,created_at FROM raiz_nudo.order_events WHERE order_id=$1 ORDER BY created_at,id',[id]);
   return result(200,{order,events,mailConfigured:Boolean(env.RESEND_API_KEY&&env.MAIL_FROM)});
  }
  if(['status','deposit'].includes(action)&&event.httpMethod==='POST'){
   const id=uuid(input.id);
   if(!Number.isInteger(input.revision)||input.revision<0)throw new HttpError(400,'Versión inválida');
   if(action==='status'&&!STATUSES.includes(input.status))throw new HttpError(400,'Estado inválido');
   const status=action==='deposit'?'Confirmado':input.status;
   const needsPaid=['Confirmado','En producción','Listo','Enviado','Entregado'].includes(status);
   // Compare-and-swap plus event insert are one SQL statement. A stale page
   // cannot silently overwrite another update or restart the production clock.
   const rows=await sql.query(`WITH changed AS (
    UPDATE raiz_nudo.orders SET status=$3,revision=revision+1,
      paid_at=CASE WHEN $4 THEN now() ELSE paid_at END,
      production_due=CASE WHEN $4 THEN (now() AT TIME ZONE $6)::date+7 ELSE production_due END
    WHERE id=$1 AND revision=$2 AND (NOT $5 OR paid_at IS NOT NULL OR $4) AND (NOT $4 OR paid_at IS NULL)
    RETURNING id,status,revision,paid_at,production_due
   ), logged AS (INSERT INTO raiz_nudo.order_events(order_id,status) SELECT id,status FROM changed RETURNING id)
   SELECT * FROM changed`,[id,input.revision,status,action==='deposit',needsPaid,env.BUSINESS_TIME_ZONE||'America/Mexico_City']);
   if(!rows.length)throw new HttpError(409,'El pedido cambió o falta registrar el anticipo. Actualiza el detalle.');
   return result(200,{order:rows[0]});
  }
  if(action==='retry-email'&&event.httpMethod==='POST'){
   const id=uuid(input.id);
   const [order]=await sql.query('SELECT id FROM raiz_nudo.orders WHERE id=$1',[id]);
   if(!order)throw new HttpError(404,'Pedido no encontrado');
   if(!env.RESEND_API_KEY||!env.MAIL_FROM)throw new HttpError(503,'Configura RESEND_API_KEY y MAIL_FROM para enviar correos.');
   await sql.query(`INSERT INTO raiz_nudo.email_notifications(order_id) VALUES ($1) ON CONFLICT(order_id) DO UPDATE SET next_attempt_at=now()
    WHERE email_notifications.state IN ('pending','failed')`,[id]);
   const delivery=await notify(sql,id,{env});
   return result(200,{delivery});
  }
  throw new HttpError(404,'Acción no disponible');
 }catch(e){if(e instanceof HttpError)return result(e.status,{error:e.message});console.error('admin_failed',e.code||e.name);return result(503,{error:'No se pudo completar la operación. Inténtalo de nuevo.'})}
};}
module.exports={createAdminHandler,token,authenticated,configured};
