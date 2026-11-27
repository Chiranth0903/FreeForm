/* One conversation turn: speak, listen, collect a complete answer, then deliver once. */
(() => {
  class FormTalkVoiceSession {
    constructor({Recognition, synthesis, Utterance, onText, onStatus, onFatal,
      setTimer=(fn,ms)=>globalThis.setTimeout(fn,ms), clearTimer=id=>globalThis.clearTimeout(id)}) {
      Object.assign(this,{Recognition,synthesis,Utterance,onText,onStatus,onFatal,setTimer,clearTimer});
      this.epoch=0; this.active=false; this.rec=null; this.timers=new Set();
    }
    later(fn,ms) {const id=this.setTimer(()=>{this.timers.delete(id);fn();},ms);this.timers.add(id);return id;}
    stop() {
      this.active=false;this.epoch++;
      for(const timer of this.timers)this.clearTimer(timer);this.timers.clear();
      const rec=this.rec;this.rec=null;if(rec){rec.onend=null;rec.onresult=null;rec.onerror=null;try{rec.abort();}catch{}}
      this.synthesis?.cancel();
    }
    turn(prompt,{language='en-IN',speak=true,confirmation=false}={}) {
      this.stop();this.active=true;this.language=language;this.text='';this.failures=0;
      this.confirmation=confirmation;
      const epoch=this.epoch;const valid=()=>this.active && epoch===this.epoch;
      let began=false;
      const begin=()=>{if(!valid()||began)return;began=true;this.listen(epoch);};
      if(speak && this.synthesis && this.Utterance) {
        this.onStatus('Speaking — please wait…');
        const utterance=new this.Utterance(prompt);utterance.lang=language;
        utterance.onend=()=>this.later(begin,300);
        utterance.onerror=()=>this.later(begin,300);
        // Recover if a speech engine fails to report completion, without listening over speech.
        const watchdog=()=>{
          if(!valid()||began)return;
          // A stuck speech engine must not block the microphone forever.
          this.synthesis.cancel();this.onStatus('Voice playback stalled. Listening for your answer instead.');begin();
        };
        this.later(watchdog,Math.max(12000,prompt.length*110));
        try{this.synthesis.resume?.();this.synthesis.speak(utterance);}catch{begin();}
      } else begin();
    }
    listen(epoch) {
      if(!this.active || epoch!==this.epoch)return;
      if(!this.Recognition){this.fatal('Speech recognition is unavailable. Open this page in Chrome.');return;}
      const rec=new this.Recognition();this.rec=rec;
      rec.lang=this.language;rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
      let sessionText='',settle=null,ended=false;
      const valid=()=>this.active && epoch===this.epoch && this.rec===rec;
      const cancelSettle=()=>{if(settle){this.clearTimer(settle);this.timers.delete(settle);settle=null;}};
      const deliver=()=>{
        if(!valid() || !sessionText.trim())return;
        const text=sessionText.trim();this.stop();this.onText(text);
      };
      rec.onresult=event=>{
        if(!valid())return;
        // Results are a cumulative list; rebuilding avoids duplicated or lost words.
        sessionText=Array.from(event.results,r=>r[0].transcript).join(' ').replace(/\s+/g,' ').trim();
        this.onStatus('Hearing: '+sessionText);this.failures=0;cancelSettle();
        if(this.confirmation) {
          const tokens=sessionText.toLowerCase().replace(/[^a-z ]/g,' ').trim().split(/\s+/);
          const first=tokens[0];
          if(['yes','yeah','yep','yup','confirm','confirmed','correct','apply','okay','ok','no','nope','nah','retry','incorrect','cancel'].includes(first)) {
            sessionText=['no','nope','nah','retry','incorrect','cancel'].includes(first)?'no':'yes';
            deliver();return;
          }
        }
        const last=event.results[event.results.length-1];
        settle=this.later(deliver,last?.isFinal?1400:2200);
      };
      rec.onerror=event=>{
        if(!valid())return;
        if(['not-allowed','service-not-allowed','audio-capture','language-not-supported'].includes(event.error)) {
          this.fatal(event.error==='not-allowed'?'Microphone permission was denied. Allow the microphone for this website, then click Start.':`Speech unavailable: ${event.error}. Check your microphone and Chrome settings.`);return;
        }
        if(event.error==='network') {
          this.failures++;
          if(this.failures>=3){this.fatal('Speech service could not connect. Check your internet connection, then click Start.');return;}
          this.onStatus('Speech connection interrupted — reconnecting…');
        }
      };
      rec.onend=()=>{
        if(!valid()||ended)return;ended=true;
        if(sessionText.trim()) {cancelSettle();settle=this.later(deliver,1400);}
        else {this.onStatus('Still listening — take your time.');this.later(()=>{if(valid())this.listen(epoch);},this.failures?1500:350);}
      };
      this.onStatus('Listening — speak your answer.');
      try{rec.start();}catch(error){this.fatal('Could not start the microphone: '+error.message);}
    }
    fatal(message) {this.stop();this.onFatal(message);}
  }
  globalThis.FormTalkVoiceSession=FormTalkVoiceSession;
  if(typeof module!=='undefined' && module.exports)module.exports=FormTalkVoiceSession;
})();
