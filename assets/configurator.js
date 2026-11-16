var WOODS=[
  {id:'nogal', name:'Nogal', tier:'$$$', ppt:147.00*1.16, c:['#3d2213','#6b3f28','#4b2c1a']},
  {id:'tzalam',name:'Tzalam',tier:'$$',  ppt:83.46*1.16,  c:['#4a2c18','#7a4e32','#5a3620']},
  {id:'parota',name:'Parota',tier:'$$',  ppt:78.45*1.16,  c:['#7a4e28','#b07d4f','#8b5e35']},
  {id:'fresno',name:'Fresno',tier:'$$',  ppt:72.41*1.16,  c:['#b89572','#dfc4a0','#c8a882']},
  {id:'encino',name:'Encino',tier:'$',   ppt:51.72*1.16,  c:['#8c6640','#c8966a','#a07850']}
];
var MERMA={v:{l:2,a:2,g:0.5},h:{l:2,a:2,g:0.5},b:{l:4,a:4,g:0.5}};
var LIMITS={v:{maxV:20,maxH:1},h:{maxV:1,maxH:15},b:{maxV:10,maxH:10}};
var FACTOR={v:3.7,h:3.7,b:4.2};
var MAX_ENG_CM=10,MIN_GROSOR_AGARRA=3;

function calcPT(l,a,g){return(g/2.54)*(a/2.54)*(l/30.48)/12;}
function clamp(v,mn,mx){return Math.min(mx,Math.max(mn,v));}
function gw(id){return WOODS.filter(function(w){return w.id===id;})[0];}

var mode='v',largo=40,ancho=30,grosor=3;
var vT=2,hT=1,activeWood=WOODS[0].id;
var cw1=WOODS[0].id,cw2=WOODS[2].id;
var painting=false,grid=[];
var engImg=null,engPx=50,engPy=50,engSz=60;
var dragEng=false,dragOX=0,dragOY=0;
var ownerMode=false;

var canvas=document.getElementById('board-canvas');
var overlay=document.getElementById('engraving-overlay');
var ctx=canvas.getContext('2d');
var octx=overlay.getContext('2d');
var priceCard=document.getElementById('price-card');

function cols(){return mode==='h'?1:vT;}
function rows(){return mode==='v'?1:hT;}
function grabadoOn(){return document.getElementById('card-grabado').classList.contains('on');}

priceCard.addEventListener('owner-disabled',function(){
  ownerMode=!ownerMode;
  priceCard.classList.toggle('owner-mode',ownerMode);
  calcPrice();
});

function updateAgarradera(){
  var card=document.getElementById('card-agarra');
  var note=document.getElementById('agarra-note');
  var locked=grosor<MIN_GROSOR_AGARRA;
  card.classList.toggle('locked',locked);
  note.style.display=locked?'block':'none';
  if(locked&&card.classList.contains('on')){card.classList.remove('on');calcPrice();}
}

function setMode(m,el){
  mode=m;
  document.querySelectorAll('.mode-btn').forEach(function(b){b.classList.remove('active');});
  el.classList.add('active');
  vT=clamp(vT,1,LIMITS[mode].maxV);
  hT=clamp(hT,1,LIMITS[mode].maxH);
  buildPal();buildTiras();initGrid();
}

function onDim(){
  largo=clamp(parseFloat(document.getElementById('iL').value)||40,15,120);
  ancho=clamp(parseFloat(document.getElementById('iA').value)||30,15,60);
  grosor=clamp(parseFloat(document.getElementById('iG').value)||3,1.5,4);
  updateAgarradera();
  resizeCv();draw();updateOverlay();calcPrice();
}

