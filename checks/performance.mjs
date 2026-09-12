import assert from 'node:assert/strict';
import {createWorld,stepWorld} from '../dist/physics.js';
import {audibleEvents,WorkshopSound} from '../dist/sound.js';

const body=(id,kind,x,y,w,h,fixed=false)=>({id,kind,x,y,w,h,angle:0,material:kind==='circle'?'rubber':'wood',fixed,pinned:false,locked:false,power:1,direction:1,on:true});
const spheres=Array.from({length:100},(_,i)=>body(`sphere-${i}`,'circle',280+i%10*24,40+Math.floor(i/10)*24,20,20));
const container=[body('container-floor','ramp',388,620,440,20,true),body('container-left','ramp',178,400,20,460,true),body('container-right','ramp',598,400,20,460,true)];
const world=createWorld({environment:{width:800,height:700,gravity:850,pressure:1,floor:false},bodies:[...spheres,...container],connections:[],goal:null});
const ticks=360,started=performance.now();
for(let tick=0;tick<ticks;tick++)stepWorld(world);
const elapsed=performance.now()-started,stepsPerSecond=ticks*1000/elapsed;
assert.ok(stepsPerSecond>=120,`100-sphere container ran at ${stepsPerSecond.toFixed(1)} physics steps/s; expected at least 120`);
const feedback=audibleEvents(Array.from({length:1000},(_,i)=>({kind:i%2?'rubber':'steel',x:i%10*160,strength:i})));assert.ok(feedback.length<=6,'Dense impacts must produce bounded sound and particle feedback');
const parameter=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}}),node=()=>({connect(){},disconnect(){}}),audio={state:'running',currentTime:0,createOscillator(){return{...node(),frequency:parameter(),start(){},stop(){}};},createGain(){return{...node(),gain:parameter()};},createStereoPanner(){return{...node(),pan:parameter()};}};
const sound=new WorkshopSound();sound.audio=audio;sound.master=node();for(let i=0;i<10;i++)sound.play(feedback);assert.equal(sound.voices,20,'Web Audio voices must remain capped during dense impacts');
console.log(`PASS 100-sphere container at ${stepsPerSecond.toFixed(1)} physics steps/s with ${feedback.length} feedback events and ${sound.voices} audio voices maximum`);
