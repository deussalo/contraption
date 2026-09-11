import { PARTS, WORLD, part, preset, dimensions, bounds } from './parts.js';
import { drawPart, drawGrid, drawAnnotations, drawSelection } from './draw.js';
import { WorkshopSound } from './sound.js';
import { createWorld, createBody, anchorBody, stepWorld, clamp } from './physics.js';

const $=id=>document.getElementById(id),canvas=$('workbench'),brush=canvas.getContext('2d'),sound=new WorkshopSound();
const STORAGE='contraption.workbench.v1',preferences='contraption.preferences.v1';
const machine=preset('scenic');
const state={...machine,annotated:true,selected:null,phase:'build',world:null,zoom:1,pan:{x:0,y:0},tool:'select',grid:true,history:[],future:[],particles:[],trail:[],sound:true};
let viewport={width:1,height:1,scale:1,x:0,y:0},drag=null,trayDrag=null,lastFrame=0,accumulator=0,toastTimer=0,wonShown=false;
const blueprint=()=>({name:state.name,number:state.number,parts:structuredClone(state.parts),annotated:state.annotated});
const snapshot=()=>({...blueprint(),phase:state.world?'paused':'build',world:structuredClone(state.world),selected:state.selected});
const visibleParts=()=>state.world?.parts??state.parts;
const wrappedAngle=angle=>((angle+180)%360+360)%360-180;
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function validateMachine(saved){
  if(saved.version!==1||!Array.isArray(saved.parts)||saved.parts.length>150||typeof saved.name!=='string')throw Error('The saved machine has an unsupported format.');
  for(const p of saved.parts){
    if(!PARTS[p.type]||typeof p.id!=='string'||!['x','y','angle'].every(k=>Number.isFinite(p[k]))||Math.abs(p.x)>3000||Math.abs(p.y)>3000||Math.abs(p.angle)>360)throw Error('The saved machine contains an invalid part.');
    for(const k of ['width','height'])if(p[k]!==undefined&&(!Number.isFinite(p[k])||p[k]<1||p[k]>1500))throw Error('The saved machine contains an invalid size.');
  }
  if(new Set(saved.parts.map(p=>p.id)).size!==saved.parts.length)throw Error('The saved machine has duplicate part identifiers.');
  return {name:saved.name.slice(0,80),number:String(saved.number??'01').slice(0,4),parts:saved.parts,annotated:!!saved.annotated};
}
function restore(){
  try{const raw=localStorage.getItem(STORAGE);if(raw)Object.assign(state,validateMachine(JSON.parse(raw)));const pref=JSON.parse(localStorage.getItem(preferences)??'{}');state.sound=pref.sound!==false;sound.enabled=state.sound;}
  catch(error){toast(`${error.message} Opened a fresh example.`);}
}
function save(){
  try{localStorage.setItem(STORAGE,JSON.stringify({version:1,...blueprint()}));$('edit-status').textContent='Saved in this browser';}
  catch{toast('Browser storage is unavailable. Keep this tab open to keep your machine.');$('edit-status').textContent='Not saved';}
}
function checkpoint(before=snapshot()){state.history.push(before);if(state.history.length>50)state.history.shift();state.future=[];}
function editDone(){state.annotated=false;save();sync();}
function reset(){state.phase='build';state.world=null;state.particles=[];state.trail=[];accumulator=0;wonShown=false;$('success').hidden=true;sync();}
function selectedPart(){return visibleParts().find(p=>p.id===state.selected);}
function placePart(piece,change){
  Object.assign(piece,change);
  if(state.world){anchorBody(piece);Object.assign(state.parts.find(p=>p.id===piece.id),{x:piece.x,y:piece.y,angle:wrappedAngle(piece.angle)});}
}
function insertPart(piece){state.parts.push(piece);if(state.world)state.world.parts.push(createBody(piece));state.selected=piece.id;}
function sync(){
  $('machine-name').replaceChildren(document.createTextNode(state.name+' '));const number=document.createElement('span');number.textContent='№ '+state.number;$('machine-name').append(number);
  const running=state.phase==='running',paused=state.phase==='paused';
  $('run-button').innerHTML=`<span>${running?'Ⅱ':'▶'}</span> ${running?'Pause a moment':paused?'Keep it rolling':'Let it roll!'} <kbd>SPACE</kbd>`;
  $('mode-label').innerHTML=`<span></span> ${running?'IN MOTION':paused?'PAUSED':'BUILD MODE'}`;
  $('mode-label').classList.toggle('running',running);canvas.dataset.phase=state.phase;
  $('undo-button').disabled=!state.history.length;$('redo-button').disabled=!state.future.length;
  $('empty-note').hidden=state.parts.length>0;
  const p=selectedPart();$('inspector').hidden=!p;
  if(p){$('selected-name').textContent=PARTS[p.type].name;$('selected-description').textContent=PARTS[p.type].description;$('angle').min=p.type==='domino'?-85:-180;$('angle').max=p.type==='domino'?85:180;$('angle').value=wrappedAngle(p.angle);$('angle-value').value=`${Math.round(wrappedAngle(p.angle))}°`;}
  for(const id of ['angle','rotate-button','duplicate-button','delete-button'])$(id).disabled=running;
  $('sound-button').setAttribute('aria-pressed',String(state.sound));$('sound-label').textContent=state.sound?'Sound on':'Sound off';$('sound-icon').textContent=state.sound?'♪':'♩';
  $('zoom-reset').textContent=`${Math.round(state.zoom*100)}%`;
  $('canvas-hint').textContent=running?'Click a marble to give it a nudge':paused?'Paused · Drag, add, or rotate parts · Space to continue':'Drag to arrange · R to rotate · Space to run';
}
function addPart(type,x=550,y=240){
  if(!PARTS[type])throw Error('Unknown part type.');
  if(state.phase==='running'){toast('Pause the machine to add or rearrange parts.');return false;}
  if(state.parts.length>=150){toast('The parts box holds 150 pieces per machine.');return false;}
  checkpoint();const offset=visibleParts().filter(p=>Math.abs(p.x-x)<5&&Math.abs(p.y-y)<5).length*24;
  const p=part(type,snap(clamp(x+offset,30,WORLD.width-30)),snap(clamp(y+offset,45,WORLD.floor-40)),type==='ramp'?15:0,{colorIndex:state.parts.length%5});
  insertPart(p);editDone();return p;
}
function updateSelected(change){if(state.phase==='running')return;const p=selectedPart();if(!p)return;checkpoint();placePart(p,change);editDone();}
function removeSelected(){if(!selectedPart()||state.phase==='running')return;checkpoint();state.parts=state.parts.filter(p=>p.id!==state.selected);if(state.world)state.world.parts=state.world.parts.filter(p=>p.id!==state.selected);state.selected=null;editDone();}
function duplicateSelected(){const p=selectedPart();if(!p||state.phase==='running')return;if(state.parts.length>=150){toast('The workbench is full.');return;}checkpoint();const duplicate={...state.parts.find(piece=>piece.id===p.id),id:crypto.randomUUID(),x:clamp(p.x+35,20,WORLD.width-20),y:clamp(p.y+10,35,WORLD.floor-35),angle:wrappedAngle(p.angle)};insertPart(duplicate);editDone();}
function rotate(){const p=selectedPart();if(p)updateSelected({angle:p.type==='domino'?(p.angle+15>85?-85:p.angle+15):wrappedAngle(p.angle+15)});}
function undo(redo=false){const from=redo?state.future:state.history,to=redo?state.history:state.future;if(!from.length)return;const current=snapshot();reset();to.push(current);Object.assign(state,from.pop());wonShown=!!state.world?.won;$('success').hidden=!wonShown;save();sync();}
async function toggleRun(){
  if(state.phase==='running'){state.phase='paused';sync();return;}
  if(state.phase==='build'&&!state.parts.some(p=>p.type==='marble')){toast('Add a marble to set things in motion.');return;}
  endDrag();trayDrag=null;
  if(state.phase==='build'){state.world=createWorld(state.parts);state.trail=[];state.particles=[];wonShown=false;accumulator=0;}
  state.phase='running';state.selected=null;sync();
  if(state.sound)try{await sound.unlock();}catch(error){state.sound=false;sound.enabled=false;sync();toast(error.message);}
}
function changePreset(name){checkpoint();reset();Object.assign(state,preset(name),{selected:null,annotated:true,zoom:1,pan:{x:0,y:0}});save();resize();sync();$('examples-dialog').close();}
function snap(n){return state.grid?Math.round(n/10)*10:n;}
function worldPoint(clientX,clientY){const box=canvas.getBoundingClientRect();return{x:(clientX-box.left-viewport.x)/viewport.scale,y:(clientY-box.top-viewport.y)/viewport.scale};}
function hitTest(point,parts=state.parts){
  return [...parts].reverse().find(p=>{const a=-p.angle*Math.PI/180,dx=point.x-p.x,dy=point.y-p.y,lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a),b=bounds(p);return Math.abs(lx)<Math.max(15,b.width/2+6)&&Math.abs(ly)<Math.max(15,b.height/2+6);});
}
function resize(){
  const box=$('canvas-wrap').getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);
  const scale=Math.min((box.width-28)/WORLD.width,(box.height-45)/WORLD.height)*state.zoom;
  viewport={width:box.width,height:box.height,scale,x:(box.width-WORLD.width*scale)/2+state.pan.x,y:(box.height-WORLD.height*scale)/2+14+state.pan.y,dpr};
}
function zoomBy(amount){state.zoom=clamp(Math.round((state.zoom+amount)*10)/10,.5,2.5);resize();sync();}
function fit(){state.zoom=1;state.pan={x:0,y:0};resize();sync();}
function setTool(tool){state.tool=tool;for(const name of ['select','pan']){const b=$(name+'-tool');b.classList.toggle('active',tool===name);b.setAttribute('aria-pressed',String(tool===name));}canvas.style.cursor=tool==='pan'?'grab':'default';}
function renderTray(category='all'){
  const grid=$('parts-grid');grid.replaceChildren();
  for(const [type,spec] of Object.entries(PARTS)){
    if(category!=='all'&&category!==spec.category)continue;
    const button=document.createElement('button');button.className='part-card';button.dataset.type=type;button.title=`Add ${spec.name}: ${spec.description}`;button.setAttribute('aria-label',`Add ${spec.name}`);
    const icon=document.createElement('canvas');icon.width=190;icon.height=120;icon.setAttribute('aria-hidden','true');button.append(icon);
    const label=document.createElement('span');label.textContent=spec.name;button.append(label);const plus=document.createElement('span');plus.className='add-part';plus.textContent='+';button.append(plus);
    const c=icon.getContext('2d');c.translate(95,53);const scale=Math.min(1.0,140/spec.width,78/(spec.height+(type==='trampoline'?30:0)));c.scale(scale,scale);drawPart(c,{type,x:0,y:0,angle:type==='ramp'?-14:0,colorIndex:type==='domino'?2:0});
    button.addEventListener('pointerdown',event=>{if(event.button!==0)return;trayDrag={type,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,moved:false};button.setPointerCapture(event.pointerId);});
    button.addEventListener('pointermove',event=>{if(!trayDrag)return;trayDrag.x=event.clientX;trayDrag.y=event.clientY;trayDrag.moved=Math.hypot(event.clientX-trayDrag.startX,event.clientY-trayDrag.startY)>8;});
    button.addEventListener('pointerup',event=>{if(!trayDrag)return;const box=canvas.getBoundingClientRect();if(!trayDrag.moved)addPart(type);else if(event.clientX>=box.left&&event.clientX<=box.right&&event.clientY>=box.top&&event.clientY<=box.bottom){const p=worldPoint(event.clientX,event.clientY);addPart(type,p.x,p.y);}trayDrag=null;});
    button.addEventListener('pointercancel',()=>{trayDrag=null;});button.addEventListener('click',event=>{if(event.detail===0)addPart(type);});grid.append(button);
  }
}
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0&&event.button!==1)return;canvas.focus();const point=worldPoint(event.clientX,event.clientY);
  if(state.tool==='pan'||event.button===1){drag={mode:'pan',x:event.clientX,y:event.clientY,pan:{...state.pan}};canvas.setPointerCapture(event.pointerId);return;}
  const p=hitTest(point,state.world?.parts??state.parts);
  if(state.phase==='running'){
    if(p?.type==='marble'){p.vx+=220;p.vy-=150;sound.play({kind:'marble',strength:120});toast('A helpful little nudge.');}
    else if(p)toast('Pause the machine to rearrange parts.');return;
  }
  state.selected=p?.id??null;sync();if(!p)return;
  drag={mode:'part',id:p.id,dx:point.x-p.x,dy:point.y-p.y,original:snapshot(),moved:false,startX:event.clientX,startY:event.clientY};canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!drag)return;
  if(drag.mode==='pan'){state.pan={x:drag.pan.x+event.clientX-drag.x,y:drag.pan.y+event.clientY-drag.y};resize();return;}
  if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<3&&!drag.moved)return;
  drag.moved=true;const p=selectedPart(),point=worldPoint(event.clientX,event.clientY);if(!p)return;
  placePart(p,{x:snap(clamp(point.x-drag.dx,20,WORLD.width-20)),y:snap(clamp(point.y-drag.dy,30,WORLD.floor-15))});
});
function endDrag(){if(drag?.mode==='part'&&drag.moved){checkpoint(drag.original);editDone();}drag=null;}
canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);
canvas.addEventListener('wheel',event=>{if(!event.ctrlKey&&!event.metaKey)return;event.preventDefault();zoomBy(event.deltaY>0?-.1:.1);},{passive:false});
document.addEventListener('keydown',event=>{
  if(event.target.matches('input,select,textarea')||document.querySelector('dialog[open]'))return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey);return;}
  if(event.code==='Space'&&(event.target===canvas||event.target===document.body)){event.preventDefault();void toggleRun();return;}
  if(event.target===canvas&&event.key==='Tab'&&state.parts.length){const index=state.parts.findIndex(p=>p.id===state.selected),next=index+(event.shiftKey?-1:1);if(next>=0&&next<state.parts.length){event.preventDefault();state.selected=state.parts[next].id;sync();}else{state.selected=null;sync();}return;}
  if(event.key==='Escape'){state.selected=null;setTool('select');sync();}
  if(event.target!==canvas&&event.target!==document.body)return;
  const key=event.key.toLowerCase();if(key==='r')rotate();if(key==='d')duplicateSelected();if(key==='delete'||key==='backspace'){event.preventDefault();removeSelected();}if(key==='h')setTool('pan');if(key==='v')setTool('select');
  if(key.startsWith('arrow')){const p=selectedPart();if(!p)return;event.preventDefault();const amount=event.shiftKey?1:10;updateSelected({x:clamp(p.x+(key==='arrowright'?amount:key==='arrowleft'?-amount:0),20,WORLD.width-20),y:clamp(p.y+(key==='arrowdown'?amount:key==='arrowup'?-amount:0),30,WORLD.floor-15)});}
});
function burst(event){
  const bell=event.kind==='bell',count=bell?55:5;
  for(let i=0;i<count;i++)state.particles.push({x:event.x,y:event.y,vx:(Math.random()-.5)*(bell?450:110),vy:-Math.random()*(bell?520:130),life:bell?2.3:.45,maxLife:bell?2.3:.45,color:['#d69b7d','#abbb94','#ddc270','#ab9bb9'][i%4],size:bell?4:2});
}
function draw(frameTime){
  const delta=Math.min((frameTime-lastFrame)/1000,.08)||0;lastFrame=frameTime;
  if(state.phase==='running'&&state.world){
    accumulator+=delta*Number($('speed').value);
    while(accumulator>=1/120){const events=stepWorld(state.world,1/120);for(const event of events){sound.play(event);if(event.kind!=='fan')burst(event);}accumulator-=1/120;}
    for(const p of state.world.parts.filter(p=>p.type==='marble'))state.trail.push({x:p.x,y:p.y,life:.6});
    if(state.world.won&&!wonShown){wonShown=true;$('success').hidden=false;}
  }
  const world=state.world,time=world?.time??0;
  $('elapsed').textContent=`${String(Math.floor(time/60)).padStart(2,'0')}:${(time%60).toFixed(1).padStart(4,'0')}`;$('reaction-count').textContent=`${world?.reactions??0} reactions`;
  brush.setTransform(viewport.dpr,0,0,viewport.dpr,0,0);drawGrid(brush,viewport.width,viewport.height,viewport);
  brush.save();brush.translate(viewport.x,viewport.y);brush.scale(viewport.scale,viewport.scale);
  if(state.annotated)drawAnnotations(brush,state.name);
  if(!state.annotated){brush.strokeStyle='#bac4b0';brush.lineWidth=1;brush.beginPath();brush.moveTo(0,WORLD.floor+8);brush.lineTo(WORLD.width,WORLD.floor+8);brush.stroke();}
  for(const dot of state.trail){if(state.phase==='running')dot.life-=delta;brush.fillStyle=`rgba(190,131,100,${Math.max(0,dot.life*.2)})`;brush.beginPath();brush.arc(dot.x,dot.y,4,0,7);brush.fill();}state.trail=state.trail.filter(p=>p.life>0).slice(-200);
  for(const p of visibleParts()){drawPart(brush,p,time,state.phase==='running');if(p.id===state.selected&&state.phase!=='running')drawSelection(brush,p);}
  for(const p of state.particles){if(state.phase==='running'){p.life-=delta;p.x+=p.vx*delta;p.y+=p.vy*delta;p.vy+=400*delta;}brush.globalAlpha=Math.max(0,p.life/p.maxLife);brush.fillStyle=p.color;brush.fillRect(p.x,p.y,p.size*2,p.size);}brush.globalAlpha=1;state.particles=state.particles.filter(p=>p.life>0);
  if(trayDrag?.moved){const p=worldPoint(trayDrag.x,trayDrag.y);brush.globalAlpha=.65;drawPart(brush,{type:trayDrag.type,x:p.x,y:p.y,angle:0});brush.globalAlpha=1;}
  brush.restore();requestAnimationFrame(draw);
}
for(const [id,handler] of Object.entries({'run-button':toggleRun,'reset-button':reset,'rotate-button':rotate,'duplicate-button':duplicateSelected,'delete-button':removeSelected,'undo-button':()=>undo(),'redo-button':()=>undo(true),'zoom-in':()=>zoomBy(.2),'zoom-out':()=>zoomBy(-.2),'zoom-reset':fit,'fit-button':fit,'select-tool':()=>setTool('select'),'pan-tool':()=>setTool('pan'),'dismiss-success':()=>{$('success').hidden=true;}}))$(id).addEventListener('click',handler);
$('grid-button').addEventListener('click',()=>{state.grid=!state.grid;$('grid-button').classList.toggle('active',state.grid);$('grid-button').setAttribute('aria-pressed',String(state.grid));toast(state.grid?'Snap to grid on':'Free placement on');});
$('sound-button').addEventListener('click',async()=>{state.sound=!state.sound;sound.enabled=state.sound;if(state.sound)try{await sound.unlock();sound.tone(520,.1,'sine',.05);}catch(error){state.sound=false;sound.enabled=false;toast(error.message);}try{localStorage.setItem(preferences,JSON.stringify({sound:state.sound}));}catch{toast('Sound preference could not be saved in this browser.');}sync();});
let angleBefore=null;$('angle').addEventListener('input',()=>{const p=selectedPart();if(!p)return;angleBefore??=snapshot();placePart(p,{angle:Number($('angle').value)});$('angle-value').value=`${p.angle}°`;});$('angle').addEventListener('change',()=>{if(angleBefore){checkpoint(angleBefore);angleBefore=null;editDone();}});
document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));renderTray(button.dataset.category);}));
for(const [button,dialog] of [['guide-button','guide-dialog'],['shortcuts-button','guide-dialog'],['examples-button','examples-dialog'],['new-button','new-dialog']])$(button).addEventListener('click',()=>$(dialog).showModal());
document.querySelectorAll('.dialog-close,.dialog-done').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();}}));
document.querySelectorAll('[data-preset]').forEach(button=>button.addEventListener('click',()=>changePreset(button.dataset.preset)));
$('confirm-new').addEventListener('click',()=>{checkpoint();reset();Object.assign(state,{name:'A bright little idea',number:'04',parts:[],selected:null,annotated:false});save();sync();$('new-dialog').close();toast('A fresh start. Pick a part and see what happens.');});
restore();renderTray();sync();new ResizeObserver(resize).observe($('canvas-wrap'));resize();requestAnimationFrame(draw);

