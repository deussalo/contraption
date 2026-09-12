import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLevel,PARTS} from '../dist/model.js';
import {createWorld,overlaps,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url)));
const references=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const index=pack.levels.findIndex(level=>level.id==='cloudstone-customs');
assert.notEqual(index,-1,'Cloudstone Customs must remain in the playable catalog');
const level=parseLevel(pack.levels[index]),reference=references[index],families=[{name:reference.name,parts:reference.parts},...reference.alternatives];
const build=(source,parts)=>parseLevel({...source,bodies:[...source.bodies,...parts]});
const solidOverlapPairs=world=>{const pairs=[];for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++)if(!PARTS[world.bodies[i].kind].sensor&&!PARTS[world.bodies[j].kind].sensor&&overlaps(world.bodies[i],world.bodies[j]))pairs.push([world.bodies[i].id,world.bodies[j].id]);return pairs;};
const timeline=source=>{
  const world=createWorld(source),parcel=world.bodies.find(body=>body.id==='customs-parcel');let heliumAt=null,stoneAt=null,crossAt=null,wonAt=null,minY=Infinity,maxX=-Infinity,heldAtWin=0;
  for(let frame=1;frame<=14*120;frame++){
    const events=stepWorld(world),time=frame/120;minY=Math.min(minY,parcel.y);maxX=Math.max(maxX,parcel.x);
    for(const event of events.filter(event=>event.kind==='transform')){if(event.material==='helium'&&heliumAt===null)heliumAt=time;if(event.material==='steel'&&stoneAt===null)stoneAt=time;}
    if(parcel.x>850&&parcel.y<350&&crossAt===null)crossAt=time;if(world.won&&wonAt===null){wonAt=time;heldAtWin=world.goalHeld;}
  }
  return{wonAt,heliumAt,stoneAt,crossAt,minY,maxX,heldAtWin,material:parcel.material,transformedZones:parcel.transformedZones};
};
const winTime=source=>timeline(source).wonAt;
const solve=world=>{for(let frame=1;frame<=14*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};

assert.deepEqual(level.inventory.map(entry=>[entry.id,entry.quantity,entry.part.angle,entry.part.resizable,entry.part.outputMaterial??null]),[
  ['helium-zone',1,0,false,'helium'],['crossing-ramp',1,0,false,null],['stone-zone',1,0,false,'steel'],
],'Cloudstone Customs must present three neutral, fixed-size material-routing decisions');
assert.deepEqual([level.goal.kind,level.goal.target,level.goal.delay,level.goal.w],['region','customs-parcel',1.5,20],'Only the customs parcel may satisfy the narrow held slot');
assert.equal(winTime(level),null,'Cloudstone Customs empty bin must fail');assert.equal(families.length,2,'Cloudstone Customs must retain two solution families');

const expected={
  'Mid-Altitude Bank':{wonAt:11.35,heliumAt:3.8916666666666666,stoneAt:6.6,crossAt:7.291666666666667,minY:224.50182430583732,maxX:933.1676819891658},
  'Ceiling Skim':{wonAt:11.025,heliumAt:3.8916666666666666,stoneAt:6.083333333333333,crossAt:7.275,minY:26.333047527440247,maxX:935.1553653325402},
};
const variants={
  'Mid-Altitude Bank':[['helium-zone','x',-4],['helium-zone','x',4],['helium-zone','y',-12],['helium-zone','y',12],['crossing-ramp','x',-8],['crossing-ramp','x',4],['crossing-ramp','y',-8],['crossing-ramp','angle',-.02],['crossing-ramp','angle',.02],['stone-zone','x',-12],['stone-zone','x',12],['stone-zone','y',-12],['stone-zone','y',12]],
  'Ceiling Skim':[['helium-zone','x',-4],['helium-zone','x',4],['helium-zone','y',-12],['helium-zone','y',12],['crossing-ramp','x',-8],['crossing-ramp','x',4],['crossing-ramp','y',-8],['crossing-ramp','y',8],['crossing-ramp','angle',.02],['stone-zone','x',-12],['stone-zone','x',12],['stone-zone','y',-12],['stone-zone','y',12]],
};
for(const family of families){
  const solved=build(level,family.parts),result=timeline(solved);assert.deepEqual(solidOverlapPairs(createWorld(solved)),[],`${family.name} must start without solid overlaps`);
  for(const field of ['wonAt','heliumAt','stoneAt','crossAt','minY','maxX'])assert.equal(result[field],expected[family.name][field],`${family.name} ${field} changed`);assert.ok(result.heliumAt<result.stoneAt&&result.stoneAt<result.crossAt,`${family.name} must transform helium then steel before crossing`);assert.equal(result.material,'steel');assert.deepEqual(result.transformedZones,['placed-helium-zone','placed-stone-zone']);assert.ok(result.heldAtWin>=1.5,'The parcel must hold the customs slot for 1.5 seconds');
  for(const stock of ['helium-zone','crossing-ramp','stone-zone'])assert.equal(winTime(build(level,family.parts.filter(part=>part.stock!==stock))),null,`${family.name} must require ${stock}`);
  for(const [name,stock,field,value] of [['ramp direction','crossing-ramp','angle',0],['helium output','helium-zone','outputMaterial','cork'],['stone output','stone-zone','outputMaterial','cork']]){const parts=structuredClone(family.parts);parts.find(part=>part.stock===stock)[field]=value;assert.equal(winTime(build(level,parts)),null,`${family.name} must require ${name}`);}
  for(const [stock,field,delta] of variants[family.name]){const parts=structuredClone(family.parts);parts.find(part=>part.stock===stock)[field]+=delta;const nearby=build(level,parts),message=`${family.name} nearby ${stock} ${field} ${delta}`;assert.deepEqual(solidOverlapPairs(createWorld(nearby)),[],`${message} must not overlap`);assert.notEqual(winTime(nearby),null,`${message} must win`);}
  for(const [name,mutate] of [['powered belt',source=>source.bodies.find(body=>body.id==='feed-belt').on=false],['belt direction',source=>source.bodies.find(body=>body.id==='feed-belt').direction=1],['atmosphere',source=>source.environment.pressure=0],['strong buoyancy',source=>source.environment.pressure=.2],['customs wall',source=>source.bodies=source.bodies.filter(body=>body.id!=='customs-wall')]]){const source=structuredClone(level);mutate(source);assert.equal(winTime(build(source,family.parts)),null,`${family.name} must require ${name}`);}
  const workshop=new Workshop(solved),first=solve(workshop.world);workshop.reset();const resetParcel=workshop.world.bodies.find(body=>body.id==='customs-parcel');assert.equal(resetParcel.material,'steel');assert.deepEqual(resetParcel.transformedZones,[]);assert.equal(workshop.world.goalHeld,0);assert.equal(solve(workshop.world),first,`${family.name} reset must preserve solve time`);
}
assert.ok(expected['Mid-Altitude Bank'].minY>200,'Mid-Altitude Bank must remain below the ceiling lane');assert.ok(expected['Ceiling Skim'].minY<50,'Ceiling Skim must use the ceiling lane');
assert.ok(Math.hypot(families[0].parts[1].x-families[1].parts[1].x,families[0].parts[1].y-families[1].parts[1].y)>175,'Ramp routes must remain spatially distinct');assert.ok(Math.hypot(families[0].parts[2].x-families[1].parts[2].x,families[0].parts[2].y-families[1].parts[2].y)>140,'Stone zones must remain spatially distinct');
console.log('PASS Cloudstone Customs parcel-locked slot and two distinct altitude routes');
