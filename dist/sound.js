export class WorkshopSound {
  constructor(){this.audio=null;this.enabled=true;this.lastFan=0;}
  async unlock(){
    const Audio=globalThis.AudioContext??globalThis.webkitAudioContext;
    if(!Audio)throw new Error('This browser does not support sound synthesis.');
    this.audio??=new Audio();
    if(this.audio.state==='suspended')await this.audio.resume();
  }
  tone(frequency,duration,type='sine',volume=.08,endFrequency=frequency,delay=0){
    if(!this.enabled||!this.audio||this.audio.state!=='running')return;
    const a=this.audio,t=a.currentTime+delay,osc=a.createOscillator(),gain=a.createGain();
    osc.type=type;osc.frequency.setValueAtTime(frequency,t);osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),t+duration);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(volume,t+.005);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);
    osc.connect(gain);gain.connect(a.destination);osc.start(t);osc.stop(t+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
  }
  play(event){
    const {kind,strength}=event;const v=Math.min(.11,.02+strength/3500);
    if(kind==='bell'){
      for(const [frequency,level] of [[784,.16],[1568,.055],[2180,.025]])this.tone(frequency,1.6,'sine',level);
      [1047,1319,1568].forEach((f,i)=>this.tone(f,.35,'sine',.04,f,.17+i*.1));
    }else if(kind==='trampoline')this.tone(130,.4,'sine',.1,780);
    else if(kind==='bumper')this.tone(680,.28,'triangle',.06,240);
    else if(kind==='fan'){
      if(!this.enabled||!this.audio||this.audio.currentTime-this.lastFan<.5)return;
      this.lastFan=this.audio.currentTime;this.tone(70,.5,'triangle',.013,85);
    }else{
      const pitches={marble:950,domino:360,ramp:220,platform:180,seesaw:280,funnel:640,floor:140};
      const f=pitches[kind]??260;this.tone(f,.09,kind==='funnel'?'sine':'triangle',v,f*.55);
    }
  }
}