const registry=document.modelContext;
if(registry?.registerTool){
  const lifecycle=new AbortController();
  const tools=[
    {name:'read_machine',description:'Read the current machine parts, selected part, and simulation state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:()=>({...blueprint(),parts:structuredClone(visibleParts()),selected:state.selected,phase:state.phase,time:state.world?.time??0,reactions:state.world?.reactions??0,bellRung:state.world?.won??false})},
    {name:'add_machine_parts',description:'Add a batch of parts at coordinates in the 1200 by 760 workbench. Available in build mode and while paused; paused additions join the current run.',inputSchema:{type:'object',properties:{parts:{type:'array',maxItems:30,items:{type:'object',properties:{type:{type:'string',enum:Object.keys(PARTS)},x:{type:'number',minimum:30,maximum:1170},y:{type:'number',minimum:45,maximum:660}},required:['type','x','y'],additionalProperties:false}}},required:['parts'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:input=>{if(state.phase==='running')throw Error('Pause the simulation before editing.');if(!Array.isArray(input.parts)||!input.parts.length||input.parts.length>30||state.parts.length+input.parts.length>150||input.parts.some(p=>!PARTS[p.type]||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<30||p.x>1170||p.y<45||p.y>660))throw Error('Provide 1–30 valid parts within the workbench.');const added=input.parts.map(p=>addPart(p.type,p.x,p.y));return {added:added.map(p=>p.id),totalParts:state.parts.length};}},
    {name:'control_machine',description:'Run, pause, or reset the current machine, or load a named example. Reset preserves the arranged parts; a preset replaces them and supports Undo.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['run','pause','reset','scenic','bounce','wind']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{if(!['run','pause','reset','scenic','bounce','wind'].includes(input.action))throw Error('Unknown machine action.');if(input.action==='reset')reset();else if(input.action==='run'){if(state.phase==='build'&&!state.parts.some(p=>p.type==='marble'))throw Error('Add a marble first.');if(state.phase!=='running')await toggleRun();}else if(input.action==='pause'){if(state.phase==='running'){state.phase='paused';sync();}}else changePreset(input.action);return {phase:state.phase,machine:state.name,parts:state.parts.length};}}
  ];
  for(const tool of tools)try{Promise.resolve(registry.registerTool(tool,{signal:lifecycle.signal})).catch(error=>console.warn('Machine tool unavailable:',error.message));}catch(error){console.warn('Machine tool unavailable:',error.message);}
  addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
