import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLevel} from '../dist/model.js';
import {createWorld,overlaps,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url)));
const references=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const index=pack.levels.findIndex(level=>level.id==='counterweight-crossfire');
assert.notEqual(index,-1,'Counterweight Crossfire must remain in the catalog');
const level=pack.levels[index],reference=references[index],families=[reference,...reference.alternatives];
const build=(source,parts)=>parseLevel({...structuredClone(source),bodies:[...source.bodies,...structuredClone(parts)]});

function timeline(source,parts,seconds=12){
  const world=createWorld(build(source,parts)),initialOverlaps=[];
  for(let a=0;a<world.bodies.length;a++)for(let b=a+1;b<world.bodies.length;b++)if(overlaps(world.bodies[a],world.bodies[b]))initialOverlaps.push([world.bodies[a].id,world.bodies[b].id]);
  const times={starterDeflectAt:null,switchAt:null,courierFiredAt:null,gateFiredAt:null,gateClearAt:null,gateStopAt:null,springAt:null,corridorAt:null,bellAt:null,wonAt:null};
  let ropeBlockedBeforeWin=false;
  for(let frame=1;frame<=seconds*120;frame++){
    const events=stepWorld(world),at=frame/120,body=id=>world.bodies.find(candidate=>candidate.id===id);
    if(times.starterDeflectAt===null&&Math.abs(body('starter-rocket').y-300)>1)times.starterDeflectAt=at;
    if(times.switchAt===null&&body('launch-switch').state==='on')times.switchAt=at;
    if(times.courierFiredAt===null&&body('courier-rocket').state==='fired')times.courierFiredAt=at;
    if(times.gateFiredAt===null&&body('gate-rocket').state==='fired')times.gateFiredAt=at;
    if(times.gateClearAt===null&&body('pulley-gate').y<500)times.gateClearAt=at;
    if(times.gateStopAt===null&&body('gate-rocket').y>800&&Math.abs(body('gate-rocket').vy)<20)times.gateStopAt=at;
    if(times.springAt===null&&events.some(event=>event.kind==='trampoline'))times.springAt=at;
    if(times.corridorAt===null&&body('courier-rocket').x>800&&body('courier-rocket').y<650)times.corridorAt=at;
    if(times.bellAt===null&&body('finish-bell').state==='rung')times.bellAt=at;
    if(!world.won&&world.connections.find(connection=>connection.id==='gate-rope')?.blocked)ropeBlockedBeforeWin=true;
    if(times.wonAt===null&&world.won)times.wonAt=at;
  }
  return {...times,ropeBlockedBeforeWin,initialOverlaps,world};
}

assert.deepEqual(level.goal,{kind:'state',target:'finish-bell',hitBy:['courier-rocket'],count:1,delay:0,x:1160,y:100,w:180,h:180,edge:'right',state:'rung'},'Only the courier rocket may satisfy the bell goal');
assert.deepEqual(level.inventory.map(entry=>[entry.id,entry.part.angle,entry.part.resizable,entry.quantity]),[
  ['trigger-ramp',0,false,1],['rocket-spring',0,false,1],['gate-stop',0,false,1],
],'Counterweight Crossfire must offer three neutral, fixed-size decisions');
assert.deepEqual(level.connections.find(connection=>connection.id==='gate-rope').wrap,[1,1],'The gate rope must retain both authored pulley wraps');

const empty=timeline(level,[]);
assert.equal(empty.wonAt,null,'Empty-bin Counterweight Crossfire must fail');
assert.equal(empty.switchAt,null,'The starter rocket must miss the switch without a placed ramp');
assert.deepEqual(empty.initialOverlaps,[],'The authored scene must start without overlaps');
assert.equal(families.length,2,'Counterweight Crossfire must preserve two reference families');

