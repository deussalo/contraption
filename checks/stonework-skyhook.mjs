import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLevel,PARTS} from '../dist/model.js';
import {createWorld,overlaps,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url)));
const references=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const index=pack.levels.findIndex(level=>level.id==='stonework-skyhook');
assert.notEqual(index,-1,'Stonework Skyhook must remain in the playable catalog');
const level=parseLevel(pack.levels[index]),reference=references[index];
const families=[{name:reference.name,parts:reference.parts},...reference.alternatives];

const build=(source,parts)=>parseLevel({...source,bodies:[...source.bodies,...parts]});
const initialSolidOverlaps=world=>{
  const pairs=[];
  for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++)if(!PARTS[world.bodies[i].kind].sensor&&!PARTS[world.bodies[j].kind].sensor&&overlaps(world.bodies[i],world.bodies[j]))pairs.push([world.bodies[i].id,world.bodies[j].id]);
  return pairs;
};
const timeline=source=>{
  const world=createWorld(source),transforms=[];
  let transformAt=null,switchAt=null,firedAt=null,springAt=null,ballastStopAt=null,bellAt=null,wonAt=null;
  for(let frame=1;frame<=12*120;frame++){
    const events=stepWorld(world),time=frame/120;
    const balloon=world.bodies.find(body=>body.id==='ballast-balloon');
    const trigger=world.bodies.find(body=>body.id==='launch-switch');
    const rocket=world.bodies.find(body=>body.id==='sky-courier');
    const bell=world.bodies.find(body=>body.id==='sky-bell');
    const transformed=events.filter(event=>event.kind==='transform');
    transforms.push(...transformed.map(event=>event.material));
    if(transformed.length&&transformAt===null)transformAt=time;
    if(trigger.state==='on'&&switchAt===null)switchAt=time;
    if(rocket.state==='fired'&&firedAt===null)firedAt=time;
    if(events.some(event=>event.kind==='trampoline')&&springAt===null)springAt=time;
    if(balloon.y>830&&Math.abs(balloon.vy)<25&&ballastStopAt===null)ballastStopAt=time;
    if(bell.state==='rung'&&bellAt===null)bellAt=time;
    if(world.won&&wonAt===null)wonAt=time;
  }
  return{transformAt,switchAt,firedAt,springAt,ballastStopAt,bellAt,wonAt,transforms};
};
const winTime=source=>timeline(source).wonAt;
const solveWorld=world=>{for(let frame=1;frame<=12*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};

assert.deepEqual(level.inventory.map(entry=>[entry.id,entry.quantity,entry.part.angle,entry.part.resizable]),[
  ['stone-cloud',1,0,false],
  ['ballast-stop',1,0,false],
  ['courier-spring',1,0,false],
],'Stonework Skyhook must present three neutral, fixed-size decisions');
assert.equal(winTime(level),null,'Stonework Skyhook empty bin must fail');
assert.equal(families.length,2,'Stonework Skyhook must retain two solution families');

const expected={
  'Afterburner Bank':{transformAt:.7,switchAt:2.6333333333333333,firedAt:2.6416666666666666,springAt:3.575,ballastStopAt:2.9,bellAt:5.041666666666667,wonAt:5.041666666666667,transforms:['steel']},
  'Prelaunch Kick':{transformAt:.65,switchAt:2.75,firedAt:2.7583333333333333,springAt:2.0416666666666665,ballastStopAt:3.125,bellAt:5.725,wonAt:5.725,transforms:['steel']},
};
for(const family of families){
  const solved=build(level,family.parts);
  assert.deepEqual(initialSolidOverlaps(createWorld(solved)),[],`${family.name} must start without solid overlaps`);
  assert.deepEqual(timeline(solved),expected[family.name],`${family.name} interaction order changed`);
  for(const stock of ['stone-cloud','ballast-stop','courier-spring']){
    const without=family.parts.filter(part=>part.stock!==stock);
    assert.equal(winTime(build(level,without)),null,`${family.name} must require ${stock}`);
  }
  for(const [name,mutate] of [
    ['rope',source=>{source.connections=source.connections.filter(connection=>connection.id!=='skyhook-rope');}],
    ['wire',source=>{source.connections=source.connections.filter(connection=>connection.id!=='launch-wire');}],
    ['steel transformation',(_source,parts)=>{parts.find(part=>part.stock==='stone-cloud').outputMaterial='cork';}],
    ['aimed spring',(_source,parts)=>{parts.find(part=>part.stock==='courier-spring').angle=0;}],
    ['spring impulse',(_source,parts)=>{parts.find(part=>part.stock==='courier-spring').power=0;}],
  ]){
    const source=structuredClone(level),parts=structuredClone(family.parts);mutate(source,parts);
    assert.equal(winTime(build(source,parts)),null,`${family.name} must require its ${name}`);
  }
  const variants=family.name==='Prelaunch Kick'
    ? [['stone-cloud','x',-6],['stone-cloud','x',6],['stone-cloud','y',-6],['stone-cloud','y',6],['ballast-stop','x',-6],['ballast-stop','x',6],['ballast-stop','y',-6],['ballast-stop','y',6],['courier-spring','x',4],['courier-spring','y',-4],['courier-spring','y',4],['courier-spring','angle',-.01]]
    : [['stone-cloud','x',-6],['stone-cloud','x',6],['stone-cloud','y',-6],['stone-cloud','y',6],['ballast-stop','x',-6],['ballast-stop','x',6],['ballast-stop','y',-6],['ballast-stop','y',6],['courier-spring','x',-6],['courier-spring','x',6],['courier-spring','y',-6],['courier-spring','y',6],['courier-spring','angle',-.02],['courier-spring','angle',.02]];
  for(const [stock,field,delta] of variants){
    const parts=structuredClone(family.parts);parts.find(part=>part.stock===stock)[field]+=delta;const nearby=build(level,parts),message=`${family.name} nearby ${stock} ${field} ${delta}`;
    assert.deepEqual(initialSolidOverlaps(createWorld(nearby)),[],`${message} must not overlap`);
    assert.notEqual(winTime(nearby),null,`${message} must win`);
  }
  const workshop=new Workshop(solved),first=solveWorld(workshop.world);workshop.reset();
  assert.equal(workshop.world.bodies.find(body=>body.id==='ballast-balloon').material,'helium');
  assert.deepEqual(workshop.world.bodies.find(body=>body.id==='ballast-balloon').transformedZones,[]);
  assert.equal(workshop.world.bodies.find(body=>body.id==='sky-courier').state,'off');
  assert.equal(solveWorld(workshop.world),first,`${family.name} reset must preserve solve time`);
}

const afterburner=families.find(family=>family.name==='Afterburner Bank'),prelaunch=families.find(family=>family.name==='Prelaunch Kick');
const highSpring=afterburner.parts.find(part=>part.stock==='courier-spring'),lowSpring=prelaunch.parts.find(part=>part.stock==='courier-spring');
assert.ok(highSpring.angle*lowSpring.angle<0&&highSpring.y+100<lowSpring.y,'Solution families must use opposite spring faces at distinct heights');
assert.ok(expected['Afterburner Bank'].firedAt<expected['Afterburner Bank'].springAt,'Afterburner Bank must redirect an ignited rocket');
assert.ok(expected['Prelaunch Kick'].springAt<expected['Prelaunch Kick'].firedAt,'Prelaunch Kick must redirect the assembly before ignition');

console.log('PASS Stonework Skyhook nonlinear chain and two solution families');
