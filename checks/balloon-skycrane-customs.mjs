import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLevel,PARTS} from '../dist/model.js';
import {createWorld,overlaps,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url)));
const references=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const index=pack.levels.findIndex(level=>level.id==='balloon-skycrane-customs');
assert.notEqual(index,-1,'Balloon Skycrane Customs must remain in the catalog');
const level=pack.levels[index],reference=references[index],families=[reference,...reference.alternatives];
const build=(source,parts)=>parseLevel({...structuredClone(source),bodies:[...source.bodies,...structuredClone(parts)]});

function timeline(source,parts,seconds=16){
  const world=createWorld(build(source,parts)),initialOverlaps=[];
  for(let a=0;a<world.bodies.length;a++)for(let b=a+1;b<world.bodies.length;b++)if(!PARTS[world.bodies[a].kind].sensor&&!PARTS[world.bodies[b].kind].sensor&&overlaps(world.bodies[a],world.bodies[b]))initialOverlaps.push([world.bodies[a].id,world.bodies[b].id]);
  const times={transformAt:null,reversalAt:null,ropeLiftAt:null,chockAt:null,landingAt:null,wonAt:null};
  let previousBalloonVy=null,blockedBeforeWin=false,maxHeld=0,minLiftY=Infinity,maxBalloonY=-Infinity;
  for(let frame=1;frame<=seconds*120;frame++){
    const events=stepWorld(world),at=frame/120,lift=world.bodies.find(body=>body.id==='customs-lift'),balloon=world.bodies.find(body=>body.id==='crane-balloon'),chock=world.bodies.find(body=>body.id==='placed-landing-chock'),rope=world.connections.find(connection=>connection.id==='skycrane-rope');
    if(times.transformAt===null&&events.some(event=>event.kind==='transform'))times.transformAt=at;
    if(times.reversalAt===null&&times.transformAt!==null&&previousBalloonVy!==null&&previousBalloonVy<0&&balloon.vy>=0)times.reversalAt=at;
    if(times.ropeLiftAt===null&&lift.y<600)times.ropeLiftAt=at;
    if(times.chockAt===null&&chock&&overlaps(balloon,chock,0))times.chockAt=at;
    if(times.landingAt===null&&times.chockAt!==null&&world.goalHeld>0)times.landingAt=at;
    if(times.wonAt===null&&world.won)times.wonAt=at;
    if(!world.won&&rope?.blocked)blockedBeforeWin=true;
    maxHeld=Math.max(maxHeld,world.goalHeld);minLiftY=Math.min(minLiftY,lift.y);maxBalloonY=Math.max(maxBalloonY,balloon.y);previousBalloonVy=balloon.vy;
  }
  const lift=world.bodies.find(body=>body.id==='customs-lift'),balloon=world.bodies.find(body=>body.id==='crane-balloon');
  return {...times,blockedBeforeWin,maxHeld,minLiftY,maxBalloonY,initialOverlaps,finalLift:{x:lift.x,y:lift.y,vx:lift.vx,vy:lift.vy},finalBalloon:{x:balloon.x,y:balloon.y,material:balloon.material,transformedZones:balloon.transformedZones},world};
}

assert.deepEqual(level.goal,{kind:'region',target:'customs-lift',count:1,delay:3,x:480,y:480,w:70,h:20,edge:'right',state:'rung'},'Only the customs lift may satisfy the three-second landing goal');
assert.deepEqual(level.inventory.map(entry=>[entry.id,entry.part.angle,entry.part.fixed,entry.part.resizable,entry.quantity]),[
  ['crosswind-fan',0,true,false,1],['stone-cloud',0,true,false,1],['landing-chock',0,true,false,1],
],'Balloon Skycrane Customs must offer three fixed-size parts with a neutral fan');
assert.deepEqual(level.connections.find(connection=>connection.id==='skycrane-rope'),{id:'skycrane-rope',kind:'rope',a:'customs-lift',b:'crane-balloon',length:1762.1586816834258,via:['lift-pulley','balloon-pulley'],ax:0,ay:0,bx:0,by:0,wrap:[1,1]},'The inextensible skycrane rope must retain both pulley wraps');

const empty=timeline(level,[]);
assert.equal(empty.wonAt,null,'Empty-bin Balloon Skycrane Customs must fail');
assert.equal(empty.transformAt,null,'Empty-bin balloon must not transform');
assert.equal(empty.ropeLiftAt,null,'Empty-bin lift must not rise through the landing');
assert.deepEqual(empty.initialOverlaps,[],'The authored scene must start without solid overlaps');
assert.equal(families.length,2,'Balloon Skycrane Customs must preserve two reference families');

