import {setMass} from './physics.js';
const BODY_FIELDS=['x','y','angle','vx','vy','omega','sheaveAngle','state','active','exited','lastImpact','material','power','direction','on','transformedZones','triggeredBy'];
const CONNECTION_FIELDS=['tension','routeCrossed','blocked','arcSweeps'];
const copy=value=>Array.isArray(value)?[...value]:value;
const state=(items,fields)=>items.map(item=>fields.map(field=>copy(item[field])));
const apply=(items,fields,values)=>items.forEach((item,index)=>fields.forEach((field,fieldIndex)=>{const value=values[index][fieldIndex];if(value===undefined)delete item[field];else item[field]=copy(value);}));
const snapshot=world=>({time:world.time,reactions:world.reactions,goalHeld:world.goalHeld,won:world.won,bodies:state(world.bodies,BODY_FIELDS),connections:state(world.connections,CONNECTION_FIELDS)});
const restore=(world,saved)=>{
  apply(world.bodies,BODY_FIELDS,saved.bodies);for(const body of world.bodies){body.held=false;setMass(body);}apply(world.connections,CONNECTION_FIELDS,saved.connections);
  Object.assign(world,{time:saved.time,reactions:saved.reactions,goalHeld:saved.goalHeld,won:saved.won,events:[],cachedContacts:[]});delete world.cachedDt;
};
export class WorldTimeline{
  constructor({seconds=15,samplesPerSecond=30}={}){if(seconds<=0||samplesPerSecond<=0)throw Error('Rewind duration and sample rate must be positive.');this.interval=1/samplesPerSecond;this.capacity=Math.ceil(seconds*samplesPerSecond)+1;this.snapshots=[];this.rewinding=false;this.revision=null;this.bodyIds=[];this.connectionIds=[];}
  matches(world){return this.bodyIds.length===world.bodies.length&&this.connectionIds.length===world.connections.length&&this.bodyIds.every((id,index)=>id===world.bodies[index].id)&&this.connectionIds.every((id,index)=>id===world.connections[index].id);}
  reset(world,revision=0){this.bodyIds=world.bodies.map(body=>body.id);this.connectionIds=world.connections.map(connection=>connection.id);this.snapshots=[snapshot(world)];this.cursor=0;this.position=world.time;this.rewinding=false;this.revision=revision;return this;}
  ensure(world,revision=0){if(this.revision!==revision||!this.matches(world))this.reset(world,revision);return this;}
  record(world,revision=0,force=false){this.ensure(world,revision);if(this.rewinding)return false;const latest=this.snapshots.at(-1);if(world.time<latest.time-1e-9){this.reset(world,revision);return true;}if(Math.abs(world.time-latest.time)<1e-9){this.snapshots[this.snapshots.length-1]=snapshot(world);return false;}if(!force&&world.time-latest.time<this.interval-1e-9)return false;this.snapshots.push(snapshot(world));if(this.snapshots.length>this.capacity)this.snapshots.shift();this.cursor=this.snapshots.length-1;this.position=world.time;return true;}
  start(world,revision=0){this.ensure(world,revision);this.record(world,revision,true);if(this.snapshots.length<2)return false;this.rewinding=true;this.cursor=this.snapshots.length-1;this.position=this.snapshots[this.cursor].time;return true;}
  rewind(world,seconds){if(!this.rewinding||!Number.isFinite(seconds)||seconds<=0)return false;this.position=Math.max(this.snapshots[0].time,this.position-seconds);while(this.cursor>0&&Math.abs(this.snapshots[this.cursor-1].time-this.position)<=Math.abs(this.snapshots[this.cursor].time-this.position))this.cursor--;restore(world,this.snapshots[this.cursor]);return true;}
  stop(world){if(!this.rewinding)return false;this.rewinding=false;this.snapshots.length=this.cursor+1;this.cursor=this.snapshots.length-1;this.position=world.time;world.events=[];world.cachedContacts=[];delete world.cachedDt;return true;}
  get canRewind(){return this.snapshots.length>1&&(!this.rewinding||this.cursor>0);}
  get length(){return this.snapshots.length;}
  get oldestTime(){return this.snapshots[0]?.time??0;}
  get latestTime(){return this.snapshots.at(-1)?.time??0;}
}
