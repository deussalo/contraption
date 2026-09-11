import { dimensions, WORLD } from './parts.js';
const rad = Math.PI / 180;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function closest(x, y, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy || 1),0,1);
  return { x: ax+t*dx, y: ay+t*dy, t };
}
function segment(p) {
  const { width:w,height:h } = dimensions(p), a=p.angle*rad;
  const vertical=p.type==='domino', length=vertical?h:w;
  const dx=(vertical?-Math.sin(a):Math.cos(a))*length/2;
  const dy=(vertical?Math.cos(a):Math.sin(a))*length/2;
  return {ax:p.x-dx,ay:p.y-dy,bx:p.x+dx,by:p.y+dy,r:vertical?w/2:h/2};
}
function impact(world,p,strength,x,y,kind=p.type){
  if(strength<35 || world.time-(p.lastImpact??-1)<.12)return;
  p.lastImpact=world.time;world.reactions++;world.events.push({kind,strength,x,y,time:world.time});
}
function ring(world,bell){
  if(bell.rung)return;
  bell.rung=true;bell.rungAt=world.time;world.won=true;impact(world,bell,300,bell.x,bell.y,'bell');
}
function hitSegment(world, ball, p, s) {
  const q=closest(ball.x,ball.y,s.ax,s.ay,s.bx,s.by);
  let dx=ball.x-q.x,dy=ball.y-q.y,d=Math.hypot(dx,dy);
  const r=dimensions(ball).width/2+s.r;
  if(d>=r)return;
  if(d<.001){dx=0;dy=-1;d=1;}
  const nx=dx/d,ny=dy/d;
  ball.x+=nx*(r-d);ball.y+=ny*(r-d);
  let vn=ball.vx*nx+ball.vy*ny;
  if(p.type==='seesaw'){
    const rx=q.x-p.x,ry=q.y-p.y,cross=rx*ny-ry*nx;
    vn-=(p.omega??0)*cross;
    if(vn>=0)return;
    const inertia=dimensions(p).width**2/6;
    const impulse=-1.15*vn/(1+cross*cross/inertia);
    ball.vx+=impulse*nx;ball.vy+=impulse*ny;p.omega=clamp((p.omega??0)-impulse*cross/inertia,-4,4);
  }else{
    if(vn>=0)return;
    let impulse=-1.1*vn;
    if(p.type==='trampoline' && nx*Math.sin(p.angle*rad)-ny*Math.cos(p.angle*rad)>.2 && world.time-(ball.lastBounce??-1)>.15){
      impulse=-vn+Math.max(710,-vn*.92);ball.lastBounce=world.time;
    }
    if(p.type==='domino' && Math.abs(p.angle)<75 && Math.abs(ball.vx)>15){
      const direction=Math.sign(ball.vx);p.omega=direction*Math.max(Math.abs(p.omega??0),Math.min(4,Math.abs(ball.vx)/40));
      impulse*=.28;
    }
    ball.vx+=impulse*nx;ball.vy+=impulse*ny;
  }
  impact(world,p,-vn,q.x,q.y);
}
export function anchorBody(body){
  body.initialAngle=body.angle;
  body.pivotX=body.x-Math.sin(body.angle*rad)*dimensions(body).height/2;
  body.pivotY=body.y+Math.cos(body.angle*rad)*dimensions(body).height/2;
  return body;
}
export function createBody(piece){return anchorBody({...structuredClone(piece),vx:0,vy:0,omega:0});}
export function createWorld(parts){return {parts:parts.map(createBody),time:0,reactions:0,events:[],won:false};}
function updateHinges(world,dt){
  const dominoes=world.parts.filter(p=>p.type==='domino');
  for(const p of world.parts){
    if(p.type==='domino'){
      if(Math.abs(p.omega)<.001&&Math.abs(p.angle)<.1)continue;
      const {height:h}=dimensions(p);
      p.omega+=3*850/(2*h)*Math.sin(p.angle*rad)*dt;
      p.angle+=p.omega/rad*dt;
      if(Math.abs(p.angle)>88){p.angle=clamp(p.angle,-88,88);p.omega=0;}
      p.x=p.pivotX+Math.sin(p.angle*rad)*h/2;p.y=p.pivotY-Math.cos(p.angle*rad)*h/2;
    }else if(p.type==='seesaw'){
      p.angle+=p.omega/rad*dt;p.omega*=Math.exp(-1.5*dt);
      if(Math.abs(p.angle-p.initialAngle)>26){p.angle=clamp(p.angle,p.initialAngle-26,p.initialAngle+26);p.omega*=-.25;}
    }
  }
  for(const p of dominoes){
    if(Math.abs(p.omega)<.1)continue;
    const s=segment(p);
    for(const next of dominoes){
      if(next===p||Math.abs(next.angle)>10)continue;
      const t=segment(next),q=closest(s.ax,s.ay,t.ax,t.ay,t.bx,t.by);
      if(Math.hypot(s.ax-q.x,s.ay-q.y)<s.r+t.r+1){
        next.omega=p.omega*.82;next.angle+=Math.sign(p.omega)*.7;impact(world,next,90,q.x,q.y);
      }
    }
    for(const bell of world.parts.filter(b=>b.type==='bell'&&!b.rung)){
      const q=closest(bell.x,bell.y,s.ax,s.ay,s.bx,s.by);
      if(Math.hypot(bell.x-q.x,bell.y-q.y)<32+s.r)ring(world,bell);
    }
  }
}
export function stepWorld(world,dt){
  world.time+=dt;world.events=[];updateHinges(world,dt);
  const balls=world.parts.filter(p=>p.type==='marble'),fixtures=world.parts.filter(p=>p.type!=='marble');
  for(const ball of balls){
    ball.vy+=850*dt;
    for(const fan of fixtures.filter(p=>p.type==='fan')){
      const a=fan.angle*rad,dx=ball.x-fan.x,dy=ball.y-fan.y;
      const along=dx*Math.cos(a)+dy*Math.sin(a),across=-dx*Math.sin(a)+dy*Math.cos(a);
      if(along>0&&along<260&&Math.abs(across)<45+along*.23){
        const power=1500*(1-along/300);ball.vx+=Math.cos(a)*power*dt;ball.vy+=Math.sin(a)*power*dt;
        impact(world,fan,60,ball.x,ball.y,'fan');
      }
    }
    ball.vx=clamp(ball.vx*Math.exp(-.01*dt),-1800,1800);ball.vy=clamp(ball.vy,-1800,1800);
    ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.angle+=ball.vx*dt*2;
    const radius=dimensions(ball).width/2;
    for(const p of fixtures){
      if(['ramp','platform','domino','trampoline','seesaw'].includes(p.type))hitSegment(world,ball,p,segment(p));
      if(p.type==='funnel'){
        const a=p.angle*rad;
        const point=(x,y)=>[p.x+x*Math.cos(a)-y*Math.sin(a),p.y+x*Math.sin(a)+y*Math.cos(a)];
        for(const sign of [-1,1]){
          const a1=point(sign*50,-42),b1=point(sign*19,18),c1=point(sign*19,42);
          hitSegment(world,ball,p,{ax:a1[0],ay:a1[1],bx:b1[0],by:b1[1],r:3});
          hitSegment(world,ball,p,{ax:b1[0],ay:b1[1],bx:c1[0],by:c1[1],r:3});
        }
      }
      if(p.type==='bumper'){
        const dx=ball.x-p.x,dy=ball.y-p.y,d=Math.hypot(dx,dy),r=radius+26;
        if(d<r&&d>.001){
          const nx=dx/d,ny=dy/d,vn=ball.vx*nx+ball.vy*ny;ball.x=p.x+nx*(r+.5);ball.y=p.y+ny*(r+.5);
          if(vn<0){ball.vx+=(-vn+550)*nx;ball.vy+=(-vn+550)*ny;impact(world,p,200,p.x,p.y);}
        }
      }
      if(p.type==='bell'&&Math.hypot(ball.x-p.x,ball.y-p.y)<radius+30)ring(world,p);
    }
    if(ball.y+radius>WORLD.floor){
      ball.y=WORLD.floor-radius;
      if(ball.vy>0){impact(world,ball,ball.vy,ball.x,WORLD.floor,'floor');ball.vy*=-.28;}
      ball.vx*=Math.exp(-1.5*dt);
    }
    if(ball.x-radius<0){ball.x=radius;ball.vx=Math.abs(ball.vx)*.5;}
    if(ball.x+radius>WORLD.width){ball.x=WORLD.width-radius;ball.vx=-Math.abs(ball.vx)*.5;}
  }
  for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
    const a=balls[i],b=balls[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),r=(dimensions(a).width+dimensions(b).width)/2;
    if(d>=r||d<.001)continue;
    const nx=dx/d,ny=dy/d,overlap=(r-d)/2;a.x-=nx*overlap;a.y-=ny*overlap;b.x+=nx*overlap;b.y+=ny*overlap;
    const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if(vn<0){const j=-.85*vn;a.vx-=j*nx;a.vy-=j*ny;b.vx+=j*nx;b.vy+=j*ny;impact(world,a,-vn,a.x,a.y,'marble');}
  }
  return world.events;
}
