import {PARTS,MATERIALS,uid,makePart,parseLevel,designPart} from './model.js';
import {createWorld,createBody,setMass,overlaps,connectionPoints,pathLength,ropeGeometry,ropeWrap} from './physics.js';
export class Workshop{
  constructor(level,running=false){this.history=[];this.future=[];this.selected=null;this.revision=0;this.load(level,running);}
  load(level,running=false){this.level=parseLevel(level);this.world=createWorld(this.level);this.running=running;this.attemptStarted=this.level.mode==='puzzle'&&running;this.selected=null;this.history=[];this.future=[];this.changed=true;this.revision++;}
  capture(){return{level:structuredClone(this.level),world:structuredClone(this.world),selected:this.selected,running:this.running,attemptStarted:this.attemptStarted};}
  restore(snapshot){Object.assign(this,structuredClone(snapshot));this.changed=true;}
  record(before){this.history.push(before);if(this.history.length>40)this.history.shift();this.future=[];this.world.cachedContacts=[];this.changed=true;this.revision++;}
  transaction(action){const before=this.capture();try{const result=action();this.record(before);return result;}catch(error){this.restore(before);throw error;}}
  restoreHistory(source,target){if(!source.length)return;target.push(this.capture());this.restore(source.pop());this.running=false;this.revision++;}
  undo(){this.requireConstruction();this.restoreHistory(this.history,this.future);}
  redo(){this.requireConstruction();this.restoreHistory(this.future,this.history);}
  reset(){this.world=createWorld(this.level);this.running=false;this.attemptStarted=false;this.selected=null;this.changed=true;this.revision++;}
  body(){return this.world.bodies.find(b=>b.id===this.selected);}
  beginAttempt(){if(this.level.mode==='puzzle')this.attemptStarted=true;}
  play(){this.beginAttempt();this.running=true;}
  pause(){this.running=false;}
  constructionEnabled(){return this.level.mode!=='puzzle'||!this.attemptStarted&&!this.running;}
  requireConstruction(){if(!this.constructionEnabled())throw Error('Reset the puzzle to edit.');}
  editable(body){return this.constructionEnabled()&&(this.level.mode!=='puzzle'||!body.locked);}
  canResize(body){return this.level.mode==='editor'||this.level.mode!=='puzzle'&&body.resizable;}
  remaining(entry){return entry.quantity-this.level.bodies.filter(b=>b.stock===entry.id).length;}
  available(kind){return this.level.inventory.find(e=>e.part.kind===kind&&this.remaining(e)>0);}
  newPart(kind,x,y,extra={},stockId){
    this.requireConstruction();
    if(this.level.bodies.length>=100)throw Error('The canvas holds 100 objects.');let options=extra;
    if(this.level.mode==='puzzle'){
      const entry=stockId?this.level.inventory.find(e=>e.id===stockId):this.available(kind);
      if(!entry||this.remaining(entry)<=0||entry.part.kind!==kind)throw Error('No more of this part in the bin.');options={...entry.part,...extra,id:uid(),stock:entry.id,locked:false,resizable:false};
    }
    return createBody(makePart(kind,x,y,{...options,x,y}));
  }
  canPlace(body){if(PARTS[body.kind].sensor)return true;return !this.world.bodies.some(other=>other.id!==body.id&&!PARTS[other.kind].sensor&&other.state!=='popped'&&overlaps(body,other,2))&&!(this.world.floor&&overlaps(body,this.world.floor,2));}
  insert(body){this.requireConstruction();this.level.bodies.push(designPart(body));this.world.bodies.push(body);this.selected=body.id;this.changed=true;}
  move(body,change){
    this.requireConstruction();if(!this.editable(body))throw Error('This object is locked.');if(!this.canResize(body)&&((change.w!==undefined&&change.w!==body.w)||(change.h!==undefined&&change.h!==body.h)))throw Error('This component has a fixed size.');if(body.kind==='material-zone'&&(change.fixed===false||change.pinned===true))throw Error('Material zones must be fixed.');if(change.outputMaterial!==undefined&&!Object.hasOwn(MATERIALS,change.outputMaterial))throw Error('Unknown output material.');Object.assign(body,change);setMass(body);for(const c of this.world.connections)if(c.kind==='rope'&&(c.a===body.id||c.b===body.id||c.via.includes(body.id))){delete c.arcSweeps;c.routeCrossed=false;c.blocked=false;}Object.assign(this.level.bodies.find(p=>p.id===body.id),designPart(body));this.world.cachedContacts=[];this.changed=true;
  }
  update(change){const body=this.body();if(!body)return;this.transaction(()=>{this.move(body,change);if(!this.canPlace(body))throw Error('Objects cannot overlap.');});}
  remove(){
    this.requireConstruction();
    const body=this.body();if(!body){const c=this.world.connections.find(c=>c.id===this.selected);if(!c)return;if(this.level.mode==='puzzle'&&[c.a,c.b].every(id=>this.level.bodies.find(b=>b.id===id)?.locked))throw Error('This connection is locked.');this.transaction(()=>{this.level.connections=this.level.connections.filter(j=>j.id!==c.id);this.world.connections=this.world.connections.filter(j=>j.id!==c.id);this.selected=null;});return;}
    if(!this.editable(body))throw Error('This object is locked.');this.transaction(()=>this.removeBody(body.id));
  }
  removeBody(id){for(const owner of [this.level,this.world]){owner.bodies=owner.bodies.filter(b=>b.id!==id);owner.connections=owner.connections.filter(c=>c.a!==id&&c.b!==id&&!c.via?.includes(id));}this.selected=null;this.world.cachedContacts=[];this.changed=true;}
  duplicate(){this.requireConstruction();const b=this.body();if(!b)return;if(!this.editable(b))throw Error('This object is locked.');
    const p=this.newPart(b.kind,b.x+b.w+15,b.y,{...designPart(b),id:uid(),x:b.x+b.w+15,locked:false},b.stock);
    if(!this.canPlace(p))throw Error('There is no room next to this object.');this.transaction(()=>this.insert(p));
  }
  toBin(){const b=this.body();if(!b||this.level.mode!=='editor')return;
    this.transaction(()=>{const p={...designPart(b),locked:false};delete p.stock;delete p.id;p.x=0;p.y=0;this.level.inventory.push({id:uid(),part:p,quantity:1});this.removeBody(b.id);});
  }
  addConnection(kind,a,b,anchors,via=[]){
    this.requireConstruction();
    if(this.level.connections.length>=100)throw Error('The canvas holds 100 connections.');
    if(via.length>8)throw Error('A rope can route through up to eight pulleys.');
    if(a===b)throw Error('Choose a different second object.');const first=this.world.bodies.find(p=>p.id===a),last=this.world.bodies.find(p=>p.id===b);
    if(!first||!last)throw Error('Connection endpoint is missing.');
    if(kind==='belt'&&(![first,last].every(p=>['motor','wheel','conveyor'].includes(p.kind))||Math.hypot(first.x-last.x,first.y-last.y)>650))throw Error('Belts join wheels and conveyors within 650 units.');
    if(kind==='wire'&&(first.kind!=='switch'||!['fan','motor','conveyor','rocket'].includes(last.kind)))throw Error('Connect a switch to a fan, motor, conveyor, or rocket.');
    if(kind==='rope'&&[first,last].some(p=>p.kind==='pulley'))throw Error('A pulley goes in the middle of the rope. Choose a load or anchor for the end.');
    if(new Set(via).size!==via.length)throw Error('This rope already passes through that pulley.');
    const joint={id:uid(),kind,a,b,...anchors,via,length:1};
    if(kind==='rope'){joint.wrap=ropeWrap(this.world.bodies,joint);if(!ropeGeometry(this.world.bodies,joint).valid)throw Error('The rope needs clearance around each pulley.');}
    joint.length=Math.max(1,kind==='rope'?ropeGeometry(this.world.bodies,joint).length:pathLength(connectionPoints(this.world,joint)));
    this.transaction(()=>{this.level.connections.push(structuredClone(joint));this.world.connections.push(joint);this.selected=joint.id;});
  }
  updateRope(change){
    this.requireConstruction();
    const joint=this.level.connections.find(c=>c.id===this.selected&&c.kind==='rope');if(!joint)return;
    if(this.level.mode==='puzzle'&&[joint.a,joint.b].every(id=>this.level.bodies.find(b=>b.id===id)?.locked))throw Error('This rope is locked.');
    this.transaction(()=>{const checked=parseLevel({...this.level,connections:this.level.connections.map(c=>c.id===joint.id?{...c,...change}:c)}).connections.find(c=>c.id===joint.id);Object.assign(joint,checked);const live=this.world.connections.find(c=>c.id===joint.id);Object.assign(live,checked,{tension:0,routeCrossed:false,blocked:false});delete live.arcSweeps;});
  }
  export(){const level=structuredClone(this.level);if(level.mode==='editor')level.mode='puzzle';return parseLevel(level);}
  setEnvironment(change){if(this.level.mode==='puzzle')throw Error('The puzzle environment is locked.');this.transaction(()=>{Object.assign(this.level.environment,change);Object.assign(this.world.environment,change);this.world.floor=createWorld(this.level).floor;});}
  setGoal(goal){if(this.level.mode==='puzzle')throw Error('The puzzle goal is locked.');const checked=goal===null?null:parseLevel({...this.level,goal}).goal;this.transaction(()=>{this.level.goal=checked;this.world.goal=structuredClone(checked);this.world.won=false;this.world.goalHeld=0;});}
}
