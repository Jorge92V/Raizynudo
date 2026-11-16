const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { validate,createHandler }=require('../server/orders.cjs');
const payload=()=>({requestKey:randomUUID(),client:{name:'Cliente prueba',phone:'5512345678',use:'Uso personal'},delivery:{method:'shipping',city:'Ciudad de México',zip:'01000',address:'Domicilio de prueba'},design:{mode:'v',largo:40,ancho:30,grosor:3,vT:2,hT:1,grid:[['nogal','parota']],extras:[]}});
const event=body=>({httpMethod:'POST',body:JSON.stringify(body)});
test('servidor calcula precio, 30% y envío pendiente sin confiar en importes del cliente',()=>{
 const p=payload();p.amount=.01;const o=validate(p);
 assert.ok(o.productCents>100);assert.equal(o.depositCents,Math.round(o.productCents*.3));assert.equal(o.delivery.shippingCost,null);
 p.delivery.method='pickup';assert.equal(validate(p).delivery.shippingCost,0);
});
test('rechaza medidas, maderas, extras y entregas inválidas',()=>{
 for(const change of [p=>p.design.grid[0][0]='desconocida',p=>p.design.grid[0].pop(),p=>p.design.grosor=2.1,p=>{p.design.grosor=2;p.design.extras=['agarra']},p=>p.design.extras=['gratis'],p=>p.delivery.zip='123']){
  const p=payload();change(p);assert.throws(()=>validate(p));
 }
});
test('valida los tres modos y el grabado dentro de la tabla',()=>{
 const p=payload();p.design={...p.design,mode:'b',vT:2,hT:2,grid:[['nogal','parota'],['parota','nogal']]};assert.doesNotThrow(()=>validate(p));
 p.design.grid[1][1]='parota';assert.throws(()=>validate(p));
 p.design={...payload().design,mode:'h',vT:1,hT:2,grid:[['nogal'],['parota']]};assert.doesNotThrow(()=>validate(p));
 p.design.extras=['grabado'];p.design.engraving={image:'data:image/png;base64,aW52YWxpZA==',x:50,y:50,sizeCm:6};assert.throws(()=>validate(p));
});
test('no guarda precios alterados y no filtra fallos de la BD',async()=>{
 const p=payload();p.expectedAmountCents=1;
 const handler=createHandler(()=>{throw Error('private connection')});
 assert.equal((await handler(event(p))).statusCode,409);
 p.expectedAmountCents=validate(p).productCents;
 const res=await handler(event(p));assert.equal(res.statusCode,503);assert.ok(!res.body.includes('private connection'));
 assert.equal((await handler({httpMethod:'GET'})).statusCode,405);
 assert.equal((await handler({httpMethod:'POST',body:'{bad'})).statusCode,400);
});

test('el fallo del correo no impide confirmar un pedido guardado',async()=>{
 const p=payload();p.expectedAmountCents=validate(p).productCents;
 const handler=createHandler(()=>({query:async(q,args)=>[{id:args[0],folio:'RN-TEST',fingerprint:args[2],product_cents:p.expectedAmountCents,deposit_cents:Math.round(p.expectedAmountCents*.3),shipping_cents:null,status:'Recibido'}]}),async()=>{throw Error('mail unavailable')});
 const response=await handler(event(p));assert.equal(response.statusCode,200);assert.equal(JSON.parse(response.body).folio,'RN-TEST');
});
