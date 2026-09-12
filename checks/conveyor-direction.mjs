import assert from 'node:assert/strict';
import {blankLevel,makePart,parseLevel} from '../dist/model.js';
import {conveyorSurfaceSpeed,createWorld,stepWorld} from '../dist/physics.js';

const displacement=[];
for(const direction of [-1,1]){
  const level={...blankLevel(),environment:{width:1000,height:700,gravity:850,pressure:0,floor:false},bodies:[
    makePart('conveyor',500,500,{id:'belt',w:500,on:true,power:1,direction}),
    makePart('circle',500,460,{id:'load',w:50,h:50,material:'rubber'}),
  ]};
  const world=createWorld(parseLevel(level)),belt=world.bodies[0],load=world.bodies[1],speed=conveyorSurfaceSpeed(belt);
  for(let frame=0;frame<240;frame++)stepWorld(world);
  assert.equal(Math.sign(load.x-500),Math.sign(speed),`Direction ${direction} must carry its load with the animated surface`);
  assert.equal(Math.sign(load.vx),Math.sign(speed),`Direction ${direction} must leave its load moving with the animated surface`);
  assert.ok(Math.abs(load.x-500)>80,`Direction ${direction} must produce visible transport`);
  displacement.push(load.x-500);
}
assert.ok(displacement[0]>0&&displacement[1]<0,'Opposite conveyor settings must produce opposite visible motion');
console.log('PASS conveyor animation and carried loads share one signed surface velocity');
