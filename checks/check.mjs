import './rope.mjs';
import './transformation.mjs';
import './rewind.mjs';
import './interface.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {blankLevel,makePart,parseLevel,PARTS} from '../dist/model.js';
import {createWorld,stepWorld,connectionPoints,pathLength,overlaps} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';
const simulate=(world,seconds)=>{for(let i=0;i<seconds*120;i++)stepWorld(world);return world;};
const solveTime=(world,seconds=20)=>{for(let frame=1;frame<=seconds*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};
const overlapPairs=world=>{const pairs=[];for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++)if(!PARTS[world.bodies[i].kind].sensor&&!PARTS[world.bodies[j].kind].sensor&&overlaps(world.bodies[i],world.bodies[j]))pairs.push([world.bodies[i].id,world.bodies[j].id]);return pairs;};
const insideBucket=(world,bodyId,bucketId)=>{const body=world.bodies.find(body=>body.id===bodyId),bucket=world.bodies.find(body=>body.id===bucketId);return Math.abs(body.x-bucket.x)<bucket.w/2-12&&body.y>bucket.y-bucket.h/2&&body.y<bucket.y+bucket.h/2-8;};
const scene=(bodies,connections=[],environment={})=>({...blankLevel(),bodies,connections,environment:{width:1600,height:1000,gravity:850,pressure:0,floor:false,...environment}});
const part=(kind,x,y,properties={})=>makePart(kind,x,y,properties);
{
  const world=createWorld(scene([part('box',300,200)]));simulate(world,.5);assert.ok(Math.abs(world.bodies[0].vy-425)<1e-6);assert.ok(world.bodies[0].y>300);assert.equal(world.bodies[0].omega,0);
}
{
  const world=createWorld(scene(Array.from({length:4},(_,i)=>part('box',800,915-i*50,{w:80,h:50})),[],{floor:true}));simulate(world,20);assert.ok(world.bodies.every(b=>Math.abs(b.x-800)<3));
}
{
  const world=createWorld(scene([part('circle',110,300,{w:12,h:12,material:'steel'}),part('ramp',160,300,{w:12,h:300})],[],{gravity:0}));world.bodies[0].vx=2200;stepWorld(world,.1);assert.ok(world.bodies[0].vx<0);assert.ok(world.bodies[0].x<160);
}
{
  const bodies=[part('motor',100,300,{id:'motor',on:false,power:3,direction:-1}),part('wheel',300,300,{id:'wheel'}),part('conveyor',500,300,{id:'belt'})];
  const connections=[{id:'b1',kind:'belt',a:'wheel',b:'belt',length:200},{id:'b2',kind:'belt',a:'wheel',b:'motor',length:200}];
  const world=createWorld(parseLevel(scene(bodies,connections)));stepWorld(world);assert.equal(world.bodies[2].active,false);world.bodies[0].on=true;stepWorld(world);assert.equal(world.bodies[2].active,true);assert.equal(world.bodies[2].power,3);assert.equal(world.bodies[2].direction,-1);assert.ok(world.bodies[1].omega<0);
  const bad=scene(bodies,[...connections,{id:'b3',kind:'belt',a:'b1',b:'motor'}]);assert.throws(()=>parseLevel(bad),/endpoints/);
  bad.connections=connections;bad.goal={kind:'state',target:'b1'};assert.throws(()=>parseLevel(bad),/target/);
}
{
  const world=createWorld(parseLevel(scene([part('circle',100,260,{id:'a',w:30}),part('pulley',250,100,{id:'p'}),part('circle',400,260,{id:'b',w:30})],[{id:'r',kind:'rope',a:'a',b:'b',via:['p'],length:300}],{gravity:0})));simulate(world,1);assert.ok(Math.abs(pathLength(connectionPoints(world,world.connections[0]))-300)<.1);
}
{
  const world=createWorld(parseLevel(scene([part('switch',200,300,{id:'s'}),part('circle',200,300),part('rocket',600,300,{id:'r'})],[{id:'wire',kind:'wire',a:'s',b:'r'}],{gravity:0})));stepWorld(world);stepWorld(world);assert.equal(world.bodies[2].state,'fired');assert.ok(world.bodies[2].vy<0);
}
{
  const baseline=blankLevel();assert.throws(()=>parseLevel({...baseline,bodies:[{id:'x',kind:'toString',x:0,y:0}]}),/component/i);assert.throws(()=>parseLevel({...baseline,inventory:[null]}),/Inventory/);assert.throws(()=>parseLevel({...baseline,inventory:[{id:'stock',part:part('box',0,0),quantity:1.5}]}),/whole/);
  const workshop=new Workshop(scene([part('circle',400,200,{id:'ball'})]));workshop.selected='ball';workshop.update({x:500});assert.equal(workshop.world.bodies[0].x,500);workshop.undo();assert.equal(workshop.world.bodies[0].x,400);workshop.redo();assert.equal(workshop.world.bodies[0].x,500);workshop.reset();assert.equal(workshop.world.bodies[0].x,500);
}
const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url))),solutions=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const pulleyLevels=new Map([
  ['bellhop-express',4.95],
  ['two-to-one-takeaway',1.0583333333333333],
  ['pulley-gate-night-shift',1.8916666666666666],
]);
const transformationLevels=new Map([
  ['featherweight-freight',{seconds:14,wonAt:4.941666666666666,ball:'freight-ball',ramp:'freight-route',original:'steel',transforms:['cork'],ablations:[
    ['Steel ball must be too heavy for the fan',level=>{level.bodies.find(body=>body.id==='feather-zone').outputMaterial='steel';}],
    ['Featherweight Freight must need its fan',level=>{level.bodies.find(body=>body.id==='freight-fan').on=false;}],
  ]}],
  ['cloud-then-clunk',{seconds:14,wonAt:9.058333333333334,ball:'weather-ball',ramp:'weather-route',original:'steel',transforms:['cork','steel'],ablations:[
    ['Cloud, Then Clunk must need its fan',level=>{level.bodies.find(body=>body.id==='updraft').on=false;}],
    ['Cloud, Then Clunk must need its first zone',level=>{level.bodies.find(body=>body.id==='cloud-zone').outputMaterial='steel';}],
    ['Cloud, Then Clunk must need its second zone',level=>{level.bodies.find(body=>body.id==='clunk-zone').outputMaterial='cork';}],
    ['Cloud, Then Clunk must need its rope',level=>{level.connections=[];}],
  ]}],
  ['rubber-stamp',{seconds:12,wonAt:5.816666666666666,ball:'stamp-ball',ramp:'stamp-route',original:'steel',transforms:['rubber'],angleDelta:.025,ablations:[
    ['Steel must not rebound high enough',level=>{level.bodies.find(body=>body.id==='rubber-zone').outputMaterial='steel';}],
    ['Rubber Stamp must need its bounce plate',level=>{level.bodies=level.bodies.filter(body=>body.id!=='bounce-plate');}],
  ]}],
]);
assert.equal(solutions.length,pack.levels.length,'Every playable level needs one reference solution');
for(const [i,level] of pack.levels.entries()){
  assert.equal(simulate(createWorld(parseLevel(level)),20).won,false,`${level.name}: empty bin must fail`);
  const solved=parseLevel({...level,bodies:[...level.bodies,...solutions[i].parts.map(p=>part(p.kind,p.x,p.y,p))]});const world=simulate(createWorld(solved),20);assert.equal(world.won,true,`${level.name}: reference solution must win`);
  const again=parseLevel(JSON.parse(JSON.stringify(solved)));assert.deepEqual(again.bodies,solved.bodies);assert.deepEqual(again.connections,solved.connections);assert.deepEqual(again.goal,solved.goal);assert.deepEqual(again.inventory,solved.inventory);
  if(level.id==='pulley-gate'){
    for(const omitted of ['drop-weight','rope','movable']){const blocked=structuredClone(solved);if(omitted==='drop-weight')blocked.bodies=blocked.bodies.filter(b=>b.id!==omitted);if(omitted==='rope')blocked.connections=[];if(omitted==='movable')blocked.bodies.find(b=>b.id==='movable-pulley').pinned=true;assert.equal(simulate(createWorld(blocked),20).won,false,`Door must need ${omitted}`);}
    for(const [dx,da] of [[-8,0],[8,0],[0,-.03],[0,.03]]){const nearby=structuredClone(solved),ramp=nearby.bodies.find(b=>b.stock);ramp.x+=dx;ramp.angle+=da;assert.equal(simulate(createWorld(nearby),20).won,true,'Nearby ramp placement must work');}
    const reset=new Workshop(solved),first=simulate(reset.world,8);const outcome=structuredClone(first);reset.reset();assert.deepEqual(simulate(reset.world,8),outcome);
  }
  if(pulleyLevels.has(level.id)){
    const noRope=structuredClone(solved);noRope.connections=[];assert.equal(simulate(createWorld(noRope),20).won,false,`${level.name}: solution must need its rope`);
    assert.deepEqual(overlapPairs(createWorld(solved)),[],`${level.name}: reference must start without overlaps`);
    const reset=new Workshop(solved),expected=pulleyLevels.get(level.id),first=solveTime(reset.world);assert.equal(first,expected,`${level.name}: solve time changed`);reset.reset();assert.equal(solveTime(reset.world),first,`${level.name}: reset changed solve time`);
    for(let partIndex=0;partIndex<solutions[i].parts.length;partIndex++)for(const [field,delta] of [['x',-6],['x',6],['y',-6],['y',6]]){
      const parts=structuredClone(solutions[i].parts);parts[partIndex][field]+=delta;const nearby=parseLevel({...level,bodies:[...level.bodies,...parts.map(p=>part(p.kind,p.x,p.y,p))]}),nearbyWorld=createWorld(nearby);
      assert.deepEqual(overlapPairs(nearbyWorld),[],`${level.name}: nearby ${parts[partIndex].id} must not overlap`);assert.notEqual(solveTime(nearbyWorld),null,`${level.name}: nearby ${parts[partIndex].id} ${field} ${delta} must win`);
    }
  }
  if(level.id==='rock-delivery'){
    const withoutRope=structuredClone(solved);withoutRope.connections=[];assert.equal(simulate(createWorld(withoutRope),12).won,false,'Rock Delivery must need its rope');
    const unchanged=structuredClone(solved);unchanged.bodies.find(body=>body.id==='stone-zone').outputMaterial='cork';const unchangedWorld=simulate(createWorld(unchanged),12);assert.equal(unchangedWorld.won,false,'Cork must be too light');assert.equal(insideBucket(unchangedWorld,'delivery-ball','stone-bucket'),true,'Unchanged cork must reach the bucket');
    const disabled=structuredClone(solved);disabled.bodies=disabled.bodies.filter(body=>body.id!=='stone-zone');const disabledWorld=simulate(createWorld(disabled),12);assert.equal(disabledWorld.won,false,'Disabled zone must fail');assert.equal(insideBucket(disabledWorld,'delivery-ball','stone-bucket'),true,'Ball must reach the bucket without transformation');
    const bypass=structuredClone(solved);Object.assign(bypass.bodies.find(body=>body.stock==='delivery-ramp'),{x:670,y:350,angle:.12});const bypassWorld=simulate(createWorld(bypass),9);assert.equal(bypassWorld.won,false,'Route around zone must fail');assert.deepEqual(bypassWorld.bodies.find(body=>body.id==='delivery-ball').transformedZones,[]);assert.equal(insideBucket(bypassWorld,'delivery-ball','stone-bucket'),true,'Bypass must still reach the bucket');
    const reset=new Workshop(solved),first=solveTime(reset.world);assert.equal(first,6.866666666666666);reset.reset();assert.equal(reset.world.bodies.find(body=>body.id==='delivery-ball').material,'cork');assert.deepEqual(reset.world.bodies.find(body=>body.id==='delivery-ball').transformedZones,[]);assert.equal(solveTime(reset.world),first,'Rock Delivery reset must preserve solve time');
  }
  if(transformationLevels.has(level.id)){
    const test=transformationLevels.get(level.id),reference=createWorld(solved),transforms=[];let wonAt=null;for(let frame=1;frame<=test.seconds*120;frame++){transforms.push(...stepWorld(reference).filter(event=>event.kind==='transform').map(event=>event.material));if(reference.won&&wonAt===null)wonAt=frame/120;}
    assert.equal(wonAt,test.wonAt);assert.deepEqual(transforms,test.transforms);assert.equal(reference.bodies.find(body=>body.id===test.ball).material,test.transforms.at(-1));assert.deepEqual(overlapPairs(createWorld(solved)),[]);
    for(const [message,mutate] of test.ablations){const ablation=structuredClone(solved);mutate(ablation);assert.equal(simulate(createWorld(ablation),test.seconds).won,false,message);}
    for(const [field,delta] of [['x',-8],['x',8],['y',-8],['y',8],['angle',-(test.angleDelta??.02)],['angle',test.angleDelta??.02]]){const nearby=structuredClone(solved);nearby.bodies.find(body=>body.stock===test.ramp)[field]+=delta;const nearbyWorld=createWorld(nearby);assert.deepEqual(overlapPairs(nearbyWorld),[]);assert.notEqual(solveTime(nearbyWorld,test.seconds),null,`${level.name} nearby ${field} ${delta} must win`);}
    const reset=new Workshop(solved),first=solveTime(reset.world,test.seconds);reset.reset();assert.equal(reset.world.bodies.find(body=>body.id===test.ball).material,test.original);assert.equal(solveTime(reset.world,test.seconds),first,`${level.name} reset must preserve solve time`);
  }
  if(level.id==='rocket-counterweight'){
    const baseline=createWorld(parseLevel(level));simulate(baseline,12);assert.notEqual(baseline.bodies.find(body=>body.id==='launch-switch').state,'on','Empty bin must not flip the switch');assert.notEqual(baseline.bodies.find(body=>body.id==='down-rocket').state,'fired','Empty bin must not fire the rocket');
    const reference=createWorld(solved);let switchAt=null,firedAt=null,wonAt=null;for(let frame=1;frame<=12*120;frame++){stepWorld(reference);if(reference.bodies.find(body=>body.id==='launch-switch').state==='on'&&switchAt===null)switchAt=frame/120;if(reference.bodies.find(body=>body.id==='down-rocket').state==='fired'&&firedAt===null)firedAt=frame/120;if(reference.won&&wonAt===null)wonAt=frame/120;}
    assert.equal(switchAt,2.4,'Ramp must deliver the ball to the switch');assert.equal(firedAt,2.408333333333333,'Wire must fire the rocket after the switch');assert.equal(wonAt,2.9166666666666665,'Rocket counterweight must ring the bell');assert.deepEqual(overlapPairs(createWorld(solved)),[],'Rocket Counterweight must start without solid overlaps');
    const ablations=[['wire',level=>{level.connections=level.connections.filter(connection=>connection.kind!=='wire');}],['rope',level=>{level.connections=level.connections.filter(connection=>connection.kind!=='rope');}],['rocket power',level=>{level.bodies.find(body=>body.id==='down-rocket').power=0;}]];
    for(const [name,mutate] of ablations){const ablation=structuredClone(solved);mutate(ablation);assert.equal(simulate(createWorld(ablation),12).won,false,`Rocket Counterweight must need its ${name}`);}
    for(const [field,delta] of [['x',-8],['x',8],['y',-8],['y',8],['angle',-.03],['angle',.03]]){const nearby=structuredClone(solved);nearby.bodies.find(body=>body.stock==='trigger-ramp')[field]+=delta;const nearbyWorld=createWorld(nearby);assert.deepEqual(overlapPairs(nearbyWorld),[]);assert.notEqual(solveTime(nearbyWorld,12),null,`Rocket Counterweight nearby ${field} ${delta} must win`);}
    const reset=new Workshop(solved),first=solveTime(reset.world,12);assert.equal(first,wonAt);reset.reset();assert.equal(solveTime(reset.world,12),first,'Rocket Counterweight reset must preserve solve time');
  }
  if(level.id==='flywheel-express'){
    const baseline=createWorld(parseLevel(level));simulate(baseline,10);const baselineWheel=baseline.bodies.find(body=>body.id==='launch-wheel'),baselineRider=baseline.bodies.find(body=>body.id==='wheel-rider');assert.notEqual(baseline.bodies.find(body=>body.id==='flywheel-switch').state,'on','Empty bin must not flip the switch');assert.equal(baseline.bodies.find(body=>body.id==='flywheel-motor').active,false,'Empty bin must not power the motor');assert.equal(baselineWheel.omega,0,'Empty-bin flywheel must remain stationary');assert.ok(Math.abs(baselineRider.x-baselineWheel.x)<1&&baselineRider.y<baselineWheel.y&&Math.abs(baselineRider.vx)+Math.abs(baselineRider.vy)+Math.abs(baselineRider.omega)<1e-6,'Rider must balance on the stationary flywheel');
    const reference=createWorld(solved);let switchAt=null,motorAt=null,wonAt=null;for(let frame=1;frame<=10*120;frame++){stepWorld(reference);if(reference.bodies.find(body=>body.id==='flywheel-switch').state==='on'&&switchAt===null)switchAt=frame/120;if(reference.bodies.find(body=>body.id==='flywheel-motor').active&&motorAt===null)motorAt=frame/120;if(reference.won&&wonAt===null)wonAt=frame/120;}
    assert.equal(switchAt,2.3916666666666666,'Ramp must deliver the ball to the switch');assert.equal(motorAt,2.4,'Wire must power the motor after the switch');assert.equal(wonAt,3.1,'Flywheel must launch its rider into the bell');assert.deepEqual(overlapPairs(createWorld(solved)),[],'Flywheel Express must start without solid overlaps');
    const ablations=[['wire',level=>{level.connections=level.connections.filter(connection=>connection.kind!=='wire');}],['belt',level=>{level.connections=level.connections.filter(connection=>connection.kind!=='belt');}],['motor power',level=>{level.bodies.find(body=>body.id==='flywheel-motor').power=0;}]];for(const [name,mutate] of ablations){const ablation=structuredClone(solved);mutate(ablation);assert.equal(simulate(createWorld(ablation),10).won,false,`Flywheel Express must need its ${name}`);}
    for(const [field,delta] of [['x',-8],['x',8],['y',-8],['y',8],['angle',-.03],['angle',.03]]){const nearby=structuredClone(solved);nearby.bodies.find(body=>body.stock==='flywheel-trigger-ramp')[field]+=delta;const nearbyWorld=createWorld(nearby);assert.deepEqual(overlapPairs(nearbyWorld),[]);assert.notEqual(solveTime(nearbyWorld,10),null,`Flywheel Express nearby ${field} ${delta} must win`);}
    const reset=new Workshop(solved),first=solveTime(reset.world,10);assert.equal(first,wonAt);reset.reset();assert.equal(solveTime(reset.world,10),first,'Flywheel Express reset must preserve solve time');
  }
  console.log(`PASS ${level.name}`);
}
console.log('PASS gravity, stacks, thin collisions, belt chains, ropes, material zones, switches, strict imports, undo, puzzle solutions and JSON round trips');
