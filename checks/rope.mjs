import assert from 'node:assert/strict';
import {blankLevel,makePart,parseLevel,PARTS} from '../dist/model.js';
import {createWorld,stepWorld} from '../dist/physics.js';
import {ropeGeometry} from '../dist/rope.js';
import {Workshop} from '../dist/workshop.js';
const part=(kind,id,x,y,extra={})=>makePart(kind,x,y,{id,...extra});
const routed=(bodies,via,wrap)=>{const c={id:'rope',kind:'rope',a:bodies[0].id,b:bodies.at(-1).id,via,wrap,ax:0,ay:0,bx:0,by:0,length:1};c.length=ropeGeometry(bodies,c).length;return parseLevel({...blankLevel(),bodies,connections:[c],environment:{width:1600,height:1000,gravity:0,pressure:0,floor:false}});};
const movable=()=>routed([part('anchor','a',400,100),part('pulley','p',450,400,{w:96,h:96,pinned:false}),part('pulley','q',550,100,{w:96,h:96}),part('box','b',600,550,{w:60,h:100})],['p','q'],[-1,1]);
{
  const level=movable(),c=level.connections[0],geometry=ropeGeometry(level.bodies,c);
  assert.ok(Math.abs(geometry.length-(1050+100*Math.PI))<1e-8);
  for(const term of geometry.terms)for(const key of ['x','y','angle']){
    const original=term.body[key],h=1e-4;term.body[key]=original+h;const plus=ropeGeometry(level.bodies,c).length;term.body[key]=original-h;const minus=ropeGeometry(level.bodies,c).length;term.body[key]=original;
    assert.ok(Math.abs((plus-minus)/(2*h)-(key==='angle'?term.angular:term.g[key]))<1e-6,`Rope derivative ${term.body.id}.${key}`);
  }
  const radius=geometry.arcs[0].radius;assert.equal(radius,50);for(const point of [geometry.spans[0].to,geometry.spans[1].from])assert.ok(Math.abs(Math.hypot(point.x-450,point.y-400)-radius)<1e-8);
  level.bodies[1].w=156;const bigger=ropeGeometry(level.bodies,c);assert.equal(bigger.arcs[0].radius,80);assert.ok(bigger.length>geometry.length+70);
}
{
  const level=movable(),world=createWorld(level);world.bodies[1].vy=150;for(let i=0;i<60;i++)stepWorld(world);
  const pulley=world.bodies[1],door=world.bodies[3];assert.ok(pulley.y>410);assert.ok(door.y<530);assert.ok(Math.abs(2*(pulley.y-400)+(door.y-550))<.02);assert.ok(Math.abs(2*pulley.vy+door.vy)<1e-7);
  assert.ok(pulley.sheaveAngle>.2);assert.ok(world.bodies[2].sheaveAngle<-.4);assert.ok(Math.abs(pulley.sheaveAngle*50-(pulley.y-400))<.1);assert.ok(Math.abs(world.bodies[2].sheaveAngle*50-(door.y-550))<.1);
  const slack=movable();slack.connections[0].length+=500;const loose=createWorld(slack);loose.bodies[1].vy=150;stepWorld(loose);assert.equal(loose.bodies[3].vy,0);assert.equal(loose.connections[0].tension,0);
}
{
  const level=movable();level.environment.gravity=850;const world=createWorld(level);stepWorld(world);assert.ok(world.connections[0].tension>0);assert.ok(world.bodies[1].vy<0,'Heavier door must lift movable pulley');
  const offCenter=movable();offCenter.connections[0].bx=25;offCenter.connections[0].length=ropeGeometry(offCenter.bodies,offCenter.connections[0]).length;const torque=createWorld(offCenter);torque.bodies.at(-1).vy=150;stepWorld(torque);assert.ok(Math.abs(torque.bodies.at(-1).omega)>.01);
}
{
  const level=movable();assert.throws(()=>parseLevel({...level,version:2}),/v3/);assert.throws(()=>parseLevel({...level,connections:[{...level.connections[0],a:'p'}]}),/middle/);assert.throws(()=>parseLevel({...level,connections:[{...level.connections[0],wrap:[0,1]}]}),/clockwise/);
  const invalid=structuredClone(level);invalid.bodies[0].x=450;invalid.bodies[0].y=400;assert.throws(()=>parseLevel(invalid),/inside a pulley/);
  const wheel=structuredClone(level);wheel.connections=[{id:'belt',kind:'belt',a:'p',b:'q',length:300}];assert.throws(()=>parseLevel(wheel),/belt wheels/);
}
{
  const workshop=new Workshop(movable());workshop.selected='rope';const original=workshop.export();workshop.updateRope({length:original.connections[0].length+80});workshop.undo();assert.deepEqual(workshop.export(),original);workshop.redo();assert.equal(workshop.export().connections[0].length,original.connections[0].length+80);
  const run=()=>{workshop.world.bodies[1].vy=500;for(let i=0;i<90;i++)stepWorld(workshop.world);return structuredClone(workshop.world);};const first=run();workshop.reset();assert.equal(workshop.world.bodies[1].sheaveAngle,0);assert.equal(workshop.world.connections[0].tension,0);assert.deepEqual(run(),first);assert.deepEqual(parseLevel(JSON.parse(JSON.stringify(workshop.export()))),workshop.export());
}
{
  const level=routed([part('anchor','a',400,550),part('pulley','p',600,500,{w:96,h:96}),part('box','b',800,549)],['p'],[-1]);
  const world=createWorld(level),rope=world.connections[0];world.bodies.at(-1).vy=240;stepWorld(world);assert.equal(rope.routeCrossed,true);assert.equal(rope.blocked,false);assert.ok(rope.tension>0);assert.ok(ropeGeometry(world.bodies,rope).length-rope.length<.05,'A crossed wrap must remain inextensible');
  for(let i=0;i<1200;i++){stepWorld(world);assert.ok(ropeGeometry(world.bodies,rope).length-rope.length<.05,'A crossed wrap must never disable the length constraint');}
  assert.equal(createWorld(level).connections[0].routeCrossed,false);
}
{
  const tether=(kind,anchorY,loadY,extra,environment)=>{const bodies=[part('anchor','fixed',400,anchorY),part(kind,'load',400,loadY,{fixed:false,pinned:false,...extra})],level=routed(bodies,[],[]);level.environment={width:1600,height:3000,floor:false,...environment};return createWorld(level);};
  for(const [kind,world] of [['balloon',tether('balloon',500,200,{material:'helium'},{gravity:850,pressure:1})],['rocket',tether('rocket',100,400,{angle:Math.PI,on:true,power:5},{gravity:0,pressure:0})]]){const rope=world.connections[0];for(let i=0;i<2400;i++){stepWorld(world);assert.ok(ropeGeometry(world.bodies,rope).length-rope.length<.05,`${kind} thrust must not stretch its rope`);}assert.equal(rope.blocked,false);}
}
{
  for(const kind of Object.keys(PARTS).filter(kind=>kind!=='pulley')){
    const zone=kind==='material-zone',level={...blankLevel(),bodies:[part('anchor','fixed',100,100),part(kind,'load',500,100,zone?{}:{fixed:false,pinned:false,on:false})],environment:{width:1600,height:1000,gravity:0,pressure:0,floor:false}};
    const workshop=new Workshop(level);workshop.addConnection('rope','fixed','load',{ax:0,ay:0,bx:0,by:0});
    if(zone){assert.equal(workshop.world.connections.length,1,'material-zone must anchor a rope');continue;}const rope=workshop.world.connections[0],load=workshop.world.bodies[1];load.vx=120;stepWorld(workshop.world);
    assert.ok(rope.tension>0,`${kind} must receive rope tension`);assert.ok(Math.abs(load.vx)<1e-7,`${kind} must react to rope tension`);
  }
}
console.log('PASS pulley routing and every other component as a force-bearing rope endpoint');
