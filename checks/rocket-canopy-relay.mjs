import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseLevel} from '../dist/model.js';
import {createWorld,localPoint,overlaps,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url)));
const references=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
const index=pack.levels.findIndex(level=>level.id==='rocket-canopy-relay');
assert.notEqual(index,-1,'Rocket Canopy Relay must remain in the playable catalog');
const level=parseLevel(pack.levels[index]),reference=references[index],families=[{name:reference.name,parts:reference.parts},...reference.alternatives];
const build=(source,parts)=>parseLevel({...source,bodies:[...source.bodies,...parts]});
const overlapPairs=world=>{const pairs=[];for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++)if(overlaps(world.bodies[i],world.bodies[j]))pairs.push([world.bodies[i].id,world.bodies[j].id]);return pairs;};
const near=(part,body)=>{const relative=localPoint(part,body.x,body.y);return Math.abs(relative.x)<part.w/2+body.w/2&&Math.abs(relative.y)<part.h/2+body.h/2+3;};
const timeline=source=>{
  const world=createWorld(source),ball=world.bodies.find(body=>body.id==='starter-ball'),rocket=world.bodies.find(body=>body.id==='courier-rocket'),fan=world.bodies.find(body=>body.stock==='crosswind-fan'),ramp=world.bodies.find(body=>body.stock==='trigger-ramp');
  let switchAt=null,trampolineAt=null,ballRampAt=null,rocketRampAt=null,fanAt=null,popAt=null,wonAt=null,ballNear=false,rocketNear=false,inFan=false,maxRocketX=-Infinity,minRocketY=Infinity;
  for(let frame=1;frame<=9*120;frame++){
    const events=stepWorld(world),time=frame/120;maxRocketX=Math.max(maxRocketX,rocket.x);minRocketY=Math.min(minRocketY,rocket.y);
    if(events.some(event=>event.kind==='switch')&&switchAt===null)switchAt=time;
    if(events.some(event=>event.kind==='trampoline')&&trampolineAt===null)trampolineAt=time;
    if(ramp){const nextBallNear=near(ramp,ball),nextRocketNear=near(ramp,rocket);if(nextBallNear&&!ballNear&&ballRampAt===null)ballRampAt=time;if(nextRocketNear&&!rocketNear&&rocketRampAt===null)rocketRampAt=time;ballNear=nextBallNear;rocketNear=nextRocketNear;}
    if(fan){const relative=localPoint(fan,rocket.x,rocket.y),inside=relative.x>0&&relative.x<360&&Math.abs(relative.y)<fan.h/2+relative.x*.3;if(inside&&!inFan&&fanAt===null)fanAt=time;inFan=inside;}
    if(events.some(event=>event.kind==='pop')&&popAt===null)popAt=time;
    if(world.won){wonAt=time;break;}
  }
  return{wonAt,switchAt,trampolineAt,ballRampAt,rocketRampAt,fanAt,popAt,maxRocketX,minRocketY,triggeredBy:world.bodies.find(body=>body.id==='delivery-balloon').triggeredBy??[]};
};
const winTime=source=>timeline(source).wonAt;
const solve=world=>{for(let frame=1;frame<=9*120;frame++){stepWorld(world);if(world.won)return frame/120;}return null;};

assert.deepEqual(level.inventory.map(entry=>[entry.id,entry.quantity,entry.part.angle,entry.part.resizable]),[
  ['trigger-ramp',1,0,false],['crosswind-fan',1,0,false],['corner-spring',1,0,false],
],'Rocket Canopy Relay must present three neutral, fixed-size decisions');
assert.deepEqual(level.goal,{kind:'state',target:'delivery-balloon',count:1,delay:0,x:1200,y:700,w:180,h:180,edge:'right',state:'popped',hitBy:['courier-rocket']},'Only the courier rocket may complete the balloon delivery');
assert.equal(winTime(level),null,'Rocket Canopy Relay empty bin must fail');
assert.equal(families.length,2,'Rocket Canopy Relay must retain two solution families');