function buildPal(){
  var lbl=document.getElementById('pal-label');
  var cnt=document.getElementById('pal-content');
  var hint=document.getElementById('board-hint');
  if(mode==='b'){
    lbl.textContent='Elige 2 maderas para el patron ajedrez';
    hint.textContent='El patron ajedrez se genera automaticamente';
    cnt.innerHTML=chessHTML();refreshMini();
  } else {
    lbl.textContent='Madera activa';
    hint.textContent='Haz clic o arrastra para pintar cada seccion';
    cnt.innerHTML='<div class="palette-wrap" id="chips"></div>';
    WOODS.forEach(function(w){
      var d=document.createElement('div');
      d.className='wood-chip'+(w.id===activeWood?' active':'');
      d.dataset.id=w.id;
      d.innerHTML='<span class="wood-dot" style="background:'+w.c[1]+'"></span>'+w.name+'<span class="wood-tier">'+w.tier+'</span>';
      d.onclick=function(){activeWood=w.id;document.querySelectorAll('.wood-chip').forEach(function(c){c.classList.toggle('active',c.dataset.id===w.id);});};
      document.getElementById('chips').appendChild(d);
    });
  }
}

function chessHTML(){
  var a='',b='';
  WOODS.forEach(function(w){
    a+='<div class="chess-chip'+(w.id===cw1?' selected':'')+(w.id===cw2?' disabled':'')+'" onclick="pickChess(\'A\',\''+w.id+'\')"><span class="chess-swatch" style="background:'+w.c[1]+'"></span>'+w.name+' <span class="wood-tier">'+w.tier+'</span></div>';
    b+='<div class="chess-chip'+(w.id===cw2?' selected':'')+(w.id===cw1?' disabled':'')+'" onclick="pickChess(\'B\',\''+w.id+'\')"><span class="chess-swatch" style="background:'+w.c[1]+'"></span>'+w.name+' <span class="wood-tier">'+w.tier+'</span></div>';
  });
  return '<div class="chess-wrap"><div><div class="chess-slot-label">Madera A</div><div class="chess-chips">'+a+'</div></div><div class="chess-mid"><div class="chess-mini" id="chess-mini"></div><div class="chess-mid-label">patron</div></div><div><div class="chess-slot-label">Madera B</div><div class="chess-chips">'+b+'</div></div></div>';
}
function refreshMini(){
  var m=document.getElementById('chess-mini');if(!m)return;
  var wA=gw(cw1),wB=gw(cw2);
  m.innerHTML='<div style="background:'+wA.c[1]+'"></div><div style="background:'+wB.c[1]+'"></div><div style="background:'+wB.c[1]+'"></div><div style="background:'+wA.c[1]+'"></div>';
}
function pickChess(slot,id){
  if(slot==='A'&&id===cw2)return;if(slot==='B'&&id===cw1)return;
  if(slot==='A')cw1=id;else cw2=id;
  buildPal();applyChess();
}

function buildTiras(){
  var r=document.getElementById('tiras-row');r.innerHTML='';
  var lim=LIMITS[mode];
  if(mode==='v'||mode==='b')r.innerHTML+=tg('v','Verticales',vT,1,lim.maxV);
  if(mode==='b')r.innerHTML+='<div class="tiras-sep"></div>';
  if(mode==='h'||mode==='b')r.innerHTML+=tg('h','Horizontales',hT,1,lim.maxH);
}
function tg(ax,lbl,val,mn,mx){
  return '<div class="tiras-group"><span class="tiras-lbl">'+lbl+'</span><button class="ctrl-btn" '+(val<=mn?'disabled':'')+' onclick="chT(\''+ax+'\',-1)">-</button><span class="tiras-n">'+val+'</span><button class="ctrl-btn" '+(val>=mx?'disabled':'')+' onclick="chT(\''+ax+'\',1)">+</button><span class="tiras-max">max '+mx+'</span></div>';
}
function chT(ax,d){
  var lim=LIMITS[mode];
  if(ax==='v')vT=clamp(vT+d,1,lim.maxV);else hT=clamp(hT+d,1,lim.maxH);
  buildTiras();
  if(mode==='b')applyChess();else initGrid();
}

function initGrid(){
  var old=grid;grid=[];
  var R=rows(),C=cols();
  for(var i=0;i<R;i++){grid[i]=[];for(var j=0;j<C;j++)grid[i][j]=(old[i]&&old[i][j])||activeWood;}
  if(mode==='b')applyChess();else{resizeCv();draw();updateOverlay();calcPrice();}
}
function applyChess(){
  var R=rows(),C=cols();grid=[];
  for(var r=0;r<R;r++){grid[r]=[];for(var c=0;c<C;c++)grid[r][c]=(r+c)%2===0?cw1:cw2;}
  resizeCv();draw();updateOverlay();calcPrice();
}

