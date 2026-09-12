import {PARTS,MATERIALS,clamp} from './model.js';
import {dot,cross,sub,add,mul,norm,rotate,localPoint,worldPoint} from './vectors.js';
import {ropeGeometry,ropeWrap,ropePolyline,prepareRopes,solveRopeVelocity,solveRopePosition,finishRopes} from './rope.js';
export {rotate,localPoint,worldPoint} from './vectors.js';
export {ropeGeometry,ropeWrap} from './rope.js';
export function setMass(b){
  const material=MATERIALS[b.material],circle=PARTS[b.kind].shape==='circle',area=circle?Math.PI*b.w*b.w/4:b.w*b.h;
  b.mass=area*material.density/1800;b.inertia=circle?b.mass*b.w*b.w/8:b.mass*(b.w*b.w+b.h*b.h)/12;
  b.invMass=b.fixed||b.pinned||b.held?0:1/b.mass;b.invI=b.fixed||b.held?0:1/b.inertia;
  return b;
}
export function createBody(p){return setMass({...structuredClone(p),vx:0,vy:0,omega:0,sheaveAngle:0,state:p.kind==='switch'?'off':p.on?'on':'off',active:p.on,held:false,exited:null,lastImpact:-10,transformedZones:[]});}
function fixture(b,x=0,y=0,w=b.w,h=b.h,shape=PARTS[b.kind].shape){const center=worldPoint(b,x,y);return {body:b,x:center.x,y:center.y,w,h,angle:b.angle,shape};}
function fixtures(b){
  if(PARTS[b.kind].shape!=='bucket')return[fixture(b)];
  return[fixture(b,-b.w/2+5,0,10,b.h,'box'),fixture(b,b.w/2-5,0,10,b.h,'box'),fixture(b,0,b.h/2-5,b.w,10,'box')];
}
export function vertices(f){const axes=[rotate(f.w/2,0,f.angle),rotate(0,f.h/2,f.angle)];return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>({x:f.x+axes[0].x*sx+axes[1].x*sy,y:f.y+axes[0].y*sx+axes[1].y*sy}));}
function axes(f){return[rotate(1,0,f.angle),rotate(0,1,f.angle)];}
function projectRadius(f,n){const [u,v]=axes(f);return Math.abs(dot(u,n))*f.w/2+Math.abs(dot(v,n))*f.h/2;}
function circleCircle(a,b){const delta=sub(b,a),distance=Math.hypot(delta.x,delta.y),depth=(a.w+b.w)/2-distance;if(depth<=0)return null;const n=norm(delta);return{n,points:[{...add(a,mul(n,a.w/2-depth/2)),depth}]};}
function circleBox(circle,box){
  const local=rotate(circle.x-box.x,circle.y-box.y,-box.angle),q={x:clamp(local.x,-box.w/2,box.w/2),y:clamp(local.y,-box.h/2,box.h/2)};
  let delta=sub(local,q),d=Math.hypot(delta.x,delta.y),depth=circle.w/2-d,out;
  if(d>1e-7){if(depth<=0)return null;out=mul(delta,1/d);}
  else{const dx=box.w/2-Math.abs(local.x),dy=box.h/2-Math.abs(local.y);out=dx<dy?{x:Math.sign(local.x)||1,y:0}:{x:0,y:Math.sign(local.y)||1};depth=circle.w/2+Math.min(dx,dy);q.x=local.x+out.x*Math.min(dx,dy);q.y=local.y+out.y*Math.min(dx,dy);}
  const n=rotate(out.x,out.y,box.angle),point=add(box,rotate(q.x,q.y,box.angle));return{n:mul(n,-1),points:[{...point,depth}]};
}
function clip(points,n,offset){
  if(points.length<2)return points;const [a,b]=points,da=dot(a,n)-offset,db=dot(b,n)-offset,result=[];
  if(da<=0)result.push(a);if(db<=0)result.push(b);if(da*db<0)result.push(add(a,mul(sub(b,a),da/(da-db))));return result.slice(0,2);
}
function boxBox(a,b){
  const delta=sub(b,a);let depth=Infinity,best=null,reference=a;
  for(const f of [a,b])for(const axis of axes(f)){const overlap=projectRadius(a,axis)+projectRadius(b,axis)-Math.abs(dot(delta,axis));if(overlap<=0)return null;if(overlap<depth){depth=overlap;best=dot(delta,axis)<0?mul(axis,-1):axis;reference=f;}}
  const incident=reference===a?b:a,nr=reference===a?best:mul(best,-1),t={x:-nr.y,y:nr.x},face=add(reference,mul(nr,projectRadius(reference,nr))),side=projectRadius(reference,t);
  const incidentAxes=axes(incident);let outward=incidentAxes[0];if(Math.abs(dot(nr,incidentAxes[1]))>Math.abs(dot(nr,outward)))outward=incidentAxes[1];if(dot(outward,nr)>0)outward=mul(outward,-1);
  const incidentCenter=add(incident,mul(outward,projectRadius(incident,outward))),it={x:-outward.y,y:outward.x},ir=projectRadius(incident,it);
  let points=[add(incidentCenter,mul(it,ir)),add(incidentCenter,mul(it,-ir))];points=clip(points,t,dot(face,t)+side);points=clip(points,mul(t,-1),-dot(face,t)+side);
  points=points.map(p=>({...p,depth:-dot(sub(p,face),nr)})).filter(p=>p.depth>=-.02).map(p=>({...add(p,mul(nr,p.depth/2)),depth:Math.max(0,p.depth)}));
  return points.length?{n:best,points}:null;
}
function collision(a,b){
  if(Math.abs(a.x-b.x)>(a.w+a.h+b.w+b.h)/2||Math.abs(a.y-b.y)>(a.w+a.h+b.w+b.h)/2)return null;
  if(a.shape==='circle'&&b.shape==='circle')return circleCircle(a,b);
  if(a.shape==='circle')return circleBox(a,b);
  if(b.shape==='circle'){const contact=circleBox(b,a);if(contact)contact.n=mul(contact.n,-1);return contact;}
  return boxBox(a,b);
}
export function overlaps(a,b,slop=1){return fixtures(a).some(f=>fixtures(b).some(g=>{const c=collision(f,g);return c&&c.points.some(p=>p.depth>slop);}));}
export function pointInside(b,x,y,padding=0){const p=localPoint(b,x,y);return PARTS[b.kind].shape==='circle'?Math.hypot(p.x,p.y)<=b.w/2+padding:Math.abs(p.x)<=b.w/2+padding&&Math.abs(p.y)<=b.h/2+padding;}
function velocity(b,r){return {x:b.vx-b.omega*r.y,y:b.vy+b.omega*r.x};}
function impulse(b,j,r,sign){b.vx+=j.x*b.invMass*sign;b.vy+=j.y*b.invMass*sign;b.omega+=cross(r,j)*b.invI*sign;}
function massAt(a,b,ra,rb,n){return a.invMass+b.invMass+cross(ra,n)**2*a.invI+cross(rb,n)**2*b.invI;}
function bounds(b){
  if(PARTS[b.kind].shape==='circle'){const radius=b.w/2;return{minX:b.x-radius,maxX:b.x+radius,minY:b.y-radius,maxY:b.y+radius};}
  const cosine=Math.abs(Math.cos(b.angle)),sine=Math.abs(Math.sin(b.angle)),halfX=(b.w*cosine+b.h*sine)/2,halfY=(b.w*sine+b.h*cosine)/2;
  return{minX:b.x-halfX,maxX:b.x+halfX,minY:b.y-halfY,maxY:b.y+halfY};
}
function collisionCandidates(bodies){
  const entries=bodies.map((body,index)=>({body,index,bounds:bounds(body),fixtures:fixtures(body)})).sort((a,b)=>a.bounds.minX-b.bounds.minX||a.index-b.index),active=[],pairs=[];
  for(const entry of entries){
    for(let i=active.length-1;i>=0;i--)if(active[i].bounds.maxX<entry.bounds.minX)active.splice(i,1);
    for(const other of active){
      if(other.bounds.maxY<entry.bounds.minY||entry.bounds.maxY<other.bounds.minY)continue;
      const a=other.index<entry.index?other:entry,b=a===other?entry:other;
      pairs.push([a,b]);
    }
    active.push(entry);
  }
  return pairs.sort((a,b)=>a[0].index-b[0].index||a[1].index-b[1].index);
}
function contactPairs(world,position=false){
  const bodies=world.floor?[...world.bodies,world.floor]:world.bodies,contacts=[];
  for(const [first,second] of collisionCandidates(bodies)){
    const a=first.body,b=second.body;if(a.state==='popped'||b.state==='popped'||(a.invMass+a.invI+b.invMass+b.invI===0)||PARTS[a.kind].sensor||PARTS[b.kind].sensor)continue;
    for(const fa of first.fixtures)for(const fb of second.fixtures){
      const manifold=collision(fa,fb);if(!manifold)continue;
      const n=manifold.n,t={x:-n.y,y:n.x};
      const c={a,b,n,t,friction:Math.sqrt(MATERIALS[a.material].friction*MATERIALS[b.material].friction),points:manifold.points};
      if(!position)for(const p of c.points){p.ra=sub(p,a);p.rb=sub(p,b);const vn=dot(sub(velocity(b,p.rb),velocity(a,p.ra)),n);p.target=vn<-40?-Math.max(MATERIALS[a.material].bounce,MATERIALS[b.material].bounce)*vn:0;p.jn=0;p.jt=0;p.speed=-vn;
        for(const [spring,other,out] of [[a,b,n],[b,a,mul(n,-1)]])if(spring.kind==='trampoline'&&other.invMass>0&&dot(out,rotate(0,-1,spring.angle))>.4&&vn<-10)p.target=Math.max(p.target,600*spring.power);
      }
      contacts.push(c);
    }
  }
  return contacts;
}
function solveVelocity(c){
  const {a,b,n,t}=c;
  for(const p of c.points){const kn=massAt(a,b,p.ra,p.rb,n);if(kn<1e-9)continue;
    const relative=sub(velocity(b,p.rb),velocity(a,p.ra)),previous=p.jn;p.jn=Math.max(0,p.jn+(p.target-dot(relative,n))/kn);const j=mul(n,p.jn-previous);impulse(a,j,p.ra,-1);impulse(b,j,p.rb,1);
    const kt=massAt(a,b,p.ra,p.rb,t);if(kt<1e-9)continue;
    const surface=(a.kind==='conveyor'&&a.active?a.power*160*a.direction:0)-(b.kind==='conveyor'&&b.active?b.power*160*b.direction:0),old=p.jt;
    p.jt=clamp(p.jt-(dot(sub(velocity(b,p.rb),velocity(a,p.ra)),t)+surface)/kt,-c.friction*p.jn,c.friction*p.jn);
    const friction=mul(t,p.jt-old);impulse(a,friction,p.ra,-1);impulse(b,friction,p.rb,1);
  }
}
function solvePosition(c){
  for(const p of c.points){const ra=sub(p,c.a),rb=sub(p,c.b),k=massAt(c.a,c.b,ra,rb,c.n);if(k<1e-9)continue;const correction=Math.min(15,Math.max(0,p.depth-.12))*.35/k/c.points.length,j=mul(c.n,correction);
    for(const [b,r,sign] of [[c.a,ra,-1],[c.b,rb,1]]){b.x+=j.x*b.invMass*sign;b.y+=j.y*b.invMass*sign;b.angle+=clamp(cross(r,j)*b.invI*sign,-.08,.08);}
  }
}
export function connectionPoints(world,c){
  if(c.kind==='rope')return ropePolyline(ropeGeometry(world.bodies,c));
  const a=world.bodies.find(b=>b.id===c.a),b=world.bodies.find(b=>b.id===c.b);if(!a||!b)return[];
  return[worldPoint(a,c.ax,c.ay),worldPoint(b,c.bx,c.by)];
}
export function pathLength(points){return points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);}
function emit(world,b,kind,strength){if(world.time-b.lastImpact<.12||strength<35)return;b.lastImpact=world.time;world.events.push({kind,x:b.x,y:b.y,strength,time:world.time});world.reactions++;}
function updateDevices(world,dt){
  const wired=new Set(world.connections.filter(c=>c.kind==='wire').map(c=>c.b));
  for(const b of world.bodies){if(wired.has(b.id))b.active=world.connections.some(c=>c.kind==='wire'&&c.b===b.id&&world.bodies.find(a=>a.id===c.a)?.state==='on');else b.active=b.on;
    if(b.kind==='motor'&&b.active&&!b.held)b.omega=b.power*b.direction*3;
    if(b.kind==='rocket'&&b.active&&b.invMass){const direction=rotate(0,-1,b.angle);b.vx+=direction.x*1800*b.power*dt;b.vy+=direction.y*1800*b.power*dt;b.state='fired';}
  }
  const belts=world.connections.filter(c=>c.kind==='belt'),linked=new Map(),visited=new Set();
  for(const c of belts)for(const [a,b] of [[c.a,c.b],[c.b,c.a]]){if(!linked.has(a))linked.set(a,[]);linked.get(a).push(b);}
  const byId=new Map(world.bodies.map(b=>[b.id,b]));
  for(const source of world.bodies.filter(b=>b.kind==='motor')){
    if(visited.has(source.id))continue;const queue=[source];visited.add(source.id);
    if(!source.active)source.omega=0;
    for(let i=0;i<queue.length;i++){const drive=queue[i];for(const id of linked.get(drive.id)??[]){
      if(visited.has(id))continue;visited.add(id);const driven=byId.get(id);
      driven.active=drive.active;driven.power=drive.power;driven.direction=drive.direction;
      if(driven.invI&&!driven.held)driven.omega=drive.omega*drive.w/driven.w;
      queue.push(driven);
    }}
  }
  for(const fan of world.bodies.filter(b=>b.kind==='fan'&&b.active))for(const b of world.bodies){if(!b.invMass)continue;
    const relative=localPoint(fan,b.x,b.y);if(relative.x>0&&relative.x<360&&Math.abs(relative.y)<fan.h/2+relative.x*.3){const strength=950*fan.power*(1-relative.x/420)/Math.max(.15,Math.sqrt(b.mass)),direction=rotate(1,0,fan.angle);b.vx+=direction.x*strength*dt;b.vy+=direction.y*strength*dt;}
  }
  for(const sensor of world.bodies.filter(b=>b.kind==='material-zone'))for(const b of world.bodies){
    if(!b.invMass||b.held||b===sensor||b.transformedZones.includes(sensor.id)||!pointInside(sensor,b.x,b.y))continue;
    b.material=sensor.outputMaterial;b.transformedZones.push(sensor.id);setMass(b);world.cachedContacts=[];world.reactions++;world.events.push({kind:'transform',material:b.material,x:b.x,y:b.y,strength:500,time:world.time});
  }
  for(const sensor of world.bodies.filter(b=>PARTS[b.kind].sensor&&b.kind!=='material-zone'))for(const b of world.bodies){
    if(!b.invMass||b.held||b===sensor||!overlaps(sensor,b,0))continue;
    if(sensor.kind==='bell'&&sensor.state!=='rung'){sensor.state='rung';emit(world,sensor,'bell',300);}
    if(sensor.kind==='switch'&&sensor.state!=='on'){sensor.state='on';emit(world,sensor,'switch',100);}
  }
  for(const balloon of world.bodies.filter(b=>b.kind==='balloon'&&b.state!=='popped'))for(const rocket of world.bodies.filter(b=>b.kind==='rocket'&&b.state==='fired'))if(overlaps(balloon,rocket)){balloon.state='popped';emit(world,balloon,'pop',200);}
}
function goalProgress(world){
  const goal=world.goal;if(!goal)return{count:0,needed:0,held:0,complete:false};
  const candidates=world.bodies.filter(b=>goal.target===b.id||goal.target===b.kind||(goal.target==='any'&&!b.fixed&&!b.pinned));
  const count=candidates.filter(b=>goal.kind==='state'?b.state===goal.state:goal.kind==='edge'?b.exited===goal.edge:b.x>=goal.x-goal.w/2&&b.x<=goal.x+goal.w/2&&b.y>=goal.y-goal.h/2&&b.y<=goal.y+goal.h/2).length;
  return {count,needed:goal.count,held:world.goalHeld,complete:world.won};
}
export function createWorld(level){
  const world={bodies:level.bodies.map(createBody),connections:structuredClone(level.connections),environment:{...level.environment},goal:structuredClone(level.goal),time:0,reactions:0,events:[],goalHeld:0,won:false,floor:null};
  for(const c of world.connections)if(c.kind==='rope'){c.wrap??=ropeWrap(world.bodies,c);c.tension=0;c.routeCrossed=false;c.blocked=false;c.arcSweeps=ropeGeometry(world.bodies,c).arcs.map(arc=>arc.delta);}
  if(level.environment.floor)world.floor=createBody({id:'__ground',kind:'ramp',x:level.environment.width/2,y:level.environment.height-40,w:level.environment.width*4,h:40,angle:0,material:'wood',fixed:true,pinned:false,locked:true,power:1,direction:1,on:true});
  return world;
}
function tick(world,dt){
  world.time+=dt;updateDevices(world,dt);
  for(const b of world.bodies){if(b.held||b.state==='popped')continue;const m=MATERIALS[b.material];
    if(b.invMass){b.vy+=world.environment.gravity*(1-.022*world.environment.pressure/m.density)*dt;const drag=Math.exp(-dt*world.environment.pressure*.045/Math.max(.025,m.density));b.vx*=drag;b.vy*=drag;b.vx=clamp(b.vx,-2200,2200);b.vy=clamp(b.vy,-2200,2200);b.x+=b.vx*dt;b.y+=b.vy*dt;}
    if(b.invI){b.omega=clamp(b.omega,-35,35);b.angle+=b.omega*dt;b.omega*=Math.exp(-dt*.015);}
    if(b.x+b.w/2<0)b.exited='left';else if(b.x-b.w/2>world.environment.width)b.exited='right';else if(b.y+b.h/2<0)b.exited='top';else if(b.y-b.h/2>world.environment.height)b.exited='bottom';
  }
  const contacts=contactPairs(world),ropes=prepareRopes(world,dt);
  const cached=world.cachedContacts??[],used=new Set();
  for(const c of contacts)for(const p of c.points){
    const local=localPoint(c.a,p.x,p.y),index=cached.findIndex((old,i)=>!used.has(i)&&old.a===c.a.id&&old.b===c.b.id&&dot(old.n,c.n)>.95&&Math.hypot(local.x-old.x,local.y-old.y)<6);
    if(index<0)continue;used.add(index);const old=cached[index],ratio=dt/(world.cachedDt??dt);p.jn=old.jn*ratio;p.jt=old.jt*ratio;
    const j=add(mul(c.n,p.jn),mul(c.t,p.jt));impulse(c.a,j,p.ra,-1);impulse(c.b,j,p.rb,1);
  }
  for(let i=0;i<12;i++){for(const c of contacts)solveVelocity(c);solveRopeVelocity(ropes);}
  world.cachedContacts=contacts.flatMap(c=>c.points.map(p=>({...localPoint(c.a,p.x,p.y),a:c.a.id,b:c.b.id,n:c.n,jn:p.jn,jt:p.jt})));world.cachedDt=dt;
  for(let i=0;i<3;i++){for(const c of contactPairs(world,true))solvePosition(c);solveRopePosition(world);}
  finishRopes(ropes,dt);
  for(const c of contacts){const strength=Math.max(...c.points.map(p=>p.speed));if(strength>35){const b=c.a.fixed?c.b:c.a,kind=c.a.kind==='trampoline'||c.b.kind==='trampoline'?'trampoline':b.material;emit(world,b,kind,strength);}}
  if(world.goal&&!world.won){const progress=goalProgress(world);world.goalHeld=progress.count>=progress.needed?world.goalHeld+dt:0;if(progress.count>=progress.needed&&world.goalHeld>=world.goal.delay){world.won=true;world.events.push({kind:'goal',x:world.goal.x,y:world.goal.y,strength:300,time:world.time});}}
}
export function stepWorld(world,dt=1/120){
  world.events=[];
  if(!Number.isFinite(dt)||dt<=0||dt>1)throw Error('Physics timestep must be between 0 and 1 second.');
  for(let remaining=dt;remaining>1e-10;){const slice=Math.min(remaining,1/120);remaining-=slice;
  const maxSpeed=world.bodies.reduce((max,b)=>Math.max(max,Math.hypot(b.vx,b.vy)+Math.abs(b.omega)*Math.max(b.w,b.h)/2),0),steps=clamp(Math.ceil(maxSpeed*slice/6),1,6);
  for(let i=0;i<steps;i++)tick(world,slice/steps);}
  return world.events;
}
export {goalProgress};
