import {ropeWrap,ropeGeometry} from './rope.js';
export const TAU=Math.PI*2;
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const MATERIALS={
  wood:{density:.7,friction:.55,bounce:.15,color:'#d9ac7d'},
  steel:{density:4,friction:.35,bounce:.08,color:'#8298a0'},
  rubber:{density:.9,friction:.7,bounce:.78,color:'#cf887b'},
  cork:{density:.16,friction:.7,bounce:.2,color:'#baa475'},
  helium:{density:.012,friction:.15,bounce:.35,color:'#b4a3c7'},
};
export const PARTS={
  circle:{name:'Circle',shape:'circle',w:50,h:50,material:'rubber'},
  box:{name:'Rectangle',shape:'box',w:120,h:42,material:'wood'},
  ramp:{name:'Wall / ramp',shape:'box',w:240,h:16,material:'wood',fixed:true},
  bowling:{name:'Bowling ball',shape:'circle',w:54,h:54,material:'steel'},
  basketball:{name:'Basketball',shape:'circle',w:58,h:58,material:'rubber'},
  balloon:{name:'Balloon',shape:'circle',w:60,h:60,material:'helium'},
  trampoline:{name:'Spring',shape:'box',w:120,h:18,material:'rubber',fixed:true},
  fan:{name:'Fan',shape:'box',w:70,h:70,material:'steel',fixed:true},
  bell:{name:'Bell',shape:'circle',w:62,h:62,material:'steel',fixed:true,sensor:true},
  bucket:{name:'Bucket',shape:'bucket',w:130,h:110,material:'steel',fixed:true},
  anchor:{name:'Anchor',shape:'circle',w:24,h:24,material:'steel',fixed:true},
  wheel:{name:'Belt wheel',shape:'circle',w:62,h:62,material:'wood',pinned:true},
  pulley:{name:'Pulley',shape:'circle',w:62,h:62,material:'wood',pinned:true},
  motor:{name:'Motor',shape:'circle',w:78,h:78,material:'steel',pinned:true},
  conveyor:{name:'Conveyor',shape:'box',w:220,h:22,material:'rubber',fixed:true},
  switch:{name:'Switch',shape:'box',w:42,h:22,material:'rubber',fixed:true,sensor:true,on:false},
  'material-zone':{name:'Material zone',shape:'box',w:220,h:160,material:'steel',fixed:true,sensor:true,outputMaterial:'steel'},
  rocket:{name:'Rocket',shape:'box',w:32,h:72,material:'wood',on:false},
};
export const ENVIRONMENT={width:1600,height:1000,gravity:850,pressure:1,floor:true};
export const uid=()=>crypto.randomUUID();
export function makePart(kind,x,y,overrides={}){
  if(!Object.hasOwn(PARTS,kind))throw Error('Unknown component.');
  const spec=PARTS[kind];
  return {id:uid(),kind,x,y,w:spec.w,h:spec.h,angle:0,material:spec.material,...(spec.outputMaterial?{outputMaterial:spec.outputMaterial}:{}),fixed:!!spec.fixed,pinned:!!spec.pinned,locked:false,power:1,direction:1,on:spec.on!==false,...overrides};
}
const DESIGN_KEYS=['id','kind','x','y','w','h','angle','material','outputMaterial','fixed','pinned','locked','power','direction','on','stock'];
export function designPart(body){return Object.fromEntries(DESIGN_KEYS.filter(key=>body[key]!==undefined).map(key=>[key,body[key]]));}
export function blankLevel(){return {format:'contraption',version:3,name:'Workshop',mode:'sandbox',environment:{...ENVIRONMENT},bodies:[],connections:[],inventory:[],goal:null};}
export function starterLevel(){
  const level=blankLevel();
  level.bodies=[makePart('circle',290,130,{w:56,h:56}),makePart('ramp',340,330,{angle:.19,w:370}),makePart('ramp',760,480,{angle:.2,w:340}),makePart('ramp',1090,625,{angle:.19,w:260}),makePart('bell',1395,845),...Array.from({length:4},(_,i)=>makePart('box',1200+i*45,880,{w:22,h:100,material:['wood','cork','rubber','wood'][i]})),makePart('basketball',670,145),makePart('box',760,810,{w:170,h:40,angle:.08}),makePart('box',780,750,{w:50,h:50}),makePart('bucket',330,873)];
  return level;
}
function number(value,label,min,max){if(!Number.isFinite(value)||value<min||value>max)throw Error(`${label} must be between ${min} and ${max}.`);return value;}
function integer(value,label,min,max){number(value,label,min,max);if(!Number.isInteger(value))throw Error(`${label} must be a whole number.`);return value;}
function parsePart(source,ids,prototype=false){
  if(!source||!Object.hasOwn(PARTS,source.kind))throw Error('Invalid component type.');
  const p=makePart(source.kind,prototype?0:number(source.x,'X',-4000,6000),prototype?0:number(source.y,'Y',-4000,6000));
  if(!prototype){if(typeof source.id!=='string'||!source.id.length||ids.has(source.id))throw Error('Component IDs must be unique.');p.id=source.id;ids.add(p.id);}
  p.w=number(source.w??p.w,'Width',12,1200);p.h=number(source.h??p.h,'Height',12,1200);
  if(PARTS[p.kind].shape==='circle')p.h=p.w;
  p.angle=number(source.angle??0,'Angle',-100000,100000);
  if(source.material!==undefined&&!Object.hasOwn(MATERIALS,source.material))throw Error('Invalid material.');p.material=source.material??p.material;
  if(p.kind==='material-zone'){
    if(source.outputMaterial!==undefined&&!Object.hasOwn(MATERIALS,source.outputMaterial))throw Error('Unknown output material.');p.outputMaterial=source.outputMaterial??p.outputMaterial;
    if(source.fixed===false||source.pinned===true)throw Error('Material zones must be fixed.');p.fixed=true;p.pinned=false;
  }else if(source.outputMaterial!==undefined)throw Error('Only material zones have an output material.');
  for(const k of ['fixed','pinned','locked','on'])if(source[k]!==undefined){if(typeof source[k]!=='boolean')throw Error(`Invalid ${k} setting.`);p[k]=source[k];}
  p.power=number(source.power??1,'Power',0,5);p.direction=source.direction===-1?-1:1;
  if(source.stock!==undefined){if(typeof source.stock!=='string')throw Error('Invalid inventory reference.');p.stock=source.stock;}
  if(prototype){delete p.id;delete p.stock;}
  return p;
}
export function parseLevel(source){
  if(!source||source.format!=='contraption'||source.version!==3)throw Error('This file is not a Contraption v3 level.');
  if(!Array.isArray(source.bodies)||source.bodies.length>100||!Array.isArray(source.connections)||source.connections.length>100)throw Error('A level can contain up to 100 objects and 100 connections.');
  const env=source.environment??{},level=blankLevel(),ids=new Set();
  level.name=typeof source.name==='string'?source.name.slice(0,80):'Imported level';
  if(!['sandbox','puzzle','editor'].includes(source.mode))throw Error('Invalid level mode.');level.mode=source.mode;
  level.environment={width:number(env.width??1600,'World width',600,4000),height:number(env.height??1000,'World height',500,3000),gravity:number(env.gravity??850,'Gravity',0,1600),pressure:number(env.pressure??1,'Pressure',0,5),floor:env.floor!==false};
  level.bodies=source.bodies.map(p=>parsePart(p,ids));
  const bodies=new Map(level.bodies.map(p=>[p.id,p]));
  level.connections=source.connections.map(c=>{
    if(!c||!['rope','belt','wire'].includes(c.kind)||typeof c.id!=='string'||!c.id.length||ids.has(c.id)||!bodies.has(c.a)||!bodies.has(c.b)||c.a===c.b)throw Error('Invalid connection endpoints.');
    ids.add(c.id);const joint={id:c.id,kind:c.kind,a:c.a,b:c.b,length:number(c.length??100,'Connection length',1,10000),via:[],ax:number(c.ax??0,'Anchor X',-1200,1200),ay:number(c.ay??0,'Anchor Y',-1200,1200),bx:number(c.bx??0,'Anchor X',-1200,1200),by:number(c.by??0,'Anchor Y',-1200,1200)};
    if(c.via!==undefined){if(!Array.isArray(c.via)||c.via.length>8||c.via.some(id=>!level.bodies.some(p=>p.id===id&&p.kind==='pulley')))throw Error('Ropes must route through valid pulleys.');joint.via=[...c.via];}
    if(joint.kind==='rope'){
      if([c.a,c.b].some(id=>bodies.get(id).kind==='pulley'))throw Error('Thread a pulley in the middle of a rope; attach the ends to loads or anchors.');
      if(new Set(joint.via).size!==joint.via.length)throw Error('A rope can pass through each pulley once.');
      joint.wrap=c.wrap??ropeWrap(level.bodies,joint);
      if(!Array.isArray(joint.wrap)||joint.wrap.length!==joint.via.length||joint.wrap.some(s=>s!==1&&s!==-1))throw Error('Each pulley needs a clockwise or counterclockwise rope route.');
      joint.wrap=[...joint.wrap];
      if(!ropeGeometry(level.bodies,joint).valid)throw Error('A rope anchor is inside a pulley or the pulleys are too close.');
    }
    if(joint.kind==='belt'){
      const ends=[c.a,c.b].map(id=>bodies.get(id));if(ends.some(p=>!['motor','wheel','conveyor'].includes(p.kind)))throw Error('Belts connect motors, belt wheels, and conveyors.');
      if(Math.hypot(ends[0].x-ends[1].x,ends[0].y-ends[1].y)>650)throw Error('A belt cannot span more than 650 units.');
    }
    if(joint.kind==='wire'&&(bodies.get(c.a).kind!=='switch'||!['fan','motor','conveyor','rocket'].includes(bodies.get(c.b).kind)))throw Error('Wires connect a switch to a device.');
    return joint;
  });
  if(!Array.isArray(source.inventory)||source.inventory.length>60)throw Error('Invalid parts bin.');const stockIds=new Set();
  level.inventory=source.inventory.map(entry=>{if(!entry||typeof entry.id!=='string'||!entry.id.length||stockIds.has(entry.id))throw Error('Inventory IDs must be unique.');stockIds.add(entry.id);return{id:entry.id,part:designPart(parsePart(entry.part,new Set(),true)),quantity:integer(entry.quantity,'Inventory quantity',0,100)};});
  for(const p of level.bodies)if(p.stock&&!stockIds.has(p.stock))throw Error('An object refers to missing inventory.');
  for(const entry of level.inventory)if(level.bodies.filter(p=>p.stock===entry.id).length>entry.quantity)throw Error('Placed objects exceed the available inventory.');
  if(source.goal){const g=source.goal;if(!['region','edge','state'].includes(g.kind)||typeof g.target!=='string'||!(g.target==='any'||bodies.has(g.target)||Object.hasOwn(PARTS,g.target)))throw Error('Invalid goal or target.');
    level.goal={kind:g.kind,target:g.target,count:integer(g.count??1,'Goal count',1,100),delay:number(g.delay??0,'Goal delay',0,120),x:number(g.x??1200,'Goal X',-4000,6000),y:number(g.y??700,'Goal Y',-4000,6000),w:number(g.w??180,'Goal width',20,2000),h:number(g.h??180,'Goal height',20,2000),edge:g.edge??'right',state:g.state??'rung'};
    if(!['left','right','top','bottom'].includes(level.goal.edge)||!['rung','on','fired','popped'].includes(level.goal.state))throw Error('Invalid goal condition.');
  }
  if(level.mode==='puzzle'&&!level.goal)throw Error('A puzzle needs a goal.');
  return level;
}
