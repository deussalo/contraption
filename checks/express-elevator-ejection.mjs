import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLevel} from '../dist/model.js';
import {createWorld,overlaps,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url)));
const references=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const index=pack.levels.findIndex(level=>level.id==='express-elevator-ejection');
assert.notEqual(index,-1,'Express Elevator Ejection must remain in the playable catalog');
const level=parseLevel(pack.levels[index]),reference=references[index];
const families=[{name:reference.name,parts:reference.parts},...reference.alternatives];
const build=(source,parts)=>parseLevel({...source,bodies:[...source.bodies,...parts]});
const initialOverlaps=world=>{const pairs=[];for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++)if(overlaps(world.bodies[i],world.bodies[j]))pairs.push([world.bodies[i].id,world.bodies[j].id]);return pairs;};
const timeline=source=>{
  const world=createWorld(source),ball=world.bodies.find(body=>body.id==='express-ball'),ramp=world.bodies.find(body=>body.stock==='ejection-ramp');
  let liftStopAt=null,ejectAt=null,springAt=null,wonAt=null,nearRamp=false,ropeBlocked=false;const rampContacts=[];
  for(let frame=1;frame<=10*120;frame++){
    const events=stepWorld(world),time=frame/120,weight=world.bodies.find(body=>body.id==='drop-weight');
    if(weight.y>680&&Math.abs(weight.vy)<30&&liftStopAt===null)liftStopAt=time;
    if((ball.x<420||ball.x>580)&&ejectAt===null)ejectAt=time;
    if(events.some(event=>event.kind==='trampoline')&&springAt===null)springAt=time;
    if(ramp){const dx=ball.x-ramp.x,dy=ball.y-ramp.y,lx=dx*Math.cos(ramp.angle)+dy*Math.sin(ramp.angle),ly=-dx*Math.sin(ramp.angle)+dy*Math.cos(ramp.angle),near=Math.abs(lx)<ramp.w/2+ball.w/2&&Math.abs(ly)<ramp.h/2+ball.h/2+2;if(near&&!nearRamp)rampContacts.push(time);nearRamp=near;}
    ropeBlocked||=world.connections.find(connection=>connection.id==='elevator-rope')?.blocked??false;
    if(world.won){wonAt=time;break;}
  }
  return{liftStopAt,ejectAt,springAt,rampContacts,wonAt,ropeBlocked};
};
const winTime=source=>timeline(source).wonAt;
const solveWorld=world=>{for(let frame=1;frame<=10*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};

assert.deepEqual(level.inventory.map(entry=>[entry.id,entry.quantity,entry.part.angle,entry.part.resizable]),[
  ['weight-stop',1,0,false],['ejection-ramp',1,0,false],['catch-spring',1,0,false],
],'Express Elevator Ejection must present three neutral, fixed-size decisions');
assert.deepEqual([level.goal.kind,level.goal.target],['region','express-ball'],'Only the express parcel may complete the delivery');
assert.equal(winTime(level),null,'Express Elevator Ejection empty bin must fail');
assert.equal(families.length,2,'Express Elevator Ejection must retain two solution families');

const expected={
  'High Catch':{liftStopAt:1.7,ejectAt:2.4583333333333335,springAt:4.9,rampContacts:[1.5166666666666666,1.9583333333333333],wonAt:5.566666666666666,ropeBlocked:false},
  'Boomerang Bank':{liftStopAt:1.625,ejectAt:2.2916666666666665,springAt:2.9916666666666667,rampContacts:[1.6083333333333334,3.1166666666666667],wonAt:3.95,ropeBlocked:false},
};
const variants={
  'High Catch':[['weight-stop','x',-8],['weight-stop','x',8],['weight-stop','y',-4],['ejection-ramp','x',-2],['ejection-ramp','y',1],['ejection-ramp','angle',-.005],['catch-spring','x',-4],['catch-spring','x',4],['catch-spring','y',-4],['catch-spring','y',4],['catch-spring','angle',-.01],['catch-spring','angle',.02]],
  'Boomerang Bank':[['weight-stop','x',-6],['weight-stop','x',6],['weight-stop','y',6],['ejection-ramp','x',-6],['ejection-ramp','y',-6],['ejection-ramp','angle',.02],['catch-spring','x',6],['catch-spring','y',6],['catch-spring','angle',-.02],['catch-spring','angle',.02]],
};
for(const family of families){
  const solved=build(level,family.parts);assert.deepEqual(initialOverlaps(createWorld(solved)),[],`${family.name} must start without overlaps`);assert.deepEqual(timeline(solved),expected[family.name],`${family.name} interaction order changed`);
  for(const stock of ['weight-stop','ejection-ramp','catch-spring'])assert.equal(winTime(build(level,family.parts.filter(part=>part.stock!==stock))),null,`${family.name} must require ${stock}`);
  for(const [name,mutate] of [
    ['angled ramp',parts=>{parts.find(part=>part.stock==='ejection-ramp').angle=0;}],
    ['aimed spring',parts=>{parts.find(part=>part.stock==='catch-spring').angle=0;}],
    ['spring power',parts=>{parts.find(part=>part.stock==='catch-spring').power=0;}],
  ]){const parts=structuredClone(family.parts);mutate(parts);assert.equal(winTime(build(level,parts)),null,`${family.name} must require its ${name}`);}
  for(const [stock,field,delta] of variants[family.name]){const parts=structuredClone(family.parts);parts.find(part=>part.stock===stock)[field]+=delta;const nearby=build(level,parts),message=`${family.name} nearby ${stock} ${field} ${delta}`;assert.deepEqual(initialOverlaps(createWorld(nearby)),[],`${message} must not overlap`);assert.notEqual(winTime(nearby),null,`${message} must win`);}
  for(const [name,mutate] of [['rope',source=>{source.connections=[];}],['heavy counterweight',source=>{source.bodies.find(body=>body.id==='drop-weight').material='cork';}],['moving lift',source=>{source.bodies.find(body=>body.id==='lift-car').fixed=true;}]]){const source=structuredClone(level);mutate(source);assert.equal(winTime(build(source,family.parts)),null,`${family.name} must require its ${name}`);}
  const workshop=new Workshop(solved),first=solveWorld(workshop.world);workshop.reset();assert.equal(workshop.world.connections[0].blocked,false);assert.equal(solveWorld(workshop.world),first,`${family.name} reset must preserve solve time`);
}
assert.ok(expected['High Catch'].rampContacts.every(time=>time<expected['High Catch'].springAt),'High Catch must use ramp then spring');
assert.ok(expected['Boomerang Bank'].rampContacts[0]<expected['Boomerang Bank'].springAt&&expected['Boomerang Bank'].rampContacts[1]>expected['Boomerang Bank'].springAt,'Boomerang Bank must use ramp, spring, then the same ramp again');
console.log('PASS Express Elevator Ejection parcel-locked goal and two mechanically distinct solution families');
