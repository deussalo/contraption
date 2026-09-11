import './rope.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {blankLevel,makePart,parseLevel} from '../dist/model.js';
import {createWorld,stepWorld,connectionPoints,pathLength} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';
const simulate=(world,seconds)=>{for(let i=0;i<seconds*120;i++)stepWorld(world);return world;};
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
  const workshop=new Workshop(scene([part('circle',400,200,{id:'ball'})]));workshop.selected='ball';workshop.update({x:500});assert.equal(workshop.world.bodies[0].x,500);workshop.undo();assert.equal(workshop.world.bodies[0].x,400);workshop.undo(true);assert.equal(workshop.world.bodies[0].x,500);workshop.reset();assert.equal(workshop.world.bodies[0].x,500);
}
const pack=JSON.parse(await readFile(new URL('../dist/levels.json',import.meta.url))),solutions=JSON.parse(await readFile(new URL('./solutions.json',import.meta.url)));
for(const [i,level] of pack.levels.entries()){
  assert.equal(simulate(createWorld(parseLevel(level)),20).won,false,`${level.name}: empty bin must fail`);
  const solved=parseLevel({...level,bodies:[...level.bodies,...solutions[i].parts.map(p=>part(p.kind,p.x,p.y,p))]});const world=simulate(createWorld(solved),20);assert.equal(world.won,true,`${level.name}: reference solution must win`);
  const again=parseLevel(JSON.parse(JSON.stringify(solved)));assert.deepEqual(again.bodies,solved.bodies);assert.deepEqual(again.connections,solved.connections);assert.deepEqual(again.goal,solved.goal);assert.deepEqual(again.inventory,solved.inventory);
  if(level.id==='pulley-gate'){
    for(const omitted of ['drop-weight','rope','movable']){const blocked=structuredClone(solved);if(omitted==='drop-weight')blocked.bodies=blocked.bodies.filter(b=>b.id!==omitted);if(omitted==='rope')blocked.connections=[];if(omitted==='movable')blocked.bodies.find(b=>b.id==='movable-pulley').pinned=true;assert.equal(simulate(createWorld(blocked),20).won,false,`Door must need ${omitted}`);}
    for(const [dx,da] of [[-8,0],[8,0],[0,-.03],[0,.03]]){const nearby=structuredClone(solved),ramp=nearby.bodies.find(b=>b.stock);ramp.x+=dx;ramp.angle+=da;assert.equal(simulate(createWorld(nearby),20).won,true,'Nearby ramp placement must work');}
    const reset=new Workshop(solved),first=simulate(reset.world,8);const outcome=structuredClone(first);reset.reset();assert.deepEqual(simulate(reset.world,8),outcome);
  }
  console.log(`PASS ${level.name}`);
}
console.log('PASS gravity, stacks, thin collisions, belt chains, ropes, switches, strict imports, undo, puzzle solutions and JSON round trips');
