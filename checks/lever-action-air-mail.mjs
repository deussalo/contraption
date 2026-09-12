import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLevel,PARTS} from '../dist/model.js';
import {createWorld,overlaps,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url)));
const references=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const index=pack.levels.findIndex(level=>level.id==='lever-action-air-mail');
assert.notEqual(index,-1,'Lever-Action Air Mail must remain in the playable catalog');
const level=parseLevel(pack.levels[index]),reference=references[index];
const families=[{name:reference.name,parts:reference.parts},...reference.alternatives];
const build=(source,parts)=>parseLevel({...source,bodies:[...source.bodies,...parts]});
const solidOverlaps=world=>{
  const pairs=[];
  for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++)if(!PARTS[world.bodies[i].kind].sensor&&!PARTS[world.bodies[j].kind].sensor&&overlaps(world.bodies[i],world.bodies[j]))pairs.push([world.bodies[i].id,world.bodies[j].id]);
  return pairs;
};
const timeline=source=>{
  const world=createWorld(source),transforms=[];
  let transformAt=null,leverReverseAt=null,ballLaunchAt=null,ballRampAt=null,springAt=null,springWho=null,switchAt=null,firedAt=null,rocketRampAt=null,bellAt=null,wonAt=null;
  for(let frame=1;frame<=10*120;frame++){
    const events=stepWorld(world),time=frame/120,lever=world.bodies.find(body=>body.id==='sorting-lever'),ball=world.bodies.find(body=>body.id==='mail-ball'),rocket=world.bodies.find(body=>body.id==='mail-rocket'),trigger=world.bodies.find(body=>body.id==='launch-switch'),bell=world.bodies.find(body=>body.id==='priority-bell');
    const transformed=events.filter(event=>event.kind==='transform');transforms.push(...transformed.map(event=>event.material));
    if(transformed.length&&transformAt===null)transformAt=time;
    if(lever?.angle<0&&leverReverseAt===null)leverReverseAt=time;
    if(ball.vy<-100&&ballLaunchAt===null)ballLaunchAt=time;
    if(ballLaunchAt!==null&&events.some(event=>event.kind==='rubber'&&Math.hypot(event.x-ball.x,event.y-ball.y)<1)&&ballRampAt===null)ballRampAt=time;
    for(const event of events.filter(event=>event.kind==='trampoline'))if(springAt===null){springAt=time;springWho=Math.hypot(event.x-rocket.x,event.y-rocket.y)<Math.hypot(event.x-ball.x,event.y-ball.y)?'rocket':'ball';}
    if(trigger.state==='on'&&switchAt===null)switchAt=time;
    if(rocket.state==='fired'&&firedAt===null)firedAt=time;
    if(firedAt!==null&&events.some(event=>event.kind==='wood'&&Math.hypot(event.x-rocket.x,event.y-rocket.y)<1)&&rocketRampAt===null)rocketRampAt=time;
    if(bell.state==='rung'&&bellAt===null)bellAt=time;
    if(world.won&&wonAt===null)wonAt=time;
  }
  return{transformAt,leverReverseAt,ballLaunchAt,ballRampAt,springAt,springWho,switchAt,firedAt,rocketRampAt,bellAt,wonAt,transforms,bellSources:world.bodies.find(body=>body.id==='priority-bell').triggeredBy??[]};
};
const winTime=source=>timeline(source).wonAt;
const solveWorld=world=>{for(let frame=1;frame<=10*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};

assert.deepEqual(level.goal.hitBy,['mail-rocket'],'Only the mail rocket may complete Lever-Action Air Mail');
assert.deepEqual(level.inventory.map(entry=>[entry.id,entry.quantity,entry.part.angle,entry.part.resizable]),[
  ['stone-maker',1,0,false],['mail-ramp',1,0,false],['mail-spring',1,0,false],
],'Lever-Action Air Mail must present three neutral, fixed-size decisions');
assert.equal(winTime(level),null,'Lever-Action Air Mail empty bin must fail');
assert.equal(families.length,2,'Lever-Action Air Mail must retain two solution families');

const expected={
  'Far Rebound':{transformAt:.5916666666666667,leverReverseAt:1.125,ballLaunchAt:.8833333333333333,ballRampAt:2.8833333333333333,springAt:3.1166666666666667,springWho:'ball',switchAt:3.3,firedAt:3.3,rocketRampAt:4.05,bellAt:5.825,wonAt:5.825,transforms:['steel'],bellSources:['mail-rocket']},
  'Direct Dispatch':{transformAt:.5916666666666667,leverReverseAt:1.125,ballLaunchAt:.8833333333333333,ballRampAt:null,springAt:2.7416666666666667,springWho:'ball',switchAt:2.8916666666666666,firedAt:2.9,rocketRampAt:3.6333333333333333,bellAt:5.491666666666666,wonAt:5.491666666666666,transforms:['steel'],bellSources:['mail-rocket']},
};
for(const family of families){
  const solved=build(level,family.parts);
  assert.deepEqual(solidOverlaps(createWorld(solved)),[],`${family.name} must start without solid overlaps`);
  assert.deepEqual(timeline(solved),expected[family.name],`${family.name} interaction order changed`);
  for(const stock of ['stone-maker','mail-ramp','mail-spring'])assert.equal(winTime(build(level,family.parts.filter(part=>part.stock!==stock))),null,`${family.name} must require ${stock}`);
  for(const [name,mutate] of [
    ['angled ramp',(_source,parts)=>{parts.find(part=>part.stock==='mail-ramp').angle=0;}],
    ['aimed spring',(_source,parts)=>{parts.find(part=>part.stock==='mail-spring').angle=0;}],
    ['both directional choices',(_source,parts)=>{parts.find(part=>part.stock==='mail-ramp').angle=0;parts.find(part=>part.stock==='mail-spring').angle=0;}],
    ['spring impulse',(_source,parts)=>{parts.find(part=>part.stock==='mail-spring').power=0;}],
    ['lever',source=>{source.bodies=source.bodies.filter(body=>body.id!=='sorting-lever');}],
    ['moving lever',source=>{const lever=source.bodies.find(body=>body.id==='sorting-lever');lever.fixed=true;lever.pinned=false;}],
    ['wire',source=>{source.connections=[];}],
    ['steel transformation',(_source,parts)=>{parts.find(part=>part.stock==='stone-maker').outputMaterial='cork';}],
  ]){
    const source=structuredClone(level),parts=structuredClone(family.parts);mutate(source,parts);
    assert.equal(winTime(build(source,parts)),null,`${family.name} must require its ${name}`);
  }
  const variants=[];for(const stock of ['stone-maker','mail-ramp','mail-spring'])for(const [field,delta] of [['x',-6],['x',6],['y',-6],['y',6],...(stock==='stone-maker'?[]:[['angle',-.02],['angle',.02]])])variants.push([stock,field,delta]);
  for(const [stock,field,delta] of variants){const parts=structuredClone(family.parts);parts.find(part=>part.stock===stock)[field]+=delta;const nearby=build(level,parts),message=`${family.name} nearby ${stock} ${field} ${delta}`;assert.deepEqual(solidOverlaps(createWorld(nearby)),[],`${message} must not overlap`);assert.notEqual(winTime(nearby),null,`${message} must win`);}
  const workshop=new Workshop(solved),first=solveWorld(workshop.world);workshop.reset();assert.equal(workshop.world.bodies.find(body=>body.id==='cork-counterweight').material,'cork');assert.deepEqual(workshop.world.bodies.find(body=>body.id==='cork-counterweight').transformedZones,[]);assert.equal(workshop.world.bodies.find(body=>body.id==='mail-rocket').state,'off');assert.equal(solveWorld(workshop.world),first,`${family.name} reset must preserve solve time`);
}

assert.ok(expected['Far Rebound'].ballRampAt<expected['Far Rebound'].springAt,'Far Rebound must route the ball through ramp then spring');
assert.equal(expected['Direct Dispatch'].ballRampAt,null,'Direct Dispatch must reserve the ramp for the rocket');
assert.ok(expected['Direct Dispatch'].springAt<expected['Direct Dispatch'].firedAt<expected['Direct Dispatch'].rocketRampAt,'Direct Dispatch must route ball through spring, then rocket through ramp');
console.log('PASS Lever-Action Air Mail source-locked goal and two mechanically distinct solution families');
