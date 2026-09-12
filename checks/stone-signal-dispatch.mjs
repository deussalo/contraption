import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLevel,PARTS} from '../dist/model.js';
import {createWorld,overlaps,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url)));
const references=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const index=pack.levels.findIndex(level=>level.id==='stone-signal-dispatch');
assert.notEqual(index,-1,'Stone Signal Dispatch must remain in the catalog');
const level=pack.levels[index],reference=references[index],families=[reference,...reference.alternatives];
const build=(source,parts)=>parseLevel({...structuredClone(source),bodies:[...source.bodies,...structuredClone(parts)]});

function timeline(source,parts,seconds=14){
  const world=createWorld(build(source,parts)),initialOverlaps=[];
  for(let a=0;a<world.bodies.length;a++)for(let b=a+1;b<world.bodies.length;b++)if(!PARTS[world.bodies[a].kind].sensor&&!PARTS[world.bodies[b].kind].sensor&&overlaps(world.bodies[a],world.bodies[b]))initialOverlaps.push([world.bodies[a].id,world.bodies[b].id]);
  const times={transformAt:null,switchAt:null,motorAt:null,beltAt:null,springAt:null,returnCrossAt:null,bellAt:null,wonAt:null};
  for(let frame=1;frame<=seconds*120;frame++){
    const events=stepWorld(world),at=frame/120,body=id=>world.bodies.find(candidate=>candidate.id===id),parcel=body('return-parcel'),bell=body('dispatch-bell');
    if(times.transformAt===null&&events.some(event=>event.kind==='transform'))times.transformAt=at;
    if(times.switchAt===null&&body('dispatch-switch').state==='on')times.switchAt=at;
    if(times.motorAt===null&&body('dispatch-motor').active)times.motorAt=at;
    if(times.beltAt===null&&body('parcel-belt').active)times.beltAt=at;
    if(times.springAt===null&&events.some(event=>event.kind==='trampoline'))times.springAt=at;
    if(times.returnCrossAt===null&&times.springAt!==null&&parcel.x<600)times.returnCrossAt=at;
    if(times.bellAt===null&&bell.state==='rung'&&bell.triggeredBy?.includes('return-parcel'))times.bellAt=at;
    if(times.wonAt===null&&world.won)times.wonAt=at;
  }
  return {...times,initialOverlaps,world};
}

assert.deepEqual(level.goal,{kind:'state',target:'dispatch-bell',count:1,delay:0,x:1200,y:700,w:180,h:180,edge:'right',state:'rung',hitBy:['return-parcel']},'Only the return parcel may ring the dispatch bell');
assert.deepEqual(level.inventory.map(entry=>[entry.id,entry.part.angle,entry.part.resizable,entry.quantity]),[
  ['signal-fan',0,false,1],['stone-cloud',0,false,1],['return-spring',0,false,1],
],'Stone Signal Dispatch must offer three neutral, fixed-size decisions');
const empty=timeline(level,[]);
assert.deepEqual(Object.fromEntries(['transformAt','switchAt','motorAt','beltAt','wonAt'].map(field=>[field,empty[field]])),{transformAt:null,switchAt:null,motorAt:null,beltAt:null,wonAt:null},'Empty-bin Stone Signal Dispatch must remain inert and fail');
assert.deepEqual(empty.initialOverlaps,[],'The authored scene must start without solid overlaps');
assert.equal(families.length,2,'Stone Signal Dispatch must preserve two reference families');