const expected={
  'Early Side-Swipe':{wonAt:4.075,switchAt:1.9166666666666667,trampolineAt:3.175,ballRampAt:.9666666666666667,rocketRampAt:null,fanAt:2.5083333333333333,popAt:4.075,maxRocketX:1289.6712522674702,minRocketY:376.24984977186523,triggeredBy:['courier-rocket']},
  'Job Swap':{wonAt:5.15,switchAt:3.6333333333333333,trampolineAt:1.0416666666666667,ballRampAt:null,rocketRampAt:4.975,fanAt:4.183333333333334,popAt:5.15,maxRocketX:1359.6475001546603,minRocketY:450.92557337191465,triggeredBy:['courier-rocket']},
};
const variants={
  'Early Side-Swipe':[['trigger-ramp','x',-8],['trigger-ramp','y',-8],['trigger-ramp','angle',-.02],['crosswind-fan','x',-4],['crosswind-fan','y',12],['crosswind-fan','angle',.01],['corner-spring','x',-8],['corner-spring','angle',-.01],['corner-spring','angle',.02]],
  'Job Swap':[['trigger-ramp','x',12],['trigger-ramp','y',-12],['trigger-ramp','angle',-.02],['crosswind-fan','x',-12],['crosswind-fan','y',12],['crosswind-fan','angle',-.02],['corner-spring','x',12],['corner-spring','y',-12],['corner-spring','angle',.005]],
};
for(const family of families){
  const solved=build(level,family.parts);assert.deepEqual(overlapPairs(createWorld(solved)),[],`${family.name} must start without overlaps`);assert.deepEqual(timeline(solved),expected[family.name],`${family.name} interaction route changed`);
  assert.ok(expected[family.name].maxRocketX>1150&&expected[family.name].maxRocketX<1600&&expected[family.name].minRocketY>0,`${family.name} must clear the canopy without leaving the visible world`);
  for(const stock of ['trigger-ramp','crosswind-fan','corner-spring'])assert.equal(winTime(build(level,family.parts.filter(part=>part.stock!==stock))),null,`${family.name} must require ${stock}`);
  for(const [name,stock,field,value] of [['ramp direction','trigger-ramp','angle',0],['fan direction','crosswind-fan','angle',0],['spring direction','corner-spring','angle',0],['fan power','crosswind-fan','power',0],['spring power','corner-spring','power',0]]){const parts=structuredClone(family.parts);parts.find(part=>part.stock===stock)[field]=value;assert.equal(winTime(build(level,parts)),null,`${family.name} must require ${name}`);}
  for(const [stock,field,delta] of variants[family.name]){const parts=structuredClone(family.parts);parts.find(part=>part.stock===stock)[field]+=delta;const nearby=build(level,parts),message=`${family.name} nearby ${stock} ${field} ${delta}`;assert.deepEqual(overlapPairs(createWorld(nearby)),[],`${message} must not overlap`);assert.notEqual(winTime(nearby),null,`${message} must win`);}
  for(const [name,mutate] of [['wire',source=>source.connections=[]],['rocket power',source=>source.bodies.find(body=>body.id==='courier-rocket').power=0],['moving rocket',source=>source.bodies.find(body=>body.id==='courier-rocket').fixed=true]]){const source=structuredClone(level);mutate(source);assert.equal(winTime(build(source,family.parts)),null,`${family.name} must require ${name}`);}
  const wrongSource=structuredClone(level);wrongSource.goal.hitBy=['starter-ball'];assert.equal(winTime(build(wrongSource,family.parts)),null,`${family.name} must not credit the starter ball for the pop`);
  const workshop=new Workshop(solved),first=solve(workshop.world);workshop.reset();assert.equal(workshop.world.bodies.find(body=>body.id==='delivery-balloon').state,'on');assert.deepEqual(workshop.world.bodies.find(body=>body.id==='delivery-balloon').triggeredBy??[],[]);assert.equal(solve(workshop.world),first,`${family.name} reset must preserve solve time`);
}
assert.ok(expected['Early Side-Swipe'].ballRampAt<expected['Early Side-Swipe'].switchAt&&expected['Early Side-Swipe'].switchAt<expected['Early Side-Swipe'].fanAt&&expected['Early Side-Swipe'].fanAt<expected['Early Side-Swipe'].trampolineAt&&expected['Early Side-Swipe'].trampolineAt<expected['Early Side-Swipe'].popAt,'Early Side-Swipe must use ramp for the starter and spring for the rocket');
assert.ok(expected['Job Swap'].trampolineAt<expected['Job Swap'].switchAt&&expected['Job Swap'].switchAt<expected['Job Swap'].fanAt&&expected['Job Swap'].fanAt<expected['Job Swap'].rocketRampAt&&expected['Job Swap'].rocketRampAt<expected['Job Swap'].popAt,'Job Swap must use spring for the starter and ramp for the rocket');
console.log('PASS Rocket Canopy Relay rocket-locked goal and two role-swapped solution families');
