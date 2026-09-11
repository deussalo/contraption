import { dimensions, WORLD } from './parts.js';
const ink = '#3c4336', paper = '#f9f7e9';
const colors = ['#9cb8a5', '#e2bc6e', '#bdabc9', '#91b6bd', '#db9780'];
function path(c, points, fill) {
  c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  if (fill) { c.closePath(); c.fillStyle = fill; c.fill(); } c.stroke();
}
function rect(c, x, y, w, h, fill, radius = 3) { c.beginPath(); c.roundRect(x, y, w, h, radius); c.fillStyle = fill; c.fill(); c.stroke(); }
function circle(c, x, y, r, fill) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); c.stroke(); }
export function drawPart(c, p, time = 0, running = false) {
  const { width: w, height: h } = dimensions(p);
  c.save(); c.translate(p.x, p.y); c.rotate(p.angle * Math.PI / 180);
  c.strokeStyle = ink; c.lineWidth = 2.3; c.lineCap = 'round'; c.lineJoin = 'round';
  if (p.type === 'marble') {
    circle(c, 1.5, 2, w / 2, '#b47966'); circle(c, 0, 0, w / 2, '#df967e');
    c.save(); c.beginPath(); c.arc(0, 0, w / 2 - 1, 0, Math.PI * 2); c.clip();
    c.lineWidth = 4; c.strokeStyle = '#f5c9a5'; c.beginPath(); c.moveTo(-15, 9); c.bezierCurveTo(5, 18, -8, -20, 15, -9); c.stroke();
    c.restore(); c.fillStyle = '#fff5d9'; c.beginPath(); c.ellipse(-6, -7, 4.5, 3, -.7, 0, 7); c.fill();
  } else if (p.type === 'ramp' || p.type === 'platform') {
    const fill = p.type === 'ramp' ? '#dca783' : '#a9bd9c';
    path(c, [[-w/2,-h/2],[w/2,-h/2],[w/2+3,h/2+4],[-w/2+2,h/2+4]], fill);
    path(c, [[-w/2+2,h/2],[w/2,h/2]], false);
    c.lineWidth = 1; c.strokeStyle = '#756b5060';
    for (let i = -w/2 + 19; i < w/2 - 10; i += 38) { path(c, [[i,-1],[i+20,0]], false); }
    c.strokeStyle = ink;
    for (const x of [-w/2+8,w/2-8]) { circle(c,x,0,1.4,'#75674d'); }
  } else if (p.type === 'domino') {
    path(c, [[-w/2,-h/2],[w/2,-h/2],[w/2+4,-h/2+4],[w/2+4,h/2],[w/2,h/2+3],[-w/2,h/2]], '#7f8d75');
    rect(c, -w/2, -h/2, w, h, colors[p.colorIndex % 5 || 0], 2);
    path(c,[[-w/2+3,0],[w/2-3,0]],false);
    c.fillStyle=ink; for (const y of [-22,-13,13,22]) { c.beginPath();c.arc(0,y,1.5,0,7);c.fill(); }
  } else if (p.type === 'seesaw') {
    c.save(); c.rotate(-p.angle*Math.PI/180); path(c,[[-23,35],[0,0],[23,35]],'#d4b578'); circle(c,0,4,4,paper); c.restore();
    rect(c,-w/2,-6,w,12,'#a8bdba'); rect(c,-w/2-2,-10,23,6,'#d18d79'); rect(c,w/2-21,-10,23,6,'#d18d79'); circle(c,0,0,3.5,'#f3db9d');
  } else if (p.type === 'trampoline') {
    for (const x of [-w/2+13,w/2-13]) { path(c,[[x,4],[x-6,11],[x+6,16],[x-6,21],[x+6,26],[x,31]],false); }
    rect(c,-w/2+2,30,w-4,7,'#c0a981'); rect(c,-w/2,-6,w,12,'#b7a1c8',6);
    c.strokeStyle='#ece3e8';c.lineWidth=1;path(c,[[-w/2+8,-2],[w/2-8,-2]],false);
  } else if (p.type === 'bumper') {
    circle(c,0,4,w/2,'#ac945f');circle(c,0,0,w/2,'#e5c363');circle(c,0,0,w/2-7,'#f3d98b');
    c.save();c.rotate(Math.PI/8);path(c,[[-12,0],[12,0]],false);path(c,[[0,-12],[0,12]],false);c.restore();
    circle(c,0,0,4,ink);
  } else if (p.type === 'fan') {
    rect(c,-9,10,16,27,'#a8b9a5');rect(c,-26,34,55,8,'#a8b9a5',4);
    circle(c,-1,-8,30,'#a7c0ba');circle(c,-1,-8,24,paper);
    c.save();c.translate(-1,-8);c.rotate(running ? time*12 : .4);
    for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-27,-8,-9,-29,0,-19);c.bezierCurveTo(8,-9,6,-3,0,0);c.fillStyle='#85ada6';c.fill();c.stroke();}
    c.restore();circle(c,-1,-8,5,'#e4bd6a');
    c.strokeStyle='#87a99a';c.lineWidth=1.5;
    for(let i=0;i<3;i++){const dx=running?(time*45+i*19)%45:10;path(c,[[38+dx,-22+i*14],[55+dx,-22+i*14]],false);}
  } else if (p.type === 'funnel') {
    path(c,[[-w/2,-h/2],[w/2,-h/2],[16,18],[16,h/2],[-16,h/2],[-16,18]],'#9fb9c4');
    c.beginPath();c.ellipse(0,-h/2,w/2,8,0,0,7);c.fillStyle='#dbe4db';c.fill();c.stroke();
    c.strokeStyle='#eff0df';path(c,[[-34,-30],[-23,1]],false);
  } else if (p.type === 'bell') {
    rect(c,-w/2+1,31,w-2,10,'#9eaf8b',3);rect(c,-4,-36,8,67,'#97866b',2);
    path(c,[[-25,-28],[0,-35],[25,-28]],false);
    c.save(); c.translate(0,-22); if(p.rung)c.rotate(Math.sin(time*22)*Math.exp(-Math.max(0,time-p.rungAt)*1.5)*.25);
    circle(c,0,28,5,'#b9964f');path(c,[[-24,23],[-19,12],[-17,-3],[-10,-12],[1,-14],[13,-9],[18,0],[19,12],[25,23]],p.rung?'#f5d579':'#e6ba56');
    rect(c,-27,22,54,6,'#f0cb77',3);c.strokeStyle='#f7e3a8';c.lineWidth=3;path(c,[[-10,-3],[-12,10]],false);c.restore();
  }
  c.restore();
}
export function drawGrid(c, width, height, transform) {
  c.fillStyle='#f7f7ed';c.fillRect(0,0,width,height);
  const step=24*transform.scale;c.fillStyle='#cdd3c3';
  for(let x=transform.x%step;x<width;x+=step)for(let y=transform.y%step;y<height;y+=step){c.beginPath();c.arc(x,y,.75,0,7);c.fill();}
}
function label(c, text, x, y, angle=0, size=23, color='#85917c') {
  c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.font=`${size}px Kalam, cursive`;c.fillText(text,0,0);c.restore();
}
function arrow(c, points) {
  c.save();c.strokeStyle='#929d84';c.lineWidth=1.8;c.setLineDash([5,7]);c.beginPath();c.moveTo(...points[0]);c.bezierCurveTo(...points[1],...points[2],...points[3]);c.stroke();c.setLineDash([]);
  const [x,y]=points[3];const [px,py]=points[2];const a=Math.atan2(y-py,x-px);c.translate(x,y);c.rotate(a);path(c,[[-9,-5],[0,0],[-9,5]],false);c.restore();
}
export function drawAnnotations(c, presetName) {
  c.save();c.strokeStyle=ink;c.lineWidth=1.5;
  if(presetName==='The scenic route') {
    label(c,'it starts with a little ball.',185,108,-.04,25);arrow(c,[[208,126],[191,160],[140,131],[143,190]]);
    label(c,'take the long way ↓',404,286,.06,24);arrow(c,[[412,304],[412,336],[364,329],[379,365]]);
    label(c,'wheee!',707,430,-.15,28);arrow(c,[[711,440],[750,457],[683,463],[669,489]]);
    label(c,'the domino effect.',952,517,-.07,23);arrow(c,[[1027,535],[1033,553],[1001,542],[993,579]]);
    label(c,'DING!',1095,548,.07,30,'#b0934c');
    label(c,'room for a plot twist...',180,676,-.05,22);label(c,'✧',450,584,0,28);
    label(c,'1',91,154,-.1,19);label(c,'2',610,348,.1,19);label(c,'3',919,605,-.1,19);
  } else if(presetName==='A spring in its step') {
    label(c,'what goes down...',374,173,-.04,28);arrow(c,[[325,199],[348,278],[323,335],[326,422]]);
    label(c,'...must bounce up!',422,534,-.1,30);label(c,'a little leap of faith',710,336,.03,25);label(c,'DING!',933,449,-.05,30,'#b0934c');
  } else if(presetName==='A lovely little breeze') {
    label(c,'a breath of fresh air',175,340,-.05,29);arrow(c,[[183,357],[178,382],[136,377],[143,403]]);
    label(c,'roll with it →',440,410,.02,25);label(c,'blown away.',881,522,-.08,28);
  }
  c.strokeStyle='#bbc3ae';c.lineWidth=1;path(c,[[90,WORLD.floor+8],[1180,WORLD.floor+8]],false);
  for(let x=100;x<1180;x+=15)path(c,[[x,WORLD.floor+8],[x-7,WORLD.floor+15]],false);
  c.restore();
}
export function drawSelection(c,p){
  const {width,height}=dimensions(p);c.save();c.translate(p.x,p.y);c.rotate(p.angle*Math.PI/180);c.strokeStyle='#52735b';c.lineWidth=1.5;c.setLineDash([5,4]);c.strokeRect(-width/2-10,-height/2-10,width+20,height+20);c.setLineDash([]);
  for(const x of [-width/2-10,width/2+10])for(const y of [-height/2-10,height/2+10])rect(c,x-3,y-3,6,6,paper,1);c.restore();
}
