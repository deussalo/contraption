import {PARTS,clamp,designPart} from './model.js';
import {localPoint,worldPoint,setMass,pointInside,connectionPoints} from './physics.js';
import {selectionHandles} from './draw.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),angle=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x),mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
export class Gestures{
  constructor(canvas,workshop,view){this.canvas=canvas;this.workshop=workshop;this.view=view;this.pointers=new Map();this.drag=null;this.ghost=null;this.region=null;this.connection=null;this.pendingGoal=null;this.tool='select';this.stock=null;this.invalid=false;
    canvas.addEventListener('pointerdown',e=>this.down(e));canvas.addEventListener('pointermove',e=>this.move(e));canvas.addEventListener('pointerup',e=>this.up(e));canvas.addEventListener('pointercancel',e=>this.up(e,true));
    canvas.addEventListener('wheel',e=>{e.preventDefault();view.zoomAt(e.deltaY>0?.9:1.1,e.clientX,e.clientY);},{passive:false});
  }
  point(e){return {...this.view.toWorld(e.clientX,e.clientY),sx:e.clientX,sy:e.clientY};}
  snapped(n){return this.view.snap?Math.round(n/10)*10:n;}
  hit(point){return [...this.workshop.world.bodies].reverse().find(b=>b.state!=='popped'&&pointInside(b,point.x,point.y,5/this.view.camera.scale));}
  setTool(tool,stock=null){this.cancel();this.tool=tool;this.stock=stock;this.canvas.style.cursor=tool==='pan'?'grab':tool==='select'?'default':'crosshair';this.view.sync();}
  clear(){this.pointers.clear();this.drag=null;this.ghost=null;this.region=null;this.invalid=false;}
  cancel(){if(this.drag?.body){const body=this.drag.body;Object.assign(body,this.drag.original);setMass(body);const base=this.workshop.level.bodies.find(p=>p.id===body.id);if(base)Object.assign(base,designPart(body));}this.clear();this.connection=null;this.workshop.changed=true;}
  down(e){
    if(e.button!==0&&e.button!==1)return;e.preventDefault();this.canvas.focus();this.canvas.setPointerCapture(e.pointerId);const point=this.point(e);this.pointers.set(e.pointerId,point);
    if(this.pointers.size===2){this.beginTransform();return;}if(this.pointers.size>2)return;
    if(this.tool==='pan'||e.button===1){this.drag={mode:'pan',start:point,camera:{...this.view.camera},screen:{x:e.clientX,y:e.clientY}};return;}
    if(['rope','belt','wire'].includes(this.tool)){this.connect(point);return;}
    if(this.tool==='goal'){this.drag={mode:'goal',start:point};this.region={x:point.x,y:point.y,w:1,h:1};return;}
    if(this.tool!=='select'){
      try{const ghost=this.workshop.newPart(this.tool,this.snapped(point.x),this.snapped(point.y),{},this.stock);this.ghost=ghost;this.drag={mode:['box','circle'].includes(this.tool)?'draw':'stamp',start:point,before:this.workshop.capture()};}catch(error){this.view.toast(error.message);this.pointers.delete(e.pointerId);}return;
    }
    const selected=this.workshop.body();let handle=null;
    if(selected&&this.workshop.editable(selected)){const handles=selectionHandles(selected,this.view.camera.scale);if(distance(point,handles.rotate)<14/this.view.camera.scale)handle='rotate';else if(handles.corners.some(p=>distance(point,p)<13/this.view.camera.scale))handle='scale';}
    const b=handle?selected:this.hit(point);this.workshop.selected=b?.id??null;this.workshop.changed=true;
    if(!b){for(const joint of this.workshop.world.connections){const points=connectionPoints(this.workshop.world,joint);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);if(distance(point,{x:a.x+t*dx,y:a.y+t*dy})<8/this.view.camera.scale){this.workshop.selected=joint.id;break;}}}return;}
    if(!this.workshop.editable(b)){this.view.toast('Locked');return;}
    const before=this.workshop.capture();this.drag={mode:handle??'move',body:b,before,original:structuredClone(b),start:point,offset:{x:point.x-b.x,y:point.y-b.y},moved:false,base:{x:b.x,y:b.y,w:b.w,h:b.h,angle:b.angle}};
    b.held=true;setMass(b);this.workshop.world.cachedContacts=[];
  }
  beginTransform(){
    const points=[...this.pointers.values()];
    if(this.drag?.body){const b=this.drag.body;this.drag.mode='transform';this.drag.gesture={center:mid(...points),distance:Math.max(5,distance(...points)),angle:angle(...points),body:{x:b.x,y:b.y,w:b.w,h:b.h,angle:b.angle}};}
    else{this.ghost=null;this.region=null;const screen=points.map(p=>({x:p.sx,y:p.sy}));this.drag={mode:'pinch',anchor:mid(...points),distance:Math.max(5,distance(...screen)),camera:{...this.view.camera}};}
  }
  move(e){
    const point=this.point(e);this.lastPoint=point;if(this.connection)this.view.syncConnection();if(!this.pointers.has(e.pointerId))return;this.pointers.set(e.pointerId,point);if(!this.drag)return;
    const d=this.drag,b=d.body;
    if(d.mode==='pan'){this.view.camera.x=d.camera.x+e.clientX-d.screen.x;this.view.camera.y=d.camera.y+e.clientY-d.screen.y;return;}
    if(d.mode==='pinch'){const points=[...this.pointers.values()];if(points.length<2)return;const screen=points.map(p=>({x:p.sx,y:p.sy})),scale=clamp(d.camera.scale*distance(...screen)/d.distance,.12,3),center=mid(...screen);this.view.camera.scale=scale;this.view.camera.x=center.x-d.anchor.x*scale;this.view.camera.y=center.y-d.anchor.y*scale;return;}
    if(d.mode==='goal'||d.mode==='draw'){const w=Math.max(12,Math.abs(point.x-d.start.x)),h=Math.max(12,Math.abs(point.y-d.start.y)),shape={x:this.snapped((point.x+d.start.x)/2),y:this.snapped((point.y+d.start.y)/2),w:clamp(this.snapped(w),12,1200),h:clamp(this.snapped(h),12,1200)};
      if(d.mode==='goal')this.region=shape;else{if(PARTS[this.ghost.kind].shape==='circle')shape.h=shape.w=Math.max(shape.w,shape.h);Object.assign(this.ghost,shape);setMass(this.ghost);this.invalid=!this.workshop.canPlace(this.ghost);}return;}
    if(d.mode==='stamp'){Object.assign(this.ghost,{x:this.snapped(point.x),y:this.snapped(point.y)});this.invalid=!this.workshop.canPlace(this.ghost);return;}
    if(!b)return;
    let change={};
    if(d.mode==='transform'){
      const points=[...this.pointers.values()];if(points.length<2)return;const g=d.gesture,center=mid(...points),ratio=clamp(distance(...points)/g.distance,.1,10),rotation=angle(...points)-g.angle,dx=g.body.x-g.center.x,dy=g.body.y-g.center.y;
      change={x:center.x+(dx*Math.cos(rotation)-dy*Math.sin(rotation))*ratio,y:center.y+(dx*Math.sin(rotation)+dy*Math.cos(rotation))*ratio,w:clamp(g.body.w*ratio,12,1200),h:clamp(g.body.h*ratio,12,1200),angle:g.body.angle+rotation};
    }else if(d.mode==='rotate'){const a=angle(b,point)-angle(d.base,d.start);change.angle=d.base.angle+a;if(e.shiftKey)change.angle=Math.round(change.angle/(Math.PI/12))*Math.PI/12;}
    else if(d.mode==='scale'){const local=localPoint({...b,angle:d.base.angle},point.x,point.y);change={w:clamp(Math.abs(local.x)*2,12,1200),h:clamp(Math.abs(local.y)*2,12,1200)};if(PARTS[b.kind].shape==='circle'||e.shiftKey){const ratio=Math.max(change.w/d.base.w,change.h/d.base.h);change.w=clamp(d.base.w*ratio,12,1200);change.h=clamp(d.base.h*ratio,12,1200);}}
    else change={x:this.snapped(point.x-d.offset.x),y:this.snapped(point.y-d.offset.y)};
    this.workshop.move(b,change);d.moved=true;this.invalid=!this.workshop.canPlace(b);
  }
  up(e,cancelled=false){
    if(!this.pointers.has(e.pointerId))return;this.pointers.delete(e.pointerId);
    if(this.pointers.size&&this.drag?.body){const point=[...this.pointers.values()][0],b=this.drag.body;this.drag.mode='move';this.drag.start=point;this.drag.offset={x:point.x-b.x,y:point.y-b.y};this.drag.base={x:b.x,y:b.y,w:b.w,h:b.h,angle:b.angle};return;}
    if(this.pointers.size)return;const d=this.drag;if(!d){this.view.sync();return;}
    if(d.body){const b=d.body;if(!cancelled&&d.moved&&this.view.inBin(e.clientX,e.clientY)){this.workshop.removeBody(b.id);this.workshop.record(d.before);}else if(cancelled||!this.workshop.canPlace(b)){Object.assign(b,d.original);this.workshop.move(b,designPart(d.original));if(!cancelled&&d.moved)this.view.toast('Objects cannot overlap.');}else if(d.moved)this.workshop.record(d.before);b.held=false;setMass(b);}
    else if(this.ghost&&!cancelled){if(this.workshop.canPlace(this.ghost)){this.workshop.insert(this.ghost);this.workshop.record(d.before);}else this.view.toast('Objects cannot overlap.');}
    else if(d.mode==='goal'&&this.region&&!cancelled){this.workshop.setGoal({...this.pendingGoal,...this.region,w:Math.max(20,this.region.w),h:Math.max(20,this.region.h)});this.tool='select';}
    this.clear();this.workshop.changed=true;this.view.sync();
  }
  connect(point){
    const b=this.hit(point);if(!b)return;
    if(!this.connection){if(this.tool==='wire'&&b.kind!=='switch'){this.view.toast('Start a wire at a switch.');return;}const a=localPoint(b,point.x,point.y);this.connection={kind:this.tool,a:b.id,ax:a.x,ay:a.y,via:[]};this.view.syncConnection();return;}
    const c=this.connection;if(b.kind==='pulley'&&c.kind==='rope'&&b.id!==c.a&&!c.via.includes(b.id)){c.via.push(b.id);this.view.syncConnection();return;}
    const anchor=localPoint(b,point.x,point.y);try{this.workshop.addConnection(c.kind,c.a,b.id,{ax:c.ax,ay:c.ay,bx:anchor.x,by:anchor.y},c.via);this.connection=null;this.view.sync();}catch(error){this.view.toast(error.message);}
  }
  previewConnection(){if(!this.connection)return null;const c=this.connection,a=this.workshop.world.bodies.find(b=>b.id===c.a);if(!a)return null;return{kind:c.kind,points:[worldPoint(a,c.ax,c.ay),...c.via.map(id=>this.workshop.world.bodies.find(b=>b.id===id)),this.lastPoint??a]};}
}
