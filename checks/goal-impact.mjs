import assert from 'node:assert/strict';
import {blankLevel,makePart,parseLevel} from '../dist/model.js';
import {createWorld,goalProgress,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const body=(kind,id,x,y,properties={})=>makePart(kind,x,y,{id,...properties});
const source={...blankLevel(),mode:'puzzle',environment:{width:800,height:600,gravity:0,pressure:0,floor:false},bodies:[
  body('bell','bell',400,300),
  body('box','shortcut',400,300,{fixed:false}),
  body('rocket','courier',100,100,{fixed:false}),
],goal:{kind:'state',target:'bell',state:'rung',hitBy:['courier']}};
const level=parseLevel(source),world=createWorld(level);stepWorld(world);
assert.equal(world.bodies.find(candidate=>candidate.id==='bell').state,'rung','The wrong object may still ring the bell visibly');
assert.deepEqual(world.bodies.find(candidate=>candidate.id==='bell').triggeredBy,['shortcut']);
assert.equal(goalProgress(world).count,0,'An unintended object must not satisfy a source-specific goal');
assert.equal(world.won,false,'Dropping a spare part onto the bell must not win');
world.bodies.find(candidate=>candidate.id==='shortcut').x=0;Object.assign(world.bodies.find(candidate=>candidate.id==='courier'),{x:400,y:300});stepWorld(world);
assert.deepEqual(world.bodies.find(candidate=>candidate.id==='bell').triggeredBy,['shortcut','courier']);
assert.equal(world.won,true,'The authored impact source must satisfy the goal even after a wrong impact');
assert.throws(()=>parseLevel({...source,goal:{...source.goal,hitBy:'missing'}}),/impact source/);
assert.throws(()=>parseLevel({...source,goal:{kind:'state',target:'courier',state:'fired',hitBy:'shortcut'}}),/impact source/);
const editor=new Workshop({...source,mode:'editor',goal:null});editor.setGoal({...source.goal,hitBy:'courier'});assert.deepEqual(editor.level.goal.hitBy,['courier']);assert.throws(()=>editor.setGoal({...source.goal,hitBy:'missing'}),/impact source/,'Goal authoring must reject invalid sources immediately');
console.log('PASS source-specific goals reject dropped-part shortcuts and remember valid later impacts');