function resizeCv(){
  var maxW=Math.min(560,window.innerWidth-60),maxH=260,asp=largo/ancho;
  var w=Math.min(maxW,maxH*asp),h=w/asp;
  if(h>maxH){h=maxH;w=h*asp;}
  var W=Math.round(w),H=Math.round(h);
  canvas.width=W;canvas.height=H;overlay.width=W;overlay.height=H;
}
function drawCell(x,y,w,h,wood){
  var g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,wood.c[1]);g.addColorStop(.5,wood.c[2]);g.addColorStop(1,wood.c[0]);
  ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
  ctx.strokeStyle=wood.c[0];ctx.lineWidth=0.8;ctx.globalAlpha=0.22;
  var steps=Math.max(2,Math.round(h/13));
  for(var i=1;i<steps;i++){var gy=y+h*i/steps;ctx.beginPath();ctx.moveTo(x+3,gy);ctx.lineTo(x+w-3,gy);ctx.stroke();}
  ctx.globalAlpha=1;ctx.restore();
  if(w>30&&h>13){
    ctx.font='700 '+Math.max(7,Math.min(11,w/5))+'px system-ui';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=wood.id==='fresno'?'rgba(50,25,5,.75)':'rgba(255,255,255,.88)';
    ctx.fillText(wood.name,x+w/2,y+h/2);
  }
}
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  var R=rows(),C=cols(),cw=canvas.width/C,ch=canvas.height/R;
  for(var r=0;r<R;r++)for(var c=0;c<C;c++){
    var x=c*cw,y=r*ch,w=cw,h=ch;
    var wid=grid[r]&&grid[r][c];
    if(wid){drawCell(x,y,w,h,gw(wid));}
    else{
      ctx.fillStyle='#e0d8cf';ctx.fillRect(x,y,w,h);
      if(w>44&&h>15){ctx.font='9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(0,0,0,.2)';ctx.fillText('clic',x+w/2,y+h/2);}
    }
    ctx.strokeStyle='rgba(255,255,255,.38)';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  }
  ctx.strokeStyle='rgba(80,40,20,.3)';ctx.lineWidth=2;ctx.strokeRect(1,1,canvas.width-2,canvas.height-2);
}

function getEngSizePx(){var pxPerCm=Math.min(canvas.width/largo,canvas.height/ancho);return(engSz/100)*MAX_ENG_CM*pxPerCm;}
function getEngPos(){var sz=getEngSizePx(),cx=(engPx/100)*canvas.width,cy=(engPy/100)*canvas.height;return{cx:cx,cy:cy,sz:sz,x:cx-sz/2,y:cy-sz/2};}
function updateOverlay(){
  octx.clearRect(0,0,overlay.width,overlay.height);if(!grabadoOn())return;
  var px=parseInt(document.getElementById('pos-x').value),py=parseInt(document.getElementById('pos-y').value),sz=parseInt(document.getElementById('eng-size').value);
  engPx=px;engPy=py;engSz=sz;
  document.getElementById('lbl-px').textContent=px<25?'izquierda':px>75?'derecha':'centro';
  document.getElementById('lbl-py').textContent=py<25?'arriba':py>75?'abajo':'centro';
  document.getElementById('lbl-size').textContent='~'+((sz/100)*MAX_ENG_CM).toFixed(1)+'x'+((sz/100)*MAX_ENG_CM).toFixed(1)+' cm';
  var ep=getEngPos(),s=ep.sz,ex=ep.x,ey=ep.y,cx=ep.cx,cy=ep.cy;
  if(engImg){octx.save();octx.globalAlpha=0.85;octx.beginPath();octx.rect(2,2,overlay.width-4,overlay.height-4);octx.clip();var ar=engImg.width/engImg.height;var dw=ar>=1?s:s*ar,dh=ar>=1?s/ar:s;octx.drawImage(engImg,cx-dw/2,cy-dh/2,dw,dh);octx.restore();}
  octx.strokeStyle='rgba(160,103,74,0.85)';octx.lineWidth=1.5;octx.setLineDash([4,3]);octx.strokeRect(ex+.5,ey+.5,s-1,s-1);octx.setLineDash([]);
  if(!engImg){octx.fillStyle='rgba(160,103,74,0.12)';octx.fillRect(ex,ey,s,s);octx.fillStyle='rgba(160,103,74,0.7)';octx.font=Math.max(9,s/6)+'px system-ui';octx.textAlign='center';octx.textBaseline='middle';octx.fillText('grabado',cx,cy);}
}

