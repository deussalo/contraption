import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLevel} from '../dist/model.js';
import {createWorld,overlaps,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url)));
const references=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const index=pack.levels.findIndex(level=>level.id==='pendulum-bank-exchange');
assert.notEqual(index,-1,'Pendulum Bank Exchange must remain in the playable catalog');
const level=parseLevel(pack.levels[index]),reference=references[index],families=[{name:reference.name,parts:reference.parts},...reference.alternatives];
const build=(source,parts)=>parseLevel({...source,bodies:[...source.bodies,...parts]});
const overlapPairs=world=>{const pairs=[];for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++)if(overlaps(world.bodies[i],world.bodies[j]))pairs.push([world.bodies[i].id,world.bodies[j].id]);return pairs;};
const timeline=source=>{
  const world=createWorld(source),ball=world.bodies.find(body=>body.id==='wrecking-ball'),springs=world.bodies.filter(body=>body.kind==='trampoline'),springHits=Object.fromEntries(springs.map(spring=>[spring.id,null])),closest=Object.fromEntries(springs.map(spring=>[spring.id,Infinity]));
  let switchAt=null,fanAt=null,bellAt=null,wonAt=null,minX=Infinity,maxX=-Infinity,minY=Infinity,ropeBlocked=false;
  for(let frame=1;frame<=8*120;frame++){
    const events=stepWorld(world),time=frame/120;minX=Math.min(minX,ball.x);maxX=Math.max(maxX,ball.x);minY=Math.min(minY,ball.y);ropeBlocked||=world.connections.find(connection=>connection.id==='swing-rope')?.blocked??false;
    for(const spring of springs)closest[spring.id]=Math.min(closest[spring.id],Math.hypot(ball.x-spring.x,ball.y-spring.y));
    if(events.some(event=>event.kind==='switch')&&switchAt===null)switchAt=time;if(switchAt!==null&&ball.vx>10&&fanAt===null)fanAt=time;
    for(const event of events.filter(event=>event.kind==='trampoline')){const spring=springs.toSorted((a,b)=>Math.hypot(event.x-a.x,event.y-a.y)-Math.hypot(event.x-b.x,event.y-b.y))[0];if(spring&&springHits[spring.id]===null)springHits[spring.id]=time;}
    if(events.some(event=>event.kind==='bell')&&bellAt===null)bellAt=time;if(world.won&&wonAt===null)wonAt=time;
  }
  return{wonAt,switchAt,fanAt,bellAt,springHits,closest,minX,maxX,minY,ropeBlocked,triggeredBy:world.bodies.find(body=>body.id==='return-bell').triggeredBy??[]};
};
const winTime=source=>timeline(source).wonAt;
const solve=world=>{for(let frame=1;frame<=8*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};

assert.deepEqual(level.inventory.map(entry=>[entry.id,entry.quantity,entry.part.angle,entry.part.resizable]),[
  ['trigger-ramp',1,0,false],['kick-spring',1,0,false],['return-spring',1,0,false],
],'Pendulum Bank Exchange must present three neutral, fixed-size decisions');
assert.deepEqual([level.goal.kind,level.goal.target,level.goal.state,level.goal.hitBy],['state','return-bell','rung',['wrecking-ball']],'Only the wrecking ball may ring the return bell');
assert.equal(winTime(level),null,'Pendulum Bank Exchange empty bin must fail');assert.equal(families.length,2,'Pendulum Bank Exchange must retain two solution families');

const expected={
  'Stacked Slingshot':{wonAt:4.208333333333333,switchAt:2.058333333333333,fanAt:2.075,bellAt:4.208333333333333,springHits:{'placed-kick-spring':2.1416666666666666,'placed-return-spring':4.991666666666666},minSide:790},
  'Crosscourt Relay':{wonAt:6.558333333333334,switchAt:2.058333333333333,fanAt:2.075,bellAt:6.558333333333334,springHits:{'placed-kick-spring':null,'placed-return-spring':3.1166666666666667},maxSide:650},
};
const variants={
  'Stacked Slingshot':[['trigger-ramp','x',-8],['trigger-ramp','y',8],['trigger-ramp','angle',-.02],['trigger-ramp','angle',.02],['kick-spring','x',-1],['kick-spring','y',8],['kick-spring','angle',-.005],['return-spring','x',1],['return-spring','y',1],['return-spring','angle',.01]],
  'Crosscourt Relay':[['trigger-ramp','x',-8],['trigger-ramp','y',8],['trigger-ramp','angle',-.02],['trigger-ramp','angle',.02],['kick-spring','x',-8],['kick-spring','x',8],['kick-spring','y',-4],['kick-spring','y',4],['kick-spring','angle',-.02],['kick-spring','angle',.02],['return-spring','x',-1],['return-spring','x',1],['return-spring','y',-1],['return-spring','y',1],['return-spring','angle',-.01],['return-spring','angle',.01]],
};
for(const family of families){
  const solved=build(level,family.parts),result=timeline(solved),route=expected[family.name];assert.deepEqual(overlapPairs(createWorld(solved)),[],`${family.name} must start without overlaps`);
  for(const field of ['wonAt','switchAt','fanAt','bellAt','springHits'])assert.deepEqual(result[field],route[field],`${family.name} ${field} changed`);assert.equal(result.ropeBlocked,false,`${family.name} rope must remain routable`);assert.deepEqual(result.triggeredBy,['wrecking-ball'],`${family.name} bell source changed`);assert.ok(Object.values(result.closest).every(distance=>distance<105),`${family.name} must reach both spring decisions`);
  if(route.minSide)assert.ok(result.minX>route.minSide,'Stacked Slingshot must remain a compact right-side loop');if(route.maxSide)assert.ok(result.minX<route.maxSide,'Crosscourt Relay must cross left of the anchor');
  for(const stock of ['trigger-ramp','kick-spring','return-spring'])assert.equal(winTime(build(level,family.parts.filter(part=>part.stock!==stock))),null,`${family.name} must require ${stock}`);
  for(const stock of ['trigger-ramp','kick-spring','return-spring']){const parts=structuredClone(family.parts);parts.find(part=>part.stock===stock).angle=0;assert.equal(winTime(build(level,parts)),null,`${family.name} must require ${stock} orientation`);}
  const neutral=structuredClone(family.parts);for(const part of neutral)part.angle=0;assert.equal(winTime(build(level,neutral)),null,`${family.name} neutral layout must fail`);
  const powerless=structuredClone(family.parts);for(const part of powerless.filter(part=>part.kind==='trampoline'))part.power=0;assert.equal(winTime(build(level,powerless)),null,`${family.name} must require spring energy`);
  for(const [stock,field,delta] of variants[family.name]){const parts=structuredClone(family.parts);parts.find(part=>part.stock===stock)[field]+=delta;const nearby=build(level,parts),message=`${family.name} nearby ${stock} ${field} ${delta}`;assert.deepEqual(overlapPairs(createWorld(nearby)),[],`${message} must not overlap`);const nearbyResult=timeline(nearby);assert.notEqual(nearbyResult.wonAt,null,`${message} must win`);assert.equal(nearbyResult.ropeBlocked,false,`${message} rope must remain routable`);}
  for(const [name,mutate] of [['wire',source=>source.connections=source.connections.filter(connection=>connection.kind!=='wire')],['rope',source=>source.connections=source.connections.filter(connection=>connection.kind!=='rope')],['fan power',source=>source.bodies.find(body=>body.id==='pendulum-fan').power=0],['moving wrecking ball',source=>source.bodies.find(body=>body.id==='wrecking-ball').fixed=true],['taut rope',source=>source.connections.find(connection=>connection.id==='swing-rope').length+=120]]){const source=structuredClone(level);mutate(source);assert.equal(winTime(build(source,family.parts)),null,`${family.name} must require ${name}`);}
  const wrongSource=structuredClone(level);wrongSource.goal.hitBy=['starter-ball'];assert.equal(winTime(build(wrongSource,family.parts)),null,`${family.name} must not credit the starter ball`);
  const workshop=new Workshop(solved),first=solve(workshop.world);workshop.reset();assert.equal(workshop.world.connections.find(connection=>connection.id==='swing-rope').blocked,false);assert.equal(workshop.world.bodies.find(body=>body.id==='return-bell').state,'on');assert.equal(solve(workshop.world),first,`${family.name} reset must preserve solve time`);
}
assert.ok(Math.hypot(families[0].parts[1].x-families[1].parts[1].x,families[0].parts[1].y-families[1].parts[1].y)>200,'Kick spring families must be spatially distinct');
assert.ok(Math.hypot(families[0].parts[2].x-families[1].parts[2].x,families[0].parts[2].y-families[1].parts[2].y)>170,'Return spring families must be spatially distinct');
console.log('PASS Pendulum Bank Exchange wrecking-ball-locked goal and two distinct swing families');
