const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
test('formulario de envío local conserva colonia y dirección al volver entre pasos',()=>{
 const nodes=new Map();const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',hidden:false,offsetTop:10});return nodes.get(id)};
 const context=vm.createContext({
  document:{getElementById:node,querySelectorAll:()=>[]},window:{scrollTo(){}},
  RNRepository:{listOrders:()=>[],saveDraft(){}},RNDelivery:require('../assets/delivery'),
  mode:'v',largo:40,ancho:30,grosor:3,vT:2,hT:1,grid:[['nogal','parota']],cw1:'nogal',cw2:'parota',engPx:50,engPy:50,engSz:60,engImg:null,
 });
 const source=readFileSync('assets/flow.js','utf8').split('// Restore the local draft')[0];
 vm.runInContext(source,context);
 vm.runInContext('go(2)',context);
 assert.match(node('checkout').innerHTML,/Envío local a tu puerta/);
 assert.match(node('checkout').innerHTML,/Colonia o zona/);
 assert.doesNotMatch(node('checkout').innerHTML,/value="pickup"/);
 for(const [id,value] of Object.entries({city:'Monterrey',zone:'Centro',zip:'64000',address:'Calle de prueba 123'}))node(id).value=value;
 vm.runInContext('go(1)',context);
 assert.equal(vm.runInContext('delivery.zone',context),'Centro');
 assert.equal(vm.runInContext('delivery.method',context),'shipping');
 vm.runInContext('go(2)',context);
 assert.match(node('checkout').innerHTML,/value="Centro"/);
 assert.match(node('checkout').innerHTML,/Calle de prueba 123/);
});
