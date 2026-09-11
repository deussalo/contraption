export const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
export const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y}),mul=(a,n)=>({x:a.x*n,y:a.y*n});
export const norm=v=>{const length=Math.hypot(v.x,v.y);return length>1e-8?mul(v,1/length):{x:1,y:0};};
export const rotate=(x,y,a)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
export const localPoint=(body,x,y)=>rotate(x-body.x,y-body.y,-body.angle);
export const worldPoint=(body,x=0,y=0)=>add(body,rotate(x,y,body.angle));