const expected={
  'Deep Overshoot':{transformAt:.5333333333333333,reversalAt:1.0666666666666667,ropeLiftAt:2.033333333333333,chockAt:7.716666666666667,landingAt:7.716666666666667,wonAt:9.408333333333333,minLiftY:218.77115196142282,maxBalloonY:910.8223907712705},
  'Shallow Loop':{transformAt:.5333333333333333,reversalAt:1.0583333333333333,ropeLiftAt:2.058333333333333,chockAt:2,landingAt:2.3916666666666666,wonAt:11.533333333333333,minLiftY:398.1543620884381,maxBalloonY:910.2186646649817},
};
const nearby={
  'Deep Overshoot':[
    [0,'x',-4],[0,'x',4],[0,'y',-4],[0,'y',6],[0,'angle',-.01],[0,'angle',.01],
    [1,'x',-4],[1,'x',4],[1,'y',-4],[1,'y',4],
    [2,'x',-4],[2,'x',4],[2,'y',-4],[2,'y',4],
  ],
  'Shallow Loop':[
    [0,'x',-4],[0,'x',4],[0,'y',-4],[0,'y',4],[0,'angle',-.01],[0,'angle',.01],
    [1,'x',-4],[1,'x',4],[1,'y',-4],[1,'y',4],
    [2,'x',-4],[2,'x',4],[2,'y',-4],[2,'y',4],
  ],
};
for(const family of families){
  const result=timeline(level,family.parts);
  for(const [field,value] of Object.entries(expected[family.name]))assert.equal(result[field],value,`${family.name} ${field} changed`);
  assert.ok(result.transformAt<result.reversalAt&&result.reversalAt<result.chockAt&&result.chockAt<result.wonAt,`${family.name} must retain its transform, reversal, chock, and hold sequence`);
  assert.ok(result.transformAt<result.ropeLiftAt&&result.ropeLiftAt<result.wonAt,`${family.name} must lift via the transformed rope counterweight`);
  assert.ok(result.maxHeld>=3,`${family.name} must complete the full landing hold`);
  assert.equal(result.blockedBeforeWin,false,`${family.name} rope must remain valid through the win`);
  assert.deepEqual(result.initialOverlaps,[],`${family.name} must start without solid overlaps`);
  assert.deepEqual([result.finalBalloon.material,result.finalBalloon.transformedZones],['steel',['placed-stone-cloud']],`${family.name} must transform the balloon exactly once`);
  assert.ok(Math.abs(result.finalLift.y-488)<1,`${family.name} must settle at the calibrated landing`);

  for(const part of family.parts)assert.equal(timeline(level,family.parts.filter(candidate=>candidate.id!==part.id)).wonAt,null,`${family.name} must require ${part.stock}`);
  for(const [name,mutate] of [
    ['aimed fan',parts=>parts.find(part=>part.stock==='crosswind-fan').angle=0],
    ['powered fan',parts=>parts.find(part=>part.stock==='crosswind-fan').power=0],
  ]){const parts=structuredClone(family.parts);mutate(parts);assert.equal(timeline(level,parts).wonAt,null,`${family.name} must require its ${name}`);}

  for(const [partIndex,field,delta] of nearby[family.name]){
    const parts=structuredClone(family.parts);parts[partIndex][field]+=delta;const variant=timeline(level,parts);
    assert.notEqual(variant.wonAt,null,`${family.name} nearby ${family.parts[partIndex].stock} ${field} ${delta} must win`);
    assert.deepEqual(variant.initialOverlaps,[],`${family.name} nearby ${family.parts[partIndex].stock} ${field} ${delta} must not overlap`);
    assert.equal(variant.blockedBeforeWin,false,`${family.name} nearby ${family.parts[partIndex].stock} ${field} ${delta} must keep the rope valid`);
  }

  for(const [name,mutate] of [
    ['skycrane rope',source=>source.connections=[]],
    ['Turn to Stone',(_source,parts)=>parts.find(part=>part.stock==='stone-cloud').outputMaterial='helium'],
    ['moving lift',source=>source.bodies.find(body=>body.id==='customs-lift').fixed=true],
  ]){const source=structuredClone(level),parts=structuredClone(family.parts);mutate(source,parts);assert.equal(timeline(source,parts).wonAt,null,`${family.name} must require its ${name}`);}

  const workshop=new Workshop(build(level,family.parts));
  const solve=world=>{for(let frame=1;frame<=16*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};
  assert.equal(solve(workshop.world),expected[family.name].wonAt,`${family.name} workshop solve changed`);
  workshop.reset();
  const resetBalloon=workshop.world.bodies.find(body=>body.id==='crane-balloon');
  assert.deepEqual([resetBalloon.material,resetBalloon.transformedZones,workshop.world.goalHeld,workshop.world.connections[0].blocked],['helium',[],0,false],`${family.name} reset must restore the authored attempt`);
  assert.equal(solve(workshop.world),expected[family.name].wonAt,`${family.name} reset solve changed`);
}

const primaryFan=families[0].parts.find(part=>part.stock==='crosswind-fan'),alternateFan=families[1].parts.find(part=>part.stock==='crosswind-fan');
assert.ok(Math.abs(primaryFan.y-alternateFan.y)>=100,'The two flight paths must retain distinct fan heights');
assert.ok(primaryFan.angle*alternateFan.angle<0,'The two flight paths must use opposite fan faces');
assert.ok(expected['Deep Overshoot'].minLiftY+150<expected['Shallow Loop'].minLiftY,'Deep Overshoot must climb substantially above Shallow Loop');
console.log('PASS Balloon Skycrane Customs lift-locked hold and two distinct elevator envelopes');
