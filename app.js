import {PARTS,MATERIALS,blankLevel,starterLevel,parseLevel,designPart,clamp} from './model.js';
import {createBody,setMass,stepWorld,goalProgress} from './physics.js';
import {Workshop} from './workshop.js';
import {Gestures} from './gestures.js';
import {drawBody,drawScene} from './draw.js';
import {initIcons,setIcon,icon} from './icons.js';
import {WorkshopSound} from './sound.js';
import {ropeGeometry} from './rope.js';
import {setTheme,themeName} from './theme.js';
import {WorldTimeline} from './timeline.js';
const $=id=>document.getElementById(id),canvas=$('canvas'),paint=canvas.getContext('2d'),sound=new WorkshopSound();
const workshop=new Workshop(starterLevel(),true),timeline=new WorldTimeline().reset(workshop.world,workshop.revision),camera={x:0,y:0,scale:1},viewport={w:innerWidth,h:innerHeight,dpr:Math.min(devicePixelRatio||1,2)};
let puzzles=[],activePuzzle=-1,editorReturn=null,toastTimer=0,accumulator=0,lastFrame=0,particles=[],trayDrag=null,lastProgress='',shownWin=false,resumeAfterRewind=false,propertiesOpen=false,propertySelection=null;
const view={camera,snap:false,toWorld:(x,y)=>({x:(x-camera.x)/camera.scale,y:(y-camera.y)/camera.scale}),toast,sync,syncConnection,zoomAt,inBin:(x,y)=>{const b=$('parts-tray').getBoundingClientRect();return !$('parts-tray').hidden&&x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom;}};
const gestures=new Gestures(canvas,workshop,view);
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function act(action){try{const result=action();sync();return result;}catch(error){toast(error.message);sync();return false;}}
function resize(){viewport.w=innerWidth;viewport.h=innerHeight;viewport.dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(viewport.w*viewport.dpr);canvas.height=Math.round(viewport.h*viewport.dpr);}
function fit(){const env=workshop.world.environment;camera.scale=Math.min((innerWidth-55)/env.width,(innerHeight-110)/env.height);camera.x=(innerWidth-env.width*camera.scale)/2;camera.y=(innerHeight-env.height*camera.scale)/2-8;syncZoom();}
function zoomAt(factor,x=innerWidth/2,y=innerHeight/2){const point=view.toWorld(x,y),scale=clamp(camera.scale*factor,.12,3);camera.x=x-point.x*scale;camera.y=y-point.y*scale;camera.scale=scale;syncZoom();}
function syncZoom(){const env=workshop.world.environment,base=Math.min((innerWidth-55)/env.width,(innerHeight-110)/env.height);$('fit').textContent=`${Math.round(camera.scale/base*100)}%`;}
function popover(id){for(const other of ['menu','environment'])if(other!==id)$(other).hidden=true;$(id).hidden=!$(id).hidden;$(id==='menu'?'menu-button':'environment-button').setAttribute('aria-expanded',String(!$(id).hidden));}
function closePopovers(){for(const id of ['menu','environment'])$(id).hidden=true;$('menu-button').setAttribute('aria-expanded','false');$('environment-button').setAttribute('aria-expanded','false');}
function setTool(tool,stock){gestures.setTool(tool,stock);if(!['select','pan'].includes(tool))workshop.selected=null;sync();}
function toggleParts(){const open=$('parts-tray').hidden;$('parts-tray').hidden=!open;$('parts-button').setAttribute('aria-expanded',String(open));setIcon($('parts-button'),open?'minus':'plus');}
function syncConnection(){const c=gestures.connection;$('connection-hint').hidden=!c;$('connection-hint').textContent=c?(c.kind==='rope'?'Thread pulleys → finish at a load or anchor · Esc to cancel':c.kind==='belt'?'Choose a wheel or conveyor · Esc to cancel':'Choose a device · Esc to cancel'):'';}
function ropePropertySync(c){
  if(!c)return;
  if(document.activeElement!==$('rope-length'))$('rope-length').value=Math.round(c.length*10)/10;
  $('rope-guides').textContent=`${c.via.length} ${c.via.length===1?'pulley':'pulleys'}`;
  const signature=c.via.join('|');if($('rope-guide').dataset.signature!==signature){$('rope-guide').dataset.signature=signature;$('rope-guide').replaceChildren();c.via.forEach((id,i)=>{const option=document.createElement('option');option.value=i;option.textContent=`Pulley ${i+1}`;$('rope-guide').append(option);});}
  $('rope-wrap-label').hidden=!c.via.length;
  const locked=workshop.level.mode==='puzzle'&&[c.a,c.b].every(id=>workshop.level.bodies.find(b=>b.id===id)?.locked);
  for(const id of ['rope-length','rope-fit','rope-delete','rope-reverse'])$(id).disabled=locked;
  $('rope-reverse').disabled=locked||!c.via.length;
}
function propertySync(){
  const b=workshop.body(),c=workshop.world.connections.find(connection=>connection.id===workshop.selected&&connection.kind==='rope'),selection=b?.id??c?.id??null;if(selection!==propertySelection){propertySelection=selection;propertiesOpen=false;$('material-properties').open=false;}
  $('properties-button').hidden=!selection||propertiesOpen;$('inspector').hidden=!b||!propertiesOpen;$('rope-inspector').hidden=!c||!propertiesOpen;ropePropertySync(c);if(!b)return;
  $('pinned-name').textContent=b.kind==='pulley'?'Fixed axle':'Pivot';
  $('part-name').textContent=PARTS[b.kind].name+(workshop.level.mode==='puzzle'&&b.locked?' · locked':'');
  const values={material:b.material,'output-material':b.outputMaterial,angle:Math.round(((b.angle*180/Math.PI+180)%360+360)%360-180),width:Math.round(b.w),height:Math.round(b.h),power:b.power};
  for(const [id,value] of Object.entries(values))if(document.activeElement!==$(id))$(id).value=value;
  for(const field of ['fixed','pinned','locked','on'])$(field).checked=!!b[field];
  $('output-material-row').hidden=b.kind!=='material-zone';$('power-row').hidden=!['fan','motor','conveyor','rocket','trampoline'].includes(b.kind);$('on-row').hidden=!['fan','motor','conveyor','rocket'].includes(b.kind);$('locked-label').hidden=workshop.level.mode!=='editor';$('to-bin').hidden=workshop.level.mode!=='editor';
  for(const input of $('inspector').querySelectorAll('input,select,button:not(#close-inspector)'))input.disabled=!workshop.editable(b);
  $('height').disabled=!workshop.editable(b)||PARTS[b.kind].shape==='circle';
  if(b.kind==='material-zone')for(const id of ['fixed','pinned'])$(id).disabled=true;
  if(workshop.level.mode==='puzzle'){for(const id of ['material','power','fixed','pinned','on'])$(id).disabled=true;}
}
function sync(){
  timeline.ensure(workshop.world,workshop.revision);const rewinding=timeline.rewinding,running=workshop.running,puzzle=workshop.level.mode==='puzzle',editor=workshop.level.mode==='editor';
  setIcon($('play'),running?'pause':'play');$('play').setAttribute('aria-label',running?'Pause simulation':'Play simulation');$('play').disabled=rewinding;$('mode-status').textContent=rewinding?'REWIND':running?'LIVE':'PAUSED';canvas.dataset.phase=rewinding?'rewinding':running?'running':'paused';
  $('mode-name').textContent=editor?'Puzzle editor':puzzle?workshop.level.name:'Workshop';for(const id of ['undo','menu-undo'])$(id).disabled=!workshop.history.length;for(const id of ['redo','menu-redo'])$(id).disabled=!workshop.future.length;$('step').disabled=running||rewinding;$('rewind').disabled=!rewinding&&!timeline.canRewind;$('rewind').classList.toggle('active',rewinding);$('rewind').setAttribute('aria-pressed',String(rewinding));
  document.querySelectorAll('[data-tool]').forEach(button=>{button.classList.toggle('active',button.dataset.tool===gestures.tool);button.setAttribute('aria-pressed',String(button.dataset.tool===gestures.tool));button.disabled=puzzle&&['box','circle'].includes(button.dataset.tool)&&!workshop.available(button.dataset.tool);});
  $('test-puzzle').hidden=!editor;$('edit-puzzle').hidden=!puzzle;$('goal-button').hidden=puzzle;$('author-button').hidden=editor||puzzle;
  for(const id of ['gravity','pressure','ground'])$(id).disabled=puzzle;
  const env=workshop.world.environment;$('gravity').value=env.gravity;$('gravity-value').value=env.gravity;$('pressure').value=env.pressure;$('pressure-value').value=`${env.pressure.toFixed(1)}×`;$('ground').checked=env.floor;$('snap').checked=view.snap;
  $('goal-badge').hidden=!workshop.world.goal;syncGoal();propertySync();syncConnection();renderTray();syncZoom();
  workshop.changed=false;
}
function syncGoal(){
  const g=workshop.world.goal;if(!g)return;const progress=goalProgress(workshop.world),target=g.target==='any'?'object':PARTS[g.target]?.name??PARTS[workshop.level.bodies.find(b=>b.id===g.target)?.kind]?.name??'object';
  $('goal-summary').textContent=g.kind==='region'?`${target} → region`:g.kind==='edge'?`${target} → ${g.edge}`:`${target} · ${g.state}`;
  const text=`${Math.min(progress.count,g.count)}/${g.count}${g.delay?` · ${Math.min(progress.held,g.delay).toFixed(1)}/${g.delay}s`:''}`;if(text!==lastProgress){$('goal-progress').textContent=text;lastProgress=text;}$('goal-badge').classList.toggle('complete',workshop.world.won);
}
let traySignature='';
function renderTray(){
  const puzzle=workshop.level.mode==='puzzle',entries=puzzle?workshop.level.inventory.map(e=>({kind:e.part.kind,part:e.part,stock:e.id,count:workshop.remaining(e)})):Object.keys(PARTS).map(kind=>({kind,part:PARTS[kind],count:null}));
  const signature=JSON.stringify(entries);if(signature===traySignature)return;traySignature=signature;$('parts-grid').replaceChildren();$('bin-label').textContent=puzzle?entries.reduce((sum,e)=>sum+e.count,0):'∞';
  if(!entries.length){const empty=document.createElement('div');empty.className='empty-bin';empty.textContent='Empty bin';$('parts-grid').append(empty);}
  for(const entry of entries){const button=document.createElement('button');button.className='part-card';button.dataset.kind=entry.kind;button.setAttribute('aria-label',`Drag ${PARTS[entry.kind].name} onto the canvas${entry.count===null?'':`, ${entry.count} left`}`);button.title=`Drag ${PARTS[entry.kind].name} onto the canvas`;button.disabled=entry.count===0;
    const preview=document.createElement('canvas');preview.width=144;preview.height=98;preview.setAttribute('aria-hidden','true');button.append(preview);const label=document.createElement('span');label.textContent=PARTS[entry.kind].name;button.append(label);const count=document.createElement('small');count.textContent=entry.count===null?'':entry.count;button.append(count);
    const b=createBody({...entry.part,id:'preview',kind:entry.kind,x:0,y:0,angle:entry.kind==='ramp'?-.15:0,material:entry.part.material??PARTS[entry.kind].material,fixed:!!entry.part.fixed,pinned:!!entry.part.pinned,power:1,direction:1,on:true});const c=preview.getContext('2d');c.translate(72,43);const scale=Math.min(1.2,115/b.w,65/(b.h+(entry.kind==='trampoline'?30:0)));c.scale(scale,scale);drawBody(c,b);
    button.addEventListener('pointerdown',e=>{if(e.button!==0)return;button.setPointerCapture(e.pointerId);trayDrag={entry,start:{x:e.clientX,y:e.clientY},moved:false,before:workshop.capture(),ghost:null};});
    button.addEventListener('pointermove',e=>{if(!trayDrag)return;trayDrag.moved||=Math.hypot(e.clientX-trayDrag.start.x,e.clientY-trayDrag.start.y)>8;if(!trayDrag.moved)return;const p=view.toWorld(e.clientX,e.clientY);try{trayDrag.ghost??=workshop.newPart(entry.kind,p.x,p.y,{},entry.stock);trayDrag.ghost.x=p.x;trayDrag.ghost.y=p.y;}catch(error){toast(error.message);trayDrag=null;}});
    button.addEventListener('pointerup',e=>{if(!trayDrag)return;const d=trayDrag;trayDrag=null;if(d.moved&&d.ghost&&!view.inBin(e.clientX,e.clientY)){if(workshop.canPlace(d.ghost)){act(()=>{workshop.insert(d.ghost);workshop.record(d.before);});setTool('select');}else toast('Objects cannot overlap.');}});button.addEventListener('pointercancel',()=>{trayDrag=null;});$('parts-grid').append(button);
  }
}
async function toggleRun(){workshop.running=!workshop.running;sync();if(workshop.running)try{await sound.unlock();}catch(error){sound.enabled=false;toast(error.message);}}
function stepSimulation(dt=1/120){const events=stepWorld(workshop.world,dt);timeline.record(workshop.world,workshop.revision);return events;}
function beginRewind(){gestures.cancel();timeline.ensure(workshop.world,workshop.revision);if(!timeline.start(workshop.world,workshop.revision))return;resumeAfterRewind=workshop.running;workshop.running=false;particles=[];accumulator=0;sync();}
function endRewind(){if(!timeline.stop(workshop.world))return;workshop.running=resumeAfterRewind;resumeAfterRewind=false;workshop.changed=true;accumulator=0;sync();}
function replaceLevel(level,running=false){gestures.cancel();const before=workshop.capture();workshop.load(level,running);workshop.history=[before];gestures.tool='select';gestures.stock=null;canvas.style.cursor='default';particles=[];shownWin=false;$('win').hidden=true;accumulator=0;traySignature='';fit();closePopovers();sync();}
function openPuzzle(index){if(!puzzles[index])return;activePuzzle=index;editorReturn=null;replaceLevel(puzzles[index],false);$('puzzles-dialog').close();if($('parts-tray').hidden)toggleParts();}
function author(){const level=structuredClone(workshop.level);level.mode='editor';level.name='Untitled puzzle';level.bodies=level.bodies.map(p=>({...p,locked:true}));replaceLevel(level,false);}
function testPuzzle(){const level=workshop.export();editorReturn=structuredClone(workshop.level);replaceLevel(level,false);if($('parts-tray').hidden)toggleParts();}
function editPuzzle(){const level=editorReturn??structuredClone(workshop.level);level.mode='editor';replaceLevel(level,false);}
function goalDialog(){
  if(workshop.level.mode==='puzzle'){toast('The puzzle goal is locked.');return;}
  const select=$('goal-target');select.replaceChildren();for(const [value,label] of [['any','Any moving object'],...Object.entries(PARTS).map(([key,p])=>[key,p.name]),...workshop.level.bodies.map((p,i)=>[p.id,`${PARTS[p.kind].name} #${i+1}`])]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  const g=workshop.level.goal??{kind:'region',target:workshop.selected??'any',count:1,delay:0,edge:'right',state:'rung'};for(const k of ['kind','target','count','delay','edge','state'])$('goal-'+k).value=g[k];syncGoalForm();closePopovers();$('goal-dialog').showModal();
}
function syncGoalForm(){$('edge-row').hidden=$('goal-kind').value!=='edge';$('state-row').hidden=$('goal-kind').value!=='state';$('apply-goal').textContent=$('goal-kind').value==='region'?'Draw region':'Set goal';}
function exportDialog(){try{workshop.export();$('level-name').value=workshop.level.name;closePopovers();$('file-dialog').showModal();}catch(error){toast(error.message);}}
function exportFile(name){
  const exported=workshop.export();exported.name=name.trim()||'Contraption';const blob=new Blob([JSON.stringify(exported,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=exported.name.replace(/[^a-z0-9_-]+/gi,'-').replace(/^-|-$/g,'')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);$('file-dialog').close();toast('Level exported');
}
async function importFile(file){
  if(!file)return;if(file.size>1024*1024)throw Error('Level files must be smaller than 1 MB.');const imported=parseLevel(JSON.parse(await file.text()));replaceLevel(imported,false);activePuzzle=-1;toast('Level imported');
}
function saveBrowser(){try{localStorage.setItem('contraption.saved.v3',JSON.stringify(workshop.level));toast('Level saved in this browser');}catch{toast('Saving failed. Export a JSON file instead.');}closePopovers();}
function loadBrowser(){const raw=localStorage.getItem('contraption.saved.v3');if(!raw)throw Error('No saved level in this browser.');replaceLevel(parseLevel(JSON.parse(raw)),false);}
function burst(event){const count=event.kind==='goal'?60:event.kind==='transform'?28:event.kind==='pop'?20:4,palette=event.kind==='transform'?[MATERIALS[event.material].color,'#faf9eb','#dcc471']:['#c79676','#a3b88a','#dcc471','#ad9cbd'];for(let i=0;i<count;i++)particles.push({x:event.x,y:event.y,vx:(Math.random()-.5)*(count>10?400:100),vy:-Math.random()*(count>10?500:100),life:count>10?2:.35,maxLife:count>10?2:.35,size:count>10?6:3,color:palette[i%palette.length]});}
function consume(events){if(events.length)for(const event of sound.play(events))burst(event);}
function frame(now){
  const dt=Math.min((now-lastFrame)/1000,.06)||0;lastFrame=now;
  if(timeline.rewinding){if(timeline.rewind(workshop.world,dt))workshop.changed=true;particles=[];accumulator=0;}else if(workshop.running){const events=[];accumulator+=dt*Number($('speed').value);while(accumulator>=1/120){events.push(...stepSimulation());accumulator-=1/120;}consume(events);for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;}particles=particles.filter(p=>p.life>0).slice(-300);}
  sound.update(workshop.world,workshop.running&&!timeline.rewinding);sound.silence(timeline.rewinding);$('timer').value=workshop.world.time.toFixed(1)+'s';$('rewind').disabled=!timeline.rewinding&&!timeline.canRewind;syncGoal();
  if(workshop.world.won&&!shownWin){shownWin=true;$('win').hidden=false;if(activePuzzle>=0)try{localStorage.setItem('contraption.complete.'+puzzles[activePuzzle].name,'1');}catch{toast('Progress could not be saved.');}}
  if(!workshop.world.won&&shownWin){shownWin=false;$('win').hidden=true;}
  if(!$('rope-inspector').hidden){const c=workshop.world.connections.find(c=>c.id===workshop.selected);$('rope-tension').value=c?.blocked?'Blocked route':c?.routeCrossed?'Wrap crossed · constrained':c?.tension>1?'Under tension':c&&ropeGeometry(workshop.world.bodies,c).length>=c.length-.1?'Taut':'Slack';}
  if(workshop.changed)sync();
  drawScene(paint,workshop.world,camera,viewport,{selected:workshop.selected,invalid:trayDrag?.ghost?!workshop.canPlace(trayDrag.ghost):gestures.invalid,puzzle:workshop.level.mode==='puzzle',ghost:trayDrag?.ghost??gestures.ghost,region:gestures.region,connection:gestures.previewConnection(),particles,attachments:gestures.tool==='rope'});requestAnimationFrame(frame);
}
initIcons();try{setTheme(localStorage.getItem('contraption.theme')==='light'?'light':'dark');}catch{setTheme('dark');}setIcon($('theme'),themeName()==='dark'?'sun':'moon');resize();fit();sync();requestAnimationFrame(frame);addEventListener('resize',()=>{resize();fit();});
canvas.addEventListener('pointerdown',()=>{closePopovers();if(sound.enabled&&!sound.audio)sound.unlock().catch(error=>{sound.enabled=false;setIcon($('sound'),'mute');toast(error.message);});});
for(const [id,action] of Object.entries({play:toggleRun,reset:()=>{gestures.cancel();workshop.reset();particles=[];accumulator=0;},step:()=>{if(!workshop.running)consume(stepSimulation(1/60));},undo:()=>{gestures.cancel();workshop.undo();},redo:()=>{gestures.cancel();workshop.redo();},'menu-undo':()=>{gestures.cancel();workshop.undo();closePopovers();},'menu-redo':()=>{gestures.cancel();workshop.redo();closePopovers();},'zoom-in':()=>zoomAt(1.2),'zoom-out':()=>zoomAt(1/1.2),fit,'menu-button':()=>popover('menu'),'environment-button':()=>popover('environment'),'parts-button':toggleParts,'properties-button':()=>{propertiesOpen=true;},'close-inspector':()=>{propertiesOpen=false;},duplicate:()=>workshop.duplicate(),delete:()=>workshop.remove(),'to-bin':()=>workshop.toBin(),flip:()=>{const b=workshop.body();if(b)workshop.update({angle:b.angle+Math.PI,direction:-b.direction});},'new-workshop':()=>{activePuzzle=-1;replaceLevel(blankLevel(),true);},'author-button':author,'test-puzzle':testPuzzle,'edit-puzzle':editPuzzle,'goal-button':goalDialog,'goal-badge':goalDialog,'save-file':exportDialog,'import-file':()=>{closePopovers();$('file-input').click();},'save-browser':saveBrowser,'load-browser':loadBrowser,'shortcuts-button':()=>{closePopovers();$('controls-dialog').showModal();},'close-win':()=>{$('win').hidden=true;},'next-puzzle':()=>openPuzzle((activePuzzle+1)%Math.max(1,puzzles.length))}))$(id).addEventListener('click',()=>act(action));
$('rewind').addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();$('rewind').setPointerCapture(event.pointerId);beginRewind();});for(const type of ['pointerup','pointercancel','lostpointercapture'])$('rewind').addEventListener(type,endRewind);
$('theme').addEventListener('click',()=>{const name=themeName()==='dark'?'light':'dark';setTheme(name);setIcon($('theme'),name==='dark'?'sun':'moon');$('theme').setAttribute('aria-label',`Switch to ${name==='dark'?'light':'dark'} mode`);$('theme').title=name==='dark'?'Light mode':'Dark mode';try{localStorage.setItem('contraption.theme',name);}catch{toast('Theme changed; this browser cannot save the preference.');}});
$('close-rope').addEventListener('click',()=>act(()=>{propertiesOpen=false;}));
$('rope-delete').addEventListener('click',()=>act(()=>workshop.remove()));
$('rope-length').addEventListener('change',()=>act(()=>workshop.updateRope({length:Number($('rope-length').value)})));
$('rope-fit').addEventListener('click',()=>act(()=>{const c=workshop.world.connections.find(c=>c.id===workshop.selected);if(c)workshop.updateRope({length:ropeGeometry(workshop.world.bodies,c).length});}));
$('rope-reverse').addEventListener('click',()=>act(()=>{const c=workshop.world.connections.find(c=>c.id===workshop.selected);if(!c)return;const wrap=[...c.wrap];wrap[Number($('rope-guide').value)]*=-1;workshop.updateRope({wrap,length:ropeGeometry(workshop.world.bodies,{...c,wrap}).length});}));
$('sound').addEventListener('click',async()=>{sound.enabled=!sound.enabled;setIcon($('sound'),sound.enabled?'sound':'mute');$('sound').setAttribute('aria-pressed',String(sound.enabled));if(sound.enabled)try{await sound.unlock();sound.tone(450,.08,'sine',.035);}catch(error){sound.enabled=false;toast(error.message);}});
$('volume').addEventListener('input',()=>{sound.volume=Number($('volume').value);});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Full screen is unavailable here.');}});
for(const [id,field,convert] of [['material','material',String],['output-material','outputMaterial',String],['angle','angle',v=>Number(v)*Math.PI/180],['width','w',Number],['height','h',Number],['power','power',Number]])$(id).addEventListener('change',()=>act(()=>{const b=workshop.body();if(!b)return;let value=convert($(id).value);if(typeof value==='number'&&!Number.isFinite(value))throw Error('Enter a valid number.');if(field==='w'||field==='h')value=clamp(value,12,1200);const change={[field]:value};if(PARTS[b.kind].shape==='circle'&&field==='w')change.h=value;workshop.update(change);}));
for(const id of ['fixed','pinned','locked','on'])$(id).addEventListener('change',()=>act(()=>workshop.update({[id]:$(id).checked})));
for(const id of ['gravity','pressure'])$(id).addEventListener('change',()=>act(()=>workshop.setEnvironment({[id]:Number($(id).value)})));
$('ground').addEventListener('change',()=>act(()=>workshop.setEnvironment({floor:$('ground').checked})));$('snap').addEventListener('change',()=>{view.snap=$('snap').checked;});
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>setTool(button.dataset.tool));
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>button.closest('dialog').close());
$('puzzles-button').addEventListener('click',()=>{closePopovers();$('puzzle-list').replaceChildren();puzzles.forEach((p,i)=>{const button=document.createElement('button');button.className='puzzle-card';const number=document.createElement('span');number.className='number';number.textContent=String(i+1).padStart(2,'0');const title=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=p.name;small.textContent=`${p.inventory.reduce((n,e)=>n+e.quantity,0)} parts · ${p.goal.kind==='state'?'Trigger':p.goal.kind==='edge'?'Exit':'Target region'}`;title.append(strong,small);button.append(number,title);const arrow=document.createElement('span');arrow.innerHTML=icon('next');button.append(arrow);try{button.classList.toggle('done',localStorage.getItem('contraption.complete.'+p.name)==='1');}catch{button.classList.remove('done');}button.addEventListener('click',()=>openPuzzle(i));$('puzzle-list').append(button);});$('puzzles-dialog').showModal();});
$('goal-kind').addEventListener('change',syncGoalForm);
$('goal-form').addEventListener('submit',e=>{e.preventDefault();act(()=>{const g={kind:$('goal-kind').value,target:$('goal-target').value,count:Number($('goal-count').value),delay:Number($('goal-delay').value),edge:$('goal-edge').value,state:$('goal-state').value,x:800,y:600,w:180,h:180};$('goal-dialog').close();if(g.kind==='region'){setTool('goal');gestures.pendingGoal=g;}else workshop.setGoal(g);});});
$('clear-goal').addEventListener('click',()=>act(()=>{workshop.setGoal(null);$('goal-dialog').close();}));
$('export-form').addEventListener('submit',e=>{e.preventDefault();act(()=>exportFile($('level-name').value));});
$('file-input').addEventListener('change',async()=>{try{await importFile($('file-input').files[0]);}catch(error){toast(`Import failed: ${error.message}`);}finally{$('file-input').value='';}});
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea')||document.querySelector('dialog[open]'))return;
  const key=e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&(key==='z'||key==='y')){e.preventDefault();act(()=>{gestures.cancel();if(key==='y'||e.shiftKey)workshop.redo();else workshop.undo();});return;}if(key==='q'){e.preventDefault();if(!e.repeat)beginRewind();return;}
  if((e.ctrlKey||e.metaKey)&&key==='s'){e.preventDefault();exportDialog();return;}if((e.ctrlKey||e.metaKey)&&key==='o'){e.preventDefault();$('file-input').click();return;}
  if(e.code==='Space'&&(e.target===canvas||e.target===document.body)){e.preventDefault();void toggleRun();return;}
  if(key==='escape'){gestures.cancel();workshop.selected=null;setTool('select');closePopovers();sync();return;}
  if(e.target!==canvas&&e.target!==document.body)return;
  if(key==='tab'){const parts=workshop.world.bodies,index=parts.findIndex(p=>p.id===workshop.selected)+(e.shiftKey?-1:1);if(index>=0&&index<parts.length){e.preventDefault();workshop.selected=parts[index].id;sync();}return;}
  const tools={v:'select',h:'pan',b:'box',c:'circle',r:'rope'};if(tools[key]){setTool(tools[key]);return;}
  if(key==='delete'||key==='backspace'){e.preventDefault();act(()=>workshop.remove());}if(key==='d')act(()=>workshop.duplicate());
  if(key.startsWith('arrow')){const b=workshop.body();if(!b)return;e.preventDefault();const step=e.shiftKey?1:10;act(()=>workshop.update({x:b.x+(key==='arrowright'?step:key==='arrowleft'?-step:0),y:b.y+(key==='arrowdown'?step:key==='arrowup'?-step:0)}));}
});
document.addEventListener('keyup',e=>{if(e.key.toLowerCase()==='q')endRewind();});addEventListener('blur',endRewind);
try{const response=await fetch('./levels.json');if(!response.ok)throw Error('Puzzle library failed to load.');const pack=await response.json();puzzles=pack.levels.map(parseLevel);const requested=new URLSearchParams(location.hash.slice(1)).get('puzzle'),index=pack.levels.findIndex(p=>p.id===requested);if(index>=0)openPuzzle(index);}catch(error){toast(error.message);}
const registry=document.modelContext;
if(registry?.registerTool){const lifecycle=new AbortController(),tools=[
{name:'read_level',description:'Read the current construction, live physical bodies, inventory, and simulation state.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({level:structuredClone(workshop.level),bodies:structuredClone(workshop.world.bodies),running:workshop.running,time:workshop.world.time,selected:workshop.selected,goal:goalProgress(workshop.world),inventory:workshop.level.inventory.map(e=>({id:e.id,remaining:workshop.remaining(e)}))})},
{name:'import_level',description:'Validate and load a complete Contraption v3 JSON level. Replaces the canvas; Undo restores it.',inputSchema:{type:'object',properties:{level:{type:'object'}},required:['level'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{const level=parseLevel(input.level);replaceLevel(level,false);return{name:level.name,objects:level.bodies.length,mode:level.mode};}},
{name:'control_simulation',description:'Play, pause, reset, undo, redo, or advance one frame.',inputSchema:{type:'object',properties:{action:{type:'string',enum:['play','pause','reset','undo','redo','step']}},required:['action'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{if(!['play','pause','reset','undo','redo','step'].includes(input.action))throw Error('Unknown simulation action.');if(input.action==='play')workshop.running=true;if(input.action==='pause')workshop.running=false;if(input.action==='reset')workshop.reset();if(input.action==='undo')workshop.undo();if(input.action==='redo')workshop.redo();if(input.action==='step'){workshop.running=false;consume(stepSimulation(1/60));}sync();return{running:workshop.running,time:workshop.world.time};}}
];for(const tool of tools)try{Promise.resolve(registry.registerTool(tool,{signal:lifecycle.signal})).catch(error=>console.warn('Browser tool unavailable:',error.message));}catch(error){console.warn('Browser tool unavailable:',error.message);}addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
