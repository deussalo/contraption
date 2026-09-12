import {dot,cross,sub,add,mul,worldPoint} from './vectors.js';
const TAU=Math.PI*2;
function nodesFor(bodies,c){
  const byId=new Map(bodies.map(b=>[b.id,b])),a=byId.get(c.a),b=byId.get(c.b);
  if(!a||!b)throw Error('Rope endpoint is missing.');
  const endpoint=(body,x,y)=>({body,...worldPoint(body,x??0,y??0),radius:0});
  return[endpoint(a,c.ax,c.ay),...(c.via??[]).map(id=>{const body=byId.get(id);if(!body||body.kind!=='pulley')throw Error('Rope guide is not a pulley.');return{body,x:body.x,y:body.y,radius:body.w/2+2};}),endpoint(b,c.bx,c.by)];
}
export function ropeWrap(bodies,c){const nodes=nodesFor(bodies,c);return nodes.slice(1,-1).map((p,i)=>cross(sub(p,nodes[i]),sub(nodes[i+2],p))<0?-1:1);}
export function ropeGeometry(bodies,c){
  const nodes=nodesFor(bodies,c),wrap=c.wrap??ropeWrap(bodies,c),sides=[1,...wrap,1],spans=[],arcs=[];let valid=true;
  for(let i=0;i<nodes.length-1;i++){
    const a=nodes[i],b=nodes[i+1],d=sub(b,a),rawDistance=Math.hypot(d.x,d.y),distance=Math.max(.001,rawDistance),angle=Math.atan2(d.y,d.x)+Math.asin(Math.max(-.999999,Math.min(.999999,(sides[i]*a.radius-sides[i+1]*b.radius)/distance))),t={x:Math.cos(angle),y:Math.sin(angle)};
    const normal=s=>({x:s*t.y,y:-s*t.x}),from=add(a,mul(normal(sides[i]),a.radius)),to=add(b,mul(normal(sides[i+1]),b.radius));
    if(rawDistance<=Math.abs(sides[i]*a.radius-sides[i+1]*b.radius)+1e-6)valid=false;
    spans.push({from,to,t,length:Math.max(0,dot(sub(to,from),t))});
  }
  for(let i=1;i<nodes.length-1;i++){
    const p=nodes[i],start=Math.atan2(spans[i-1].to.y-p.y,spans[i-1].to.x-p.x),end=Math.atan2(spans[i].from.y-p.y,spans[i].from.x-p.x),direction=sides[i],delta=direction*((direction*(end-start)%TAU+TAU)%TAU);
    arcs.push({x:p.x,y:p.y,radius:p.radius,start,delta,id:p.body.id});
  }
  const length=spans.reduce((sum,p)=>sum+p.length,0)+arcs.reduce((sum,p)=>sum+p.radius*Math.abs(p.delta),0),terms=new Map();
  nodes.forEach((node,i)=>{
    const gradient=i===0?mul(spans[0].t,-1):i===nodes.length-1?spans.at(-1).t:sub(spans[i-1].t,spans[i].t),angular=node.radius?0:cross(sub(node,node.body),gradient);
    if(!terms.has(node.body.id))terms.set(node.body.id,{body:node.body,g:{x:0,y:0},angular:0});const term=terms.get(node.body.id);term.g=add(term.g,gradient);term.angular+=angular;
  });
  return{spans,arcs,length,valid,terms:[...terms.values()]};
}
export function ropePolyline(geometry,slack=0){
  const points=[],lineTotal=geometry.spans.reduce((sum,p)=>sum+p.length,0);
  geometry.spans.forEach((span,i)=>{
    const sag=Math.min(85,Math.sqrt(Math.max(0,slack)*span.length/Math.max(1,lineTotal)*span.length*.375));
    const bend={x:-span.t.y,y:span.t.x};if(bend.y<0||(Math.abs(bend.y)<.01&&bend.x<0)){bend.x*=-1;bend.y*=-1;}
    points.push(span.from);for(let j=1;j<=18;j++){const t=j/18,offset=16*sag*t*t*(1-t)*(1-t);points.push({x:span.from.x+(span.to.x-span.from.x)*t+bend.x*offset,y:span.from.y+(span.to.y-span.from.y)*t+bend.y*offset});}
    const arc=geometry.arcs[i];if(arc){const count=Math.max(1,Math.ceil(Math.abs(arc.delta)/.035));for(let j=1;j<=count;j++){const a=arc.start+arc.delta*j/count;points.push({x:arc.x+Math.cos(a)*arc.radius,y:arc.y+Math.sin(a)*arc.radius});}}
  });return points;
}
const effectiveMass=terms=>terms.reduce((sum,{body,g,angular})=>sum+body.invMass*dot(g,g)+body.invI*angular*angular,0);
function routeUsable(connection,geometry){
  const sweeps=geometry.arcs.map(arc=>arc.delta);
  if(geometry.valid&&connection.arcSweeps?.some((angle,i)=>Math.abs(angle-sweeps[i])>Math.PI))connection.routeCrossed=true;
  connection.blocked=!geometry.valid;
  if(!connection.blocked)connection.arcSweeps=sweeps;
  return !connection.blocked;
}
export function prepareRopes(world,dt){return world.connections.filter(c=>c.kind==='rope').map(connection=>{const geometry=ropeGeometry(world.bodies,connection);connection.tension=0;const usable=routeUsable(connection,geometry);return{connection,geometry,k:usable?effectiveMass(geometry.terms):0,lambda:0,allowed:Math.max(0,(connection.length-geometry.length)/dt)};});}
export function solveRopeVelocity(ropes){
  for(const rope of ropes){if(rope.k<1e-9)continue;const speed=rope.geometry.terms.reduce((sum,{body,g,angular})=>sum+body.vx*g.x+body.vy*g.y+body.omega*angular,0),before=rope.lambda;
    rope.lambda=Math.max(0,before+(speed-rope.allowed)/rope.k);const amount=rope.lambda-before;
    for(const {body,g,angular} of rope.geometry.terms){body.vx-=amount*g.x*body.invMass;body.vy-=amount*g.y*body.invMass;body.omega-=amount*angular*body.invI;}
  }
}
export function solveRopePosition(world){
  for(const c of world.connections){if(c.kind!=='rope')continue;const geometry=ropeGeometry(world.bodies,c),k=effectiveMass(geometry.terms);if(!routeUsable(c,geometry)||k<1e-9)continue;const error=Math.max(0,geometry.length-c.length-.015),correction=(c.routeCrossed?error*(error>.1?.99:.8):Math.min(30,error)*.8)/k;
    for(const {body,g,angular} of geometry.terms){body.x-=correction*g.x*body.invMass;body.y-=correction*g.y*body.invMass;body.angle-=Math.max(-.08,Math.min(.08,correction*angular*body.invI));}
  }
}
export function finishRopes(ropes,dt){
  for(const {connection,geometry,lambda} of ropes){
    connection.tension=connection.blocked?0:lambda/dt;if(connection.blocked||geometry.length<connection.length-.1)continue;
    const first=geometry.terms[0].body,arm=sub(geometry.spans[0].from,first);let flow=(first.vx-first.omega*arm.y)*geometry.spans[0].t.x+(first.vy+first.omega*arm.x)*geometry.spans[0].t.y;
    geometry.arcs.forEach((arc,i)=>{const pulley=geometry.terms.find(t=>t.body.id===arc.id).body,incoming=geometry.spans[i].t,outgoing=geometry.spans[i+1].t,relative=flow-pulley.vx*incoming.x-pulley.vy*incoming.y;
      pulley.sheaveAngle=(pulley.sheaveAngle??0)+relative/arc.radius*connection.wrap[i]*dt;
      flow+=pulley.vx*(outgoing.x-incoming.x)+pulley.vy*(outgoing.y-incoming.y);
    });
  }
}
export function attachmentPoints(body){
  const local=body.kind==='anchor'?[[0,0]]:[[0,0],[0,-body.h/2],[body.w/2,0],[0,body.h/2],[-body.w/2,0]];
  return local.map(([x,y])=>({local:{x,y},...worldPoint(body,x,y)}));
}
export function nearestAttachment(body,point){return attachmentPoints(body).reduce((best,p)=>Math.hypot(p.x-point.x,p.y-point.y)<Math.hypot(best.x-point.x,best.y-point.y)?p:best).local;}
