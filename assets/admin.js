'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=cents=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(cents/100);
const date=value=>value?new Date(value).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}):'Pendiente';
const mailLabels={pending:'Pendiente',sending:'En proceso',failed:'Falló el envío',sent:'Aceptado por Resend'};
let page=1,total=0,current=null,busy=false;
function message(id,text,success=false){$(id).textContent=text;$(id).classList.toggle('success',success)}
async function api(action,{method='GET',data,params={}}={}){
 const query=new URLSearchParams({action,...params});
 const res=await fetch('/api/admin?'+query,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-Admin-Request':'1'},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(20000)});
 const body=await res.json();
 if(res.status===401&&action!=='login'){showLogin();throw Error('Tu sesión terminó. Inicia sesión de nuevo.')}
 if(!res.ok)throw Error(body.error||'No se pudo completar la operación.');
 return body;
}
function showLogin(){current=null;$('rows').replaceChildren();$('detail-body').replaceChildren();$('detail').close();$('login-view').hidden=false;$('dashboard').hidden=true;$('logout').hidden=true}
async function showDashboard(){$('login-view').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;$('password').value='';await list()}
async function list(){
 message('message','Cargando pedidos…',true);
 try{
  const data=await api('list',{params:{page,search:$('search').value.trim(),status:$('status').value}});total=data.total;
  if($('status').options.length===1)data.statuses.forEach(s=>{const option=new Option(s,s);$('status').add(option)});
  $('rows').innerHTML=data.items.map(o=>`<tr><td><button data-order="${esc(o.id)}">${esc(o.folio)}</button><small>${esc(date(o.created_at))}</small></td><td>${esc(o.name)}<small>${esc(o.phone)}</small></td><td>${money(o.product_cents)}<small>${o.paid_at?'Anticipo recibido':'Anticipo pendiente'}</small></td><td><span class="badge">${esc(o.status)}</span></td><td><span class="badge ${o.email_state==='failed'?'email-failed':''}">${esc(mailLabels[o.email_state]||'Sin aviso')}</span></td></tr>`).join('');
  $('rows').querySelectorAll('[data-order]').forEach(button=>button.addEventListener('click',()=>detail(button.dataset.order)));
  $('empty').hidden=data.items.length>0;$('previous').disabled=page===1;$('following').disabled=page*25>=total;
  $('page-label').textContent=`Página ${page} · ${total} pedido${total===1?'':'s'}`;message('message','');
 }catch(e){message('message',e.message)}
}
const line=(name,value)=>`<div class="line"><span>${esc(name)}</span><span>${esc(value)}</span></div>`;
function board(d){
 const colors={nogal:'#6b3f28',tzalam:'#7a4e32',parota:'#b07d4f',fresno:'#c8a882',encino:'#a07850'};
 const g=d.engraving;
 return `<div class="board" role="img" aria-label="Diseño de la tabla" style="aspect-ratio:${Number(d.largo)}/${Number(d.ancho)};grid-template-columns:repeat(${Number(d.vT)},1fr);grid-template-rows:repeat(${Number(d.hT)},1fr)">${d.grid.flat().map(w=>`<div class="cell" style="background-color:${colors[w]||'#888'}">${esc(w)}</div>`).join('')}${g?`<img class="engraving" alt="Grabado del pedido" src="${esc(g.image)}" style="left:${Number(g.x)}%;top:${Number(g.y)}%;width:${Number(g.sizeCm)/Number(d.largo)*100}%;height:${Number(g.sizeCm)/Number(d.ancho)*100}%">`:''}</div>`;
}
async function detail(id){
 if(!$('detail').open)$('detail').showModal();
 $('detail-body').textContent='Cargando detalle…';message('detail-message','');
 try{
  const data=await api('detail',{params:{id}}),o=data.order,c=o.customer,d=o.design,e=o.delivery;current=o;
  $('detail-body').innerHTML=`<h2>${esc(o.folio)}</h2><p>${esc(date(o.created_at))} · <span class="badge">${esc(o.status)}</span></p>${board(d)}<div class="detail-grid"><section class="card"><h3>Cliente</h3>${line('Nombre',c.name)}${line('WhatsApp',c.phone)}${line('Correo',c.email||'No indicado')}${line('Uso',c.use)}${line('Fecha deseada',c.date||'No indicada')}${line('Comentarios',c.notes||'Sin comentarios')}</section><section class="card"><h3>Entrega e importes</h3>${line('Modalidad',e.method==='shipping'?'Envío a domicilio':'Recogida')}${line('Ciudad',e.city)}${line('Dirección',e.address||'No aplica')}${line('Código postal',e.zip||'No indicado')}${line('Producto',money(o.product_cents))}${line('Anticipo 30%',money(o.deposit_cents))}${line('Envío',o.shipping_cents===null?'Por cotizar':money(o.shipping_cents))}${line('Anticipo recibido',date(o.paid_at))}${line('Fabricación lista para',o.production_due?String(o.production_due).slice(0,10):'7 días naturales desde el anticipo')}</section><section class="card"><h3>Especificaciones</h3>${line('Medidas',`${d.largo} × ${d.ancho} × ${d.grosor} cm`)}${line('Patrón',({v:'Vertical',h:'Horizontal',b:'Ajedrez'})[d.mode])}${line('Maderas por fila',d.grid.map(row=>row.join(' / ')).join('\n'))}${line('Extras',d.extras.join(', ')||'Sin extras')}${d.engraving?line('Grabado',`${d.engraving.sizeCm} cm · X ${d.engraving.x}% / Y ${d.engraving.y}%`):''}${d.engraving?`<a class="download" href="${esc(d.engraving.image)}" download="grabado-${esc(o.id)}.${d.engraving.image.startsWith('data:image/png')?'png':'jpg'}">Descargar grabado original ↓</a>`:''}</section><section class="card"><h3>Notificación</h3>${line('Destino','mike.valleg4@gmail.com')}${line('Estado',mailLabels[o.email_state]||'Sin aviso')}${line('Intentos',o.email_attempts||0)}${line('Aceptado por servicio',o.email_sent_at?date(o.email_sent_at):'Pendiente')}${o.email_error?line('Último error',o.email_error):''}<p>${data.mailConfigured?'El envío no modifica el pedido.':'Falta configurar el servicio de correo en el servidor.'}</p><button id="retry-email" ${o.email_state==='sent'||!data.mailConfigured?'disabled':''}>Reintentar aviso</button></section></div><div class="actions"><form id="status-form"><div><label for="new-status">Estado del pedido</label><select id="new-status">${['Recibido','En revisión','Pendiente de anticipo','Confirmado','En producción','Listo','Enviado','Entregado'].map(s=>`<option ${s===o.status?'selected':''}>${s}</option>`).join('')}</select></div><button class="primary" type="submit">Guardar estado</button></form><button id="record-deposit" ${o.paid_at?'disabled':''}>${o.paid_at?'Anticipo registrado':'Registrar anticipo recibido'}</button></div><h3>Historial</h3><ul class="history">${data.events.map(item=>`<li>${esc(date(item.created_at))} · ${esc(item.status)}</li>`).join('')}</ul>`;
  $('status-form').addEventListener('submit',event=>{event.preventDefault();mutate('status',{status:$('new-status').value})});
  $('record-deposit').addEventListener('click',()=>{if(confirm(`¿Confirmas que recibiste ${money(o.deposit_cents)} de anticipo? Esto inicia los 7 días naturales de fabricación.`))mutate('deposit')});
  $('retry-email').addEventListener('click',()=>mutate('retry-email'));
 }catch(e){message('detail-message',e.message)}
}
async function mutate(action,extra={}){
 if(busy||!current)return;busy=true;
 const id=current.id,revision=current.revision;
 $('detail').querySelectorAll('button').forEach(b=>b.disabled=true);message('detail-message','Guardando…',true);
 try{
  const response=await api(action,{method:'POST',data:{id,revision,...extra}});
  await detail(id);await list();
  const state=response.delivery?.state;
  message('detail-message',action==='retry-email'?(state==='sent'?'Aviso aceptado por Resend.':state==='failed'?'No se pudo enviar el aviso. Puedes reintentarlo.':'No se envió otro aviso; revisa su estado.'):'Cambio guardado.',state!=='failed');
 }catch(e){await detail(id);message('detail-message',e.message)}
 finally{busy=false;$('close-detail').disabled=false}
}
$('login-form').addEventListener('submit',async event=>{
 event.preventDefault();const button=event.submitter;button.disabled=true;message('login-message','Verificando…',true);
 try{await api('login',{method:'POST',data:{password:$('password').value}});message('login-message','');await showDashboard()}catch(e){message('login-message',e.message)}finally{button.disabled=false}
});
$('logout').addEventListener('click',async()=>{try{await api('logout',{method:'POST',data:{}});showLogin()}catch(e){message('message',e.message)}});
$('close-detail').addEventListener('click',()=>$('detail').close());
$('filters').addEventListener('submit',event=>{event.preventDefault();page=1;list()});
$('refresh').addEventListener('click',list);
$('previous').addEventListener('click',()=>{if(page>1){page--;list()}});
$('following').addEventListener('click',()=>{if(page*25<total){page++;list()}});
(async()=>{try{await api('session');await showDashboard()}catch(e){if(!e.message.includes('Inicia sesión'))message('login-message',e.message)}})();
