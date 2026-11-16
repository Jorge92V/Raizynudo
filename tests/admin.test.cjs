const { test }=require('node:test');
const assert=require('node:assert/strict');
const { token,authenticated,createAdminHandler }=require('../server/admin.cjs');
const env={ADMIN_PASSWORD:'test-password-long-enough',ADMIN_SESSION_SECRET:'test-session-secret-at-least-thirty-two-characters'};
const headers={host:'example.com',origin:'https://example.com','x-admin-request':'1'};
const event=(action,method='GET',body={})=>({httpMethod:method,headers,queryStringParameters:{action},body:JSON.stringify(body)});
test('sesión firmada expira y la rotación de contraseña invalida cookies',()=>{
 const now=Date.now(),value=token(env,now),cookie={cookie:'rn_admin='+value};
 assert.equal(authenticated(cookie,env,now),true);
 assert.equal(authenticated(cookie,env,now+8*3600000+1),false);
 assert.equal(authenticated({cookie:'rn_admin='+value+'x'},env,now),false);
 assert.equal(authenticated(cookie,{...env,ADMIN_PASSWORD:'a-different-password'},now),false);
});
test('listado, detalle y cambios privados no consultan BD sin sesión',async()=>{
 const handler=createAdminHandler(()=>{throw Error('Must not query DB')},{env});
 for(const action of ['list','detail','status','deposit','retry-email']){
  assert.equal((await handler(event(action,['status','deposit','retry-email'].includes(action)?'POST':'GET'))).statusCode,401);
 }
});
test('login rechaza CSRF, contraseña incorrecta y exceso de intentos',async()=>{
 const sql={query:async()=>[{attempts:1}]};const handler=createAdminHandler(()=>sql,{env});
 let e=event('login','POST',{password:env.ADMIN_PASSWORD});e.headers={...headers,origin:'https://untrusted.com'};
 assert.equal((await handler(e)).statusCode,403);
 assert.equal((await handler(event('login','POST',{password:'incorrect'}))).statusCode,401);
 const limited=createAdminHandler(()=>({query:async()=>[{attempts:11}]}),{env});
 assert.equal((await limited(event('login','POST',{password:env.ADMIN_PASSWORD}))).statusCode,429);
});
test('login crea cookie HttpOnly Secure y logout la elimina',async()=>{
 const handler=createAdminHandler(()=>({query:async()=>[{attempts:1}]}),{env});
 const logged=await handler(event('login','POST',{password:env.ADMIN_PASSWORD}));
 assert.equal(logged.statusCode,200);assert.match(logged.headers['Set-Cookie'],/HttpOnly; SameSite=Strict.*Secure/);
 const e=event('logout','POST');e.headers={...headers,cookie:logged.headers['Set-Cookie'].split(';')[0]};
 const logout=await handler(e);assert.match(logout.headers['Set-Cookie'],/Max-Age=0/);
});
