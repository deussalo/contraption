export class WorkshopSound{
  constructor(){this.audio=null;this.enabled=true;this.volume=.65;this.pressure=1;this.hum=null;}
  async unlock(){const Audio=globalThis.AudioContext??globalThis.webkitAudioContext;if(!Audio)throw Error('Sound is unavailable in this browser.');this.audio??=new Audio();if(this.audio.state==='suspended')await this.audio.resume();}
  tone(frequency,duration,type='sine',volume=.08,end=frequency,x=800){
    if(!this.enabled||!this.audio||this.audio.state!=='running'||this.pressure<=0)return;
    const a=this.audio,t=a.currentTime,osc=a.createOscillator(),gain=a.createGain(),pan=a.createStereoPanner();pan.pan.value=Math.max(-.8,Math.min(.8,(x-800)/1000));
    osc.type=type;osc.frequency.setValueAtTime(frequency,t);osc.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume*this.volume*Math.min(1,this.pressure),t+.003);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(pan);pan.connect(a.destination);osc.start(t);osc.stop(t+duration+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();pan.disconnect();};
  }
  play(e){
    const volume=Math.min(.14,.015+e.strength/5000);
    if(e.kind==='bell'||e.kind==='goal'){for(const [f,v] of [[784,.11],[1568,.035],[2180,.015]])this.tone(f,1.5,'sine',v,f,e.x);}
    else if(e.kind==='trampoline')this.tone(100,.35,'sine',.11,700,e.x);
    else if(e.kind==='steel'){this.tone(720,.2,'sine',volume,450,e.x);this.tone(1640,.13,'sine',volume*.22,1300,e.x);}
    else if(e.kind==='rubber')this.tone(200,.15,'sine',volume,55,e.x);
    else if(e.kind==='pop')this.tone(430,.08,'sawtooth',volume,30,e.x);
    else this.tone(e.kind==='switch'?650:e.kind==='cork'?110:260,.075,'triangle',volume,60,e.x);
  }
  update(world,running){
    this.pressure=world.environment.pressure;
    if(!this.audio)return;const active=running&&this.enabled&&this.pressure>0?world.bodies.filter(b=>(b.kind==='fan'||b.kind==='motor'||b.kind==='rocket')&&b.active).length:0;
    if(active&&!this.hum){const a=this.audio,buffer=a.createBuffer(1,a.sampleRate,a.sampleRate),samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=(Math.random()*2-1)*.25;const source=a.createBufferSource(),filter=a.createBiquadFilter(),gain=a.createGain();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=550;gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(a.destination);source.start();this.hum={source,filter,gain};}
    if(this.hum)this.hum.gain.gain.setTargetAtTime(Math.min(.05,active*.008)*this.volume,this.audio.currentTime,.08);
  }
}