function canvasCoords(e){var rect=canvas.getBoundingClientRect();return{x:(e.clientX-rect.left)*(canvas.width/rect.width),y:(e.clientY-rect.top)*(canvas.height/rect.height)};}
function inEngRect(x,y){if(!grabadoOn())return false;var ep=getEngPos();return x>=ep.x&&x<=ep.x+ep.sz&&y>=ep.y&&y<=ep.y+ep.sz;}
function paintCell(x,y){
  if(mode==='b')return;
  var c=clamp(Math.floor(x/(canvas.width/cols())),0,cols()-1);
  var r=clamp(Math.floor(y/(canvas.height/rows())),0,rows()-1);
  if(grid[r][c]===activeWood)return;
  grid[r][c]=activeWood;draw();calcPrice();
}

canvas.style.cursor='crosshair';
canvas.addEventListener('mousedown',function(e){var p=canvasCoords(e);if(grabadoOn()&&inEngRect(p.x,p.y)){dragEng=true;var ep=getEngPos();dragOX=p.x-ep.cx;dragOY=p.y-ep.cy;canvas.style.cursor='grabbing';}else{painting=true;paintCell(p.x,p.y);}});
canvas.addEventListener('mousemove',function(e){var p=canvasCoords(e);if(dragEng){var nx=clamp(((p.x-dragOX)/canvas.width)*100,0,100),ny=clamp(((p.y-dragOY)/canvas.height)*100,0,100);document.getElementById('pos-x').value=nx;document.getElementById('pos-y').value=ny;engPx=nx;engPy=ny;updateOverlay();}else if(painting){paintCell(p.x,p.y);}else{canvas.style.cursor=(grabadoOn()&&inEngRect(p.x,p.y))?'grab':'crosshair';}});
canvas.addEventListener('mouseup',function(){dragEng=false;painting=false;canvas.style.cursor='crosshair';});
canvas.addEventListener('mouseleave',function(){dragEng=false;painting=false;});
canvas.addEventListener('touchstart',function(e){e.preventDefault();var p=canvasCoords(e.touches[0]);if(grabadoOn()&&inEngRect(p.x,p.y)){dragEng=true;var ep=getEngPos();dragOX=p.x-ep.cx;dragOY=p.y-ep.cy;}else{painting=true;paintCell(p.x,p.y);}},{passive:false});
canvas.addEventListener('touchmove',function(e){e.preventDefault();var p=canvasCoords(e.touches[0]);if(dragEng){var nx=clamp(((p.x-dragOX)/canvas.width)*100,0,100),ny=clamp(((p.y-dragOY)/canvas.height)*100,0,100);document.getElementById('pos-x').value=nx;document.getElementById('pos-y').value=ny;engPx=nx;engPy=ny;updateOverlay();}else if(painting){paintCell(p.x,p.y);}},{passive:false});
canvas.addEventListener('touchend',function(){dragEng=false;painting=false;});

function toggleExt(el){
  if(el.classList.contains('locked'))return;
  el.classList.toggle('on');
  if(el.dataset.key==='grabado'){document.getElementById('grabado-panel').classList.toggle('visible',el.classList.contains('on'));updateOverlay();}
  calcPrice();
}
function onFileSelect(e){
  var file=e.target.files[0];if(!file)return;if(!['image/png','image/jpeg'].includes(file.type)||file.size>1500000){alert('Usa una imagen PNG o JPG de hasta 1.5 MB para esta demo.');e.target.value='';return;}
  var reader=new FileReader();
  reader.onload=function(ev){var img=new Image();img.onload=function(){engImg=img;document.getElementById('img-thumb').src=ev.target.result;document.getElementById('img-name').textContent=file.name;document.getElementById('img-preview-row').style.display='flex';document.getElementById('pos-controls-wrap').style.display='block';updateOverlay();};img.src=ev.target.result;};
  reader.readAsDataURL(file);
}
function removeImage(){engImg=null;document.getElementById('img-thumb').src='';document.getElementById('img-preview-row').style.display='none';document.getElementById('pos-controls-wrap').style.display='none';document.getElementById('file-input').value='';updateOverlay();}

