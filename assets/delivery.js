/* Shared coverage for the local delivery form and server validation. */
(function(root){
 'use strict';
 const MUNICIPALITIES=Object.freeze([
  'Monterrey','Guadalupe','San Nicolás de los Garza','San Pedro Garza García',
  'Santa Catarina','Apodaca','General Escobedo','García','Juárez','Santiago',
  'Cadereyta Jiménez','Salinas Victoria','Pesquería','El Carmen',
  'Ciénega de Flores','General Zuazua','Hidalgo','Abasolo'
 ]);
 const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const municipality=value=>MUNICIPALITIES.find(name=>normalize(name)===normalize(value))||null;
 const api=Object.freeze({MUNICIPALITIES,municipality});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.RNDelivery=api;
})(typeof globalThis!=='undefined'?globalThis:this);