const expected={
  'High Arc':{starterDeflectAt:.4583333333333333,switchAt:.5416666666666666,courierFiredAt:.55,gateFiredAt:.55,gateClearAt:1.0166666666666666,gateStopAt:1.25,springAt:1.4333333333333333,corridorAt:1.55,bellAt:2.2,wonAt:2.2},
  'Delayed Flip':{starterDeflectAt:.5833333333333334,switchAt:1.3666666666666667,courierFiredAt:1.375,gateFiredAt:1.375,gateClearAt:1.85,gateStopAt:2.075,springAt:2.2583333333333333,corridorAt:2.375,bellAt:3.025,wonAt:3.025},
};
for(const family of families){
  const result=timeline(level,family.parts);
  for(const [field,value] of Object.entries(expected[family.name]))assert.equal(result[field],value,`${family.name} ${field} changed`);
  assert.equal(result.ropeBlockedBeforeWin,false,`${family.name} rope must stay valid through the win`);
  assert.deepEqual(result.initialOverlaps,[],`${family.name} must start without overlaps`);
  assert.ok(result.switchAt<result.gateClearAt&&result.gateClearAt<result.gateStopAt&&result.gateStopAt<result.springAt&&result.springAt<result.bellAt,`${family.name} must retain its synchronized 11-link chain`);
  assert.ok(result.world.bodies.find(body=>body.id==='finish-bell').triggeredBy.includes('courier-rocket'),`${family.name} must finish with a courier impact`);

  for(const part of family.parts)assert.equal(timeline(level,family.parts.filter(candidate=>candidate.id!==part.id)).wonAt,null,`${family.name} must require ${part.stock}`);
  for(const [name,mutate] of [
    ['angled ramp',parts=>parts.find(part=>part.stock==='trigger-ramp').angle=0],
    ['angled spring',parts=>parts.find(part=>part.stock==='rocket-spring').angle=0],
    ['both directional choices',parts=>{parts.find(part=>part.stock==='trigger-ramp').angle=0;parts.find(part=>part.stock==='rocket-spring').angle=0;}],
    ['powered spring',parts=>parts.find(part=>part.stock==='rocket-spring').power=0],
  ]){const parts=structuredClone(family.parts);mutate(parts);assert.equal(timeline(level,parts).wonAt,null,`${family.name} must require its ${name}`);}

  const nearbyWins=[];
  for(let partIndex=0;partIndex<family.parts.length;partIndex++)for(const [field,delta] of [['x',-6],['x',6],['y',-6],['y',6],...(['trigger-ramp','rocket-spring'].includes(family.parts[partIndex].stock)?[['angle',-.02],['angle',.02]]:[])]){
    const parts=structuredClone(family.parts);parts[partIndex][field]+=delta;const nearby=timeline(level,parts,4);
    if(nearby.wonAt!==null)nearbyWins.push(`${family.parts[partIndex].stock}:${field}:${delta}`);
    assert.deepEqual(nearby.initialOverlaps,[],`${family.name} nearby ${family.parts[partIndex].stock} ${field} ${delta} must not overlap`);
  }
  assert.ok(nearbyWins.length>=14,`${family.name} must retain at least 14 of 16 nearby courier-impact wins`);
  assert.equal(new Set(nearbyWins.map(probe=>probe.split(':')[0])).size,3,`${family.name} must tolerate nearby movement of every inventory part`);

  for(const [name,mutate] of [
    ['gate rope',source=>source.connections=source.connections.filter(connection=>connection.id!=='gate-rope')],
    ['gate wire',source=>source.connections=source.connections.filter(connection=>connection.id!=='gate-wire')],
    ['courier wire',source=>source.connections=source.connections.filter(connection=>connection.id!=='launch-wire')],
    ['gate-rocket thrust',source=>source.bodies.find(body=>body.id==='gate-rocket').power=0],
  ]){const source=structuredClone(level);mutate(source);assert.equal(timeline(source,family.parts).wonAt,null,`${family.name} must require its ${name}`);}

  const workshop=new Workshop(build(level,family.parts));
  const solve=world=>{for(let frame=1;frame<=4*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};
  assert.equal(solve(workshop.world),expected[family.name].wonAt,`${family.name} workshop solve changed`);
  workshop.reset();
  assert.deepEqual(['launch-switch','courier-rocket','gate-rocket'].map(id=>workshop.world.bodies.find(body=>body.id===id).state),['off','off','off'],`${family.name} reset must clear both wire branches`);
  assert.equal(solve(workshop.world),expected[family.name].wonAt,`${family.name} reset solve changed`);
}

const primaryRamp=families[0].parts.find(part=>part.stock==='trigger-ramp'),alternateRamp=families[1].parts.find(part=>part.stock==='trigger-ramp');
assert.ok(Math.hypot(primaryRamp.x-alternateRamp.x,primaryRamp.y-alternateRamp.y)>=150,'The two trigger routes must remain spatially distinct');
assert.ok(primaryRamp.angle*alternateRamp.angle<0,'The two trigger routes must use opposite ramp faces');
assert.ok(expected['Delayed Flip'].switchAt-expected['High Arc'].switchAt>=.8,'Delayed Flip must materially retime both synchronized branches');
console.log('PASS Counterweight Crossfire courier-locked goal and two retimed opposite-face routes');