const expected={
  'Long Airmail':{transformAt:1.6166666666666667,switchAt:5.725,motorAt:5.733333333333333,beltAt:5.733333333333333,springAt:10.716666666666667,returnCrossAt:10.991666666666667,bellAt:11.025,wonAt:11.025},
  'Ceiling Telegram':{transformAt:1.3,switchAt:2.466666666666667,motorAt:2.466666666666667,beltAt:2.466666666666667,springAt:7.466666666666667,returnCrossAt:7.741666666666666,bellAt:7.775,wonAt:7.775},
};
const nearby={
  'Long Airmail':[
    [0,'x',4],[0,'x',6],[0,'y',2],[0,'y',4],[0,'angle',-.005],[0,'angle',.005],
    [1,'x',-4],[1,'x',-2],[1,'y',-2],[1,'y',2],
    [2,'x',-4],[2,'x',4],[2,'y',-4],[2,'y',4],[2,'angle',-.01],[2,'angle',.01],
  ],
  'Ceiling Telegram':[
    [0,'x',-6],[0,'x',6],[0,'y',-2],[0,'y',6],[0,'angle',-.01],[0,'angle',.01],
    [1,'x',-6],[1,'x',6],[1,'y',-4],[1,'y',2],
    [2,'x',-4],[2,'x',4],[2,'y',-4],[2,'y',4],[2,'angle',-.01],[2,'angle',.01],
  ],
};
for(const family of families){
  const result=timeline(level,family.parts);
  for(const [field,value] of Object.entries(expected[family.name]))assert.equal(result[field],value,`${family.name} ${field} changed`);
  assert.ok(result.transformAt<result.switchAt&&result.switchAt<=result.motorAt&&result.motorAt<=result.beltAt&&result.beltAt<result.springAt&&result.springAt<result.returnCrossAt&&result.returnCrossAt<result.bellAt,`${family.name} must retain its ten-link signal chain`);
  assert.deepEqual(result.initialOverlaps,[],`${family.name} must start without solid overlaps`);
  const balloon=result.world.bodies.find(body=>body.id==='signal-balloon');
  assert.equal(balloon.material,'steel',`${family.name} must finish with a stone signal balloon`);
  assert.deepEqual(balloon.transformedZones,['placed-stone-cloud'],`${family.name} must transform exactly once`);
  assert.ok(result.world.bodies.find(body=>body.id==='dispatch-bell').triggeredBy.includes('return-parcel'),`${family.name} must finish with the intended parcel impact`);

  for(const part of family.parts)assert.equal(timeline(level,family.parts.filter(candidate=>candidate.id!==part.id)).wonAt,null,`${family.name} must require ${part.stock}`);
  for(const [name,mutate] of [
    ['angled fan',parts=>parts.find(part=>part.stock==='signal-fan').angle=0],
    ['angled spring',parts=>parts.find(part=>part.stock==='return-spring').angle=0],
    ['both directional choices',parts=>{parts.find(part=>part.stock==='signal-fan').angle=0;parts.find(part=>part.stock==='return-spring').angle=0;}],
    ['powered fan',parts=>parts.find(part=>part.stock==='signal-fan').power=0],
    ['powered spring',parts=>parts.find(part=>part.stock==='return-spring').power=0],
  ]){const parts=structuredClone(family.parts);mutate(parts);assert.equal(timeline(level,parts).wonAt,null,`${family.name} must require its ${name}`);}

  for(const [partIndex,field,delta] of nearby[family.name]){
    const parts=structuredClone(family.parts);parts[partIndex][field]+=delta;const result=timeline(level,parts);
    assert.notEqual(result.wonAt,null,`${family.name} nearby ${family.parts[partIndex].stock} ${field} ${delta} must win`);
    assert.deepEqual(result.initialOverlaps,[],`${family.name} nearby ${family.parts[partIndex].stock} ${field} ${delta} must not overlap`);
  }

  for(const [name,mutate] of [
    ['motor wire',(_source,parts)=>_source.connections=_source.connections.filter(connection=>connection.id!=='motor-wire')],
    ['drive belt',(_source,parts)=>_source.connections=_source.connections.filter(connection=>connection.id!=='drive-belt')],
    ['powered motor',source=>source.bodies.find(body=>body.id==='dispatch-motor').power=0],
    ['Turn to Stone',(_source,parts)=>parts.find(part=>part.stock==='stone-cloud').outputMaterial='helium'],
  ]){const source=structuredClone(level),parts=structuredClone(family.parts);mutate(source,parts);assert.equal(timeline(source,parts).wonAt,null,`${family.name} must require its ${name}`);}

  const workshop=new Workshop(build(level,family.parts));
  const solve=world=>{for(let frame=1;frame<=14*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};
  assert.equal(solve(workshop.world),expected[family.name].wonAt,`${family.name} workshop solve changed`);
  workshop.reset();
  const resetBalloon=workshop.world.bodies.find(body=>body.id==='signal-balloon');
  assert.equal(resetBalloon.material,'helium',`${family.name} reset must restore helium`);
  assert.deepEqual(resetBalloon.transformedZones,[],`${family.name} reset must clear transformation history`);
  assert.deepEqual(['dispatch-switch','dispatch-motor','parcel-belt'].map(id=>workshop.world.bodies.find(body=>body.id===id).active),[false,false,false],`${family.name} reset must clear the signal chain`);
  assert.equal(solve(workshop.world),expected[family.name].wonAt,`${family.name} reset solve changed`);
}

const primaryFan=families[0].parts.find(part=>part.stock==='signal-fan'),alternateFan=families[1].parts.find(part=>part.stock==='signal-fan');
const primaryZone=families[0].parts.find(part=>part.stock==='stone-cloud'),alternateZone=families[1].parts.find(part=>part.stock==='stone-cloud');
assert.ok(Math.hypot(primaryFan.x-alternateFan.x,primaryFan.y-alternateFan.y)>180,'The signal routes must keep distinct fan positions');
assert.ok(primaryFan.angle*alternateFan.angle<0,'The signal routes must use opposite fan faces');
assert.ok(Math.hypot(primaryZone.x-alternateZone.x,primaryZone.y-alternateZone.y)>=100,'The transformation corridors must remain distinct');
assert.ok(expected['Long Airmail'].switchAt-expected['Ceiling Telegram'].switchAt>3,'The routes must retain materially different signal travel times');
console.log('PASS Stone Signal Dispatch parcel-locked goal and two distinct signal routes');
