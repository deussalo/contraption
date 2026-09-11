import {PARTS,MATERIALS} from './model.js';
import {worldPoint,connectionPoints} from './physics.js';
const ink='#414c3c',paper='#faf9eb';
function line(c,points){c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();}
function rect(c,x,y,w,h,fill,r=2){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();c.stroke();}
function circle(c,x,y,r,fill){c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();c.stroke();}
export function drawBody(c,b,time=0){
  if(b.state==='popped')return;const {w,h}=b,material=MATERIALS[b.material],color=material.color;
  c.save();c.translate(b.x,b.y);c.rotate(b.angle);c.strokeStyle=ink;c.lineWidth=2.1;c.lineJoin='round';c.lineCap='round';
  if(['circle','bowling','basketball','balloon'].includes(b.kind)){
    circle(c,0,0,w/2,color);c.save();c.beginPath();c.arc(0,0,w/2-1,0,Math.PI*2);c.clip();
    if(b.kind==='basketball'){c.lineWidth=1.8;line(c,[[-w/2,0],[w/2,0]]);line(c,[[0,-w/2],[0,w/2]]);for(const sign of [-1,1]){c.beginPath();c.ellipse(sign*w*.6,0,w*.43,w*.55,0,0,Math.PI*2);c.stroke();}}
    else if(b.kind==='bowling'){for(const [x,y] of [[-4,-9],[7,-6],[0,5]])circle(c,x,y,w*.045,'#3e514e');}
    else if(b.kind==='circle'){c.strokeStyle='#fff1d2';c.lineWidth=5;c.beginPath();c.moveTo(-w*.5,w*.23);c.bezierCurveTo(w*.25,w*.55,-w*.3,-w*.6,w*.5,-w*.23);c.stroke();}
    c.fillStyle='#ffffeb90';c.beginPath();c.ellipse(-w*.16,-w*.19,w*.11,w*.065,-.6,0,7);c.fill();c.restore();
    if(b.kind==='balloon'){line(c,[[-4,h/2+7],[0,h/2],[4,h/2+7],[-4,h/2+7]]);c.strokeStyle='#8b9482';c.lineWidth=1;c.beginPath();c.moveTo(0,h/2+7);c.bezierCurveTo(-10,h/2+19,8,h/2+30,0,h/2+45);c.stroke();}
  }else if(['box','ramp','conveyor'].includes(b.kind)){
    rect(c,-w/2,-h/2,w,h,color,Math.min(3,h/6));c.lineWidth=1;c.strokeStyle='#75664e55';
    if(b.material==='wood'||b.material==='cork'){for(let y=-h/2+7;y<h/2-3;y+=12)for(let x=-w/2+9;x<w/2-15;x+=45)line(c,[[x,y],[x+25,y+1]]);}
    if(b.kind==='ramp'){c.strokeStyle=ink;for(const x of [-w/2+7,w/2-7])circle(c,x,0,1.5,'#81755e');}
    if(b.kind==='conveyor'){c.strokeStyle=ink;c.lineWidth=1.5;rect(c,-w/2,-h/2,w,h,'#9fae9b',h/2);const phase=b.active?time*b.power*b.direction*90:0;for(let x=-w/2+9;x<w/2-6;x+=18){const px=-w/2+((x+w/2+phase)%(w-8)+w-8)%(w-8);line(c,[[px,-h/2+4],[px,h/2-4]]);}circle(c,-w/2+h/2,0,h*.24,'#d9dfc5');circle(c,w/2-h/2,0,h*.24,'#d9dfc5');}
  }else if(b.kind==='bucket'){
    rect(c,-w/2,-h/2,10,h,color,2);rect(c,w/2-10,-h/2,10,h,color,2);rect(c,-w/2,h/2-10,w,10,color,2);
    c.strokeStyle='#93a58b';c.lineWidth=1;line(c,[[-w/2+18,h/2-20],[w/2-18,h/2-20]]);
  }else if(b.kind==='trampoline'){
    rect(c,-w/2,-h/2,w,h,'#b6a0c5',h/3);for(const x of [-w/2+17,w/2-17])line(c,[[x,h/2],[x-7,h/2+6],[x+7,h/2+12],[x-7,h/2+18],[x,h/2+24]]);rect(c,-w/2+4,h/2+24,w-8,6,'#b3a985');
  }else if(b.kind==='fan'){
    rect(c,-w/2,-h/2,w,h,'#abc2b5',8);circle(c,0,0,Math.min(w,h)*.39,paper);c.save();if(b.active)c.rotate(time*b.power*10);
    for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-w*.36,-w*.1,-w*.14,-w*.42,0,-w*.29);c.bezierCurveTo(w*.12,-w*.16,w*.08,-w*.05,0,0);c.fillStyle='#89aa99';c.fill();c.stroke();}c.restore();circle(c,0,0,w*.07,'#e7c56d');
    if(b.active){c.strokeStyle='#96aa87';c.lineWidth=1.2;for(let i=0;i<3;i++){const phase=(time*65+i*15)%60;line(c,[[w/2+10+phase,(i-1)*15],[w/2+30+phase,(i-1)*15]]);}}
  }else if(b.kind==='pulley'||b.kind==='motor'){
    circle(c,0,0,w/2,b.kind==='motor'?'#d6b75f':'#b2bba1');circle(c,0,0,w/2-6,paper);for(let i=0;i<6;i++){const a=i*Math.PI/3;line(c,[[Math.cos(a)*7,Math.sin(a)*7],[Math.cos(a)*(w/2-9),Math.sin(a)*(w/2-9)]]);}circle(c,0,0,7,'#b29d73');if(b.kind==='motor'){c.fillStyle=ink;c.font='bold 10px sans-serif';c.fillText('M',-4,4);}
  }else if(b.kind==='switch'){
    rect(c,-w/2,-h/2,w,h,'#98a893',3);rect(c,-w/2+6,-h/2-4,w-12,h/2+2,b.state==='on'?'#86b87a':'#d38a75',4);
  }else if(b.kind==='rocket'){
    c.beginPath();c.moveTo(-w/2,h/2);c.lineTo(-w/2,-h*.2);c.quadraticCurveTo(-w/2,-h*.42,0,-h/2);c.quadraticCurveTo(w/2,-h*.42,w/2,-h*.2);c.lineTo(w/2,h/2);c.closePath();c.fillStyle='#dadbd0';c.fill();c.stroke();circle(c,0,-h*.07,w*.23,'#95b4b7');rect(c,-w/2,h*.24,w,h*.15,'#cd8d74');if(b.state==='fired'){c.fillStyle='#e8c46e';c.beginPath();c.moveTo(-w*.35,h/2);c.lineTo(0,h/2+22+Math.sin(time*65)*8);c.lineTo(w*.35,h/2);c.fill();}
  }else if(b.kind==='bell'){
    circle(c,0,h*.3,5,'#c49f52');c.beginPath();c.moveTo(-w*.42,h*.24);c.quadraticCurveTo(-w*.25,h*.07,-w*.25,-h*.15);c.bezierCurveTo(-w*.25,-h*.5,w*.25,-h*.5,w*.25,-h*.15);c.quadraticCurveTo(w*.25,h*.07,w*.42,h*.24);c.closePath();c.fillStyle=b.state==='rung'?'#f0d780':'#dbb95e';c.fill();c.stroke();rect(c,-w*.44,h*.22,w*.88,5,'#ead083');
  }
  if(b.pinned){c.strokeStyle=ink;c.lineWidth=1.2;circle(c,0,0,3.2,paper);}
  c.restore();
}
export function drawConnection(c,world,joint,selected=false){
  const points=connectionPoints(world,joint);if(points.length<2)return;c.save();c.strokeStyle=selected?'#cf8274':joint.kind==='wire'?'#ad9cb9':joint.kind==='belt'?'#70867a':'#b29262';c.lineWidth=joint.kind==='belt'?5:2.5;c.lineCap='round';c.lineJoin='round';
  if(joint.kind==='wire')c.setLineDash([5,4]);
  if(joint.kind==='belt'){const a=points[0],b=points.at(-1),angle=Math.atan2(b.y-a.y,b.x-a.x),length=Math.hypot(b.x-a.x,b.y-a.y),radius=18;c.translate(a.x,a.y);c.rotate(angle);c.beginPath();c.moveTo(0,-radius);c.lineTo(length,-radius);c.arc(length,0,radius,-Math.PI/2,Math.PI/2);c.lineTo(0,radius);c.arc(0,0,radius,Math.PI/2,Math.PI*1.5);c.stroke();}
  else{line(c,points.map(p=>[p.x,p.y]));for(const p of [points[0],points.at(-1)])circle(c,p.x,p.y,3,paper);}
  c.restore();
}
export function drawScene(c,world,camera,viewport,options={}){
  c.setTransform(viewport.dpr,0,0,viewport.dpr,0,0);c.fillStyle='#f5f5ec';c.fillRect(0,0,viewport.w,viewport.h);
  const spacing=24*camera.scale*2**Math.max(0,Math.ceil(Math.log2(14/(24*camera.scale))));c.fillStyle='#c9d2bd';for(let x=camera.x%spacing;x<viewport.w;x+=spacing)for(let y=camera.y%spacing;y<viewport.h;y+=spacing){c.beginPath();c.arc(x,y,.65,0,7);c.fill();}
  c.save();c.translate(camera.x,camera.y);c.scale(camera.scale,camera.scale);
  if(world.environment.floor){const y=world.environment.height-60;c.strokeStyle='#b6c3a8';c.lineWidth=1;line(c,[[0,y],[world.environment.width,y]]);c.fillStyle='#dbe1cc35';c.fillRect(0,y,world.environment.width,40);for(let x=6;x<world.environment.width;x+=16)line(c,[[x,y],[x-8,y+9]]);}
  if(world.goal?.kind==='region'){const g=world.goal;c.fillStyle=world.won?'#8caf7930':'#9eb58c17';c.strokeStyle=world.won?'#7c9f66':'#9aaf83';c.lineWidth=1.5;c.setLineDash([7,6]);c.fillRect(g.x-g.w/2,g.y-g.h/2,g.w,g.h);c.strokeRect(g.x-g.w/2,g.y-g.h/2,g.w,g.h);c.setLineDash([]);c.fillStyle='#849971';c.font='12px DM Sans,sans-serif';c.fillText('◎',g.x-g.w/2+9,g.y-g.h/2+18);}
  for(const joint of world.connections)drawConnection(c,world,joint,options.selected===joint.id);
  for(const b of world.bodies){drawBody(c,b,world.time);if(b.locked&&options.puzzle){c.save();c.translate(b.x,b.y);c.rotate(b.angle);c.strokeStyle='#6e7b634c';c.lineWidth=1.1;rect(c,b.w/2-12,-b.h/2+5,7,6,'#f5f5ec66',1);c.beginPath();c.arc(b.w/2-8.5,-b.h/2+5,2.3,Math.PI,0);c.stroke();c.restore();}}
  const selected=world.bodies.find(b=>b.id===options.selected);
  if(selected){const b=selected,pad=8/camera.scale,handle=4/camera.scale;c.save();c.translate(b.x,b.y);c.rotate(b.angle);c.strokeStyle=options.invalid?'#ce7767':'#6e9464';c.lineWidth=1.2/camera.scale;c.setLineDash([4/camera.scale,3/camera.scale]);c.strokeRect(-b.w/2-pad,-b.h/2-pad,b.w+pad*2,b.h+pad*2);c.setLineDash([]);
    for(const x of [-b.w/2-pad,b.w/2+pad])for(const y of [-b.h/2-pad,b.h/2+pad])rect(c,x-handle,y-handle,handle*2,handle*2,paper,1);
    line(c,[[0,-b.h/2-pad],[0,-b.h/2-32/camera.scale]]);circle(c,0,-b.h/2-32/camera.scale,5/camera.scale,paper);c.restore();
    if(options.invalid){c.strokeStyle='#c57868';c.lineWidth=3/camera.scale;const size=9/camera.scale;line(c,[[b.x-size,b.y-size],[b.x+size,b.y+size]]);line(c,[[b.x-size,b.y+size],[b.x+size,b.y-size]]);}
  }
  if(options.ghost){const b=options.ghost;c.globalAlpha=.55;drawBody(c,b,world.time);c.globalAlpha=1;if(options.invalid){const size=10/camera.scale;c.strokeStyle='#c57868';c.lineWidth=3/camera.scale;line(c,[[b.x-size,b.y-size],[b.x+size,b.y+size]]);line(c,[[b.x-size,b.y+size],[b.x+size,b.y-size]]);}}
  if(options.region){const r=options.region;c.strokeStyle='#8da476';c.setLineDash([6,5]);c.lineWidth=1.5;c.strokeRect(r.x-r.w/2,r.y-r.h/2,r.w,r.h);c.setLineDash([]);}
  if(options.connection){c.strokeStyle=options.connection.kind==='wire'?'#ae9bc1':'#a98e65';c.lineWidth=2;c.setLineDash([5,4]);line(c,options.connection.points.map(p=>[p.x,p.y]));c.setLineDash([]);}
  for(const p of options.particles??[]){c.globalAlpha=Math.max(0,p.life/p.maxLife);c.fillStyle=p.color;c.fillRect(p.x,p.y,p.size,p.size*.55);}c.globalAlpha=1;c.restore();
}
export function selectionHandles(b,scale){const pad=8/scale;return{corners:[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>worldPoint(b,x*(b.w/2+pad),y*(b.h/2+pad))),rotate:worldPoint(b,0,-b.h/2-32/scale)};}
