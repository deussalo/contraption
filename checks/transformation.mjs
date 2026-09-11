import assert from 'node:assert/strict';
import {blankLevel,makePart,parseLevel} from '../dist/model.js';
import {createWorld,stepWorld} from '../dist/physics.js';
import {Workshop} from '../dist/workshop.js';

const part=(kind,id,x,y,extra={})=>makePart(kind,x,y,{id,...extra});
const scene=outputMaterial=>parseLevel({...blankLevel(),environment:{width:1600,height:1000,gravity:0,pressure:0,floor:false},bodies:[part('circle','traveller',100,300,{material:outputMaterial==='cork'?'steel':'cork'}),part('material-zone','zone',200,300,{w:80,h:160,outputMaterial})]});
const run=world=>{let transformations=0;for(let frame=0;frame<240;frame++)transformations+=stepWorld(world).filter(event=>event.kind==='transform').length;return transformations;};

assert.throws(()=>parseLevel({...scene('steel'),bodies:scene('steel').bodies.map(body=>body.id==='zone'?{...body,outputMaterial:'granite'}:body)}),/Unknown output material/);
assert.throws(()=>parseLevel({...scene('steel'),bodies:scene('steel').bodies.map(body=>body.id==='zone'?{...body,fixed:false}:body)}),/must be fixed/);
{const workshop=new Workshop(scene('steel'));workshop.selected='zone';assert.throws(()=>workshop.update({fixed:false}),/must be fixed/);assert.throws(()=>workshop.update({outputMaterial:'granite'}),/Unknown output material/);}
{
  const level=scene('steel'),world=createWorld(level),control=createWorld(parseLevel({...level,bodies:level.bodies.filter(body=>body.id!=='zone').map(body=>({...body,material:'steel'}))}));
  world.bodies[0].vx=control.bodies[0].vx=120;world.bodies[0].omega=control.bodies[0].omega=.75;
  assert.equal(run(world),1);run(control);const body=world.bodies[0],expected=control.bodies[0];
  assert.equal(body.material,'steel');assert.deepEqual(body.transformedZones,['zone']);assert.equal(body.mass,expected.mass);assert.equal(body.inertia,expected.inertia);assert.equal(body.x,expected.x);assert.equal(body.y,expected.y);assert.equal(body.angle,expected.angle);assert.equal(body.vx,expected.vx);assert.equal(body.vy,expected.vy);assert.equal(body.omega,expected.omega);
  const workshop=new Workshop(level);workshop.world.bodies[0].vx=120;run(workshop.world);workshop.reset();assert.equal(workshop.world.bodies[0].material,'cork');assert.deepEqual(workshop.world.bodies[0].transformedZones,[]);workshop.world.bodies[0].vx=120;assert.equal(run(workshop.world),1);
}
{
  const world=createWorld(scene('cork')),before=world.bodies[0].mass;world.bodies[0].vx=120;assert.equal(run(world),1);assert.equal(world.bodies[0].material,'cork');assert.ok(world.bodies[0].mass<before);
}
console.log('PASS one-shot material zones, immediate mass changes, preserved velocity, featherweight output and reset');