function calcPrice(){
  var out=document.getElementById('price-out');
  var R=rows(),C=cols(),m=MERMA[mode];
  var lM=largo+m.l,aM=ancho+m.a,gM=grosor+m.g;
  var tL=lM/C,tA=aM/R;
  var factor=FACTOR[mode];
  var tally={};
  for(var r=0;r<R;r++)for(var c=0;c<C;c++){var wid=grid[r]&&grid[r][c];if(!wid)continue;tally[wid]=(tally[wid]||0)+1;}
  if(!Object.keys(tally).length){out.innerHTML='<p class="empty-msg">Asigna al menos una madera para ver el precio</p>';return;}
  var totalCells=R*C;
  var woodBase=0,ptTotal=0,woodData=[];
  Object.keys(tally).forEach(function(wid){
    var cnt=tally[wid],w=gw(wid),pies=calcPT(tL,tA,gM)*cnt,cost=pies*w.ppt;
    woodBase+=cost;ptTotal+=pies;
    woodData.push({w:w,pies:pies,cost:cost,cnt:cnt,pct:Math.round(cnt/totalCells*100)});
  });
  var conMO=woodBase*factor;
  var extTotal=0,extNames=[];
  document.querySelectorAll('.ext-card.on').forEach(function(el){extTotal+=+el.dataset.p;extNames.push(el.querySelector('.ext-name').textContent);});
  var total=conMO+extTotal;

  var clientLines='';
  woodData.forEach(function(d){clientLines+='<div class="pline sub"><span><span class="pdot" style="background:'+d.w.c[1]+'"></span>'+d.w.name+' '+d.w.tier+' · '+d.pct+'%</span><span>'+d.pies.toFixed(3)+' pt</span></div>';});
  extNames.forEach(function(n){clientLines+='<div class="pline"><span>'+n+'</span><span>seleccionado</span></div>';});

  var ownerLines='';
  woodData.forEach(function(d){ownerLines+='<div class="pline sub"><span><span class="pdot" style="background:'+d.w.c[1]+'"></span>'+d.w.name+' · '+d.pct+'% · '+d.pies.toFixed(3)+' pt</span><span>$'+d.cost.toFixed(2)+'</span></div>';});
  var extOwnerLines='';
  document.querySelectorAll('.ext-card.on').forEach(function(el){var p=+el.dataset.p;extOwnerLines+='<div class="pline"><span>'+el.querySelector('.ext-name').textContent+'</span><span>+ $'+p+'.00</span></div>';});

  out.innerHTML=
    '<div class="price-header">'+
      '<span class="price-title">Precio estimado <span class="owner-badge">vista dueno</span></span>'+
      '<span class="price-total"><span class="price-cur">MXN $</span>'+total.toFixed(2)+'</span>'+
    '</div>'+
    '<div class="price-bd">'+
      '<div class="pline"><span>Dimensiones · '+largo+'x'+ancho+'x'+grosor+' cm</span><span>'+ptTotal.toFixed(3)+' pt total</span></div>'+
      clientLines+
      '<div class="owner-section">'+
        '<div class="pline" style="margin-top:6px;padding-top:6px;border-top:1px dashed #e0d8d0"><span>Costo madera (con IVA)</span><span>$'+woodBase.toFixed(2)+'</span></div>'+
        ownerLines+
        '<div class="pline"><span>x Mano de obra x'+factor+' (aceite y cera)</span><span>$'+conMO.toFixed(2)+'</span></div>'+
        extOwnerLines+
      '</div>'+
      '<div class="pline tot"><span>Total</span><span>$'+total.toFixed(2)+'</span></div>'+
    '</div>'+
    '<div class="merma-note owner-section">Dims. con merma: '+lM.toFixed(1)+'x'+aM.toFixed(1)+'x'+gM.toFixed(1)+' cm · IVA incluido</div>';
}

window.addEventListener('resize',function(){resizeCv();draw();updateOverlay();});
buildPal();buildTiras();initGrid();updateAgarradera();
