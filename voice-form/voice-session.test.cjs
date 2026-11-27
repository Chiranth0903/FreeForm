const {test}=require('node:test');
const assert=require('node:assert/strict');
const Voice=require('./extension/voice-session.js');
function harness() {
  let now=0,id=0;const timers=new Map(),sessions=[],texts=[],statuses=[],fatal=[],spoken=[];
  class Recognition {
    constructor(){sessions.push(this);}
    start(){this.started=true;}
    abort(){this.aborted=true;this.onend?.();}
    result(parts){this.onresult?.({results:parts.map(([text,final])=>Object.assign([{transcript:text}],{isFinal:final}))});}
    end(){this.onend?.();}
  }
  const synthesis={speaking:false,cancel(){this.speaking=false;},speak(u){spoken.push(u);this.speaking=true;}};
  const voice=new Voice({Recognition,synthesis,Utterance:class{constructor(text){this.text=text;}},
    onText:t=>texts.push(t),onStatus:s=>statuses.push(s),onFatal:e=>fatal.push(e),
    setTimer:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimer:id=>timers.delete(id)});
  function tick(ms){const end=now+ms;for(;;){const next=[...timers.entries()].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
  function finishSpeech(){synthesis.speaking=false;spoken.at(-1).onend();tick(300);}
  return {voice,sessions,texts,statuses,fatal,spoken,tick,finishSpeech};
}
test('waits for question audio before opening the microphone',()=>{
  const h=harness();h.voice.turn('What is your first name?');assert.equal(h.sessions.length,0);
  h.finishSpeech();assert.equal(h.sessions.length,1);assert.equal(h.sessions[0].continuous,true);
});
test('collects multiple words and delivers once after a pause',()=>{
  const h=harness();h.voice.turn('',{speak:false});const r=h.sessions[0];
  r.result([['Chiranth',true]]);h.tick(900);assert.deepEqual(h.texts,[]);
  r.result([['Chiranth',true],['Kumar',true]]);h.tick(1400);
  assert.deepEqual(h.texts,['Chiranth Kumar']);r.end();h.tick(5000);assert.equal(h.texts.length,1);
});
test('Chrome ending an empty listening session automatically opens another',()=>{
  const h=harness();h.voice.turn('',{speak:false});h.sessions[0].end();h.tick(350);
  assert.equal(h.sessions.length,2);h.sessions[1].result([['BK',true]]);h.tick(1400);assert.deepEqual(h.texts,['BK']);
});
test('retains interim text if Chrome ends before a final result',()=>{
  const h=harness();h.voice.turn('',{speak:false});h.sessions[0].result([['Chiranth',false]]);h.sessions[0].end();h.tick(1400);assert.deepEqual(h.texts,['Chiranth']);
});
test('confirmation executes on the first interim yes without waiting for silence',()=>{
  const h=harness();h.voice.turn('Is that correct?',{speak:false,confirmation:true});
  const old=h.sessions[0].onresult;h.sessions[0].result([['yes',false]]);
  assert.deepEqual(h.texts,['yes']);
  old({results:[Object.assign([{transcript:'yes yes'}],{isFinal:true})]});
  h.tick(5000);assert.deepEqual(h.texts,['yes']);
});
test('confirmation no is immediate while an ordinary yes answer waits',()=>{
  const h=harness();h.voice.turn('',{speak:false,confirmation:true});h.sessions[0].result([['no',false]]);assert.deepEqual(h.texts,['no']);
  h.voice.turn('',{speak:false,confirmation:false});h.sessions[1].result([['yes',true]]);assert.deepEqual(h.texts,['no']);h.tick(1399);assert.deepEqual(h.texts,['no']);h.tick(1);assert.deepEqual(h.texts,['no','yes']);
});
test('pause cancels restart timers and ignores late recognition callbacks',()=>{
  const h=harness();h.voice.turn('',{speak:false});const result=h.sessions[0].onresult;h.sessions[0].end();h.voice.stop();h.tick(5000);
  result({results:[Object.assign([{transcript:'stale'}],{isFinal:true})]});h.tick(5000);assert.equal(h.sessions.length,1);assert.deepEqual(h.texts,[]);
});
test('permission denial pauses instead of repeatedly requesting microphone access',()=>{
  const h=harness();h.voice.turn('',{speak:false});h.sessions[0].onerror({error:'not-allowed'});h.tick(10000);assert.equal(h.fatal.length,1);assert.equal(h.voice.active,false);assert.equal(h.sessions.length,1);
});
test('a stuck speech engine cannot prevent microphone startup',()=>{
  const h=harness();h.voice.turn('What is your name?');h.tick(12000);
  assert.equal(h.sessions.length,1);assert.equal(h.sessions[0].started,true);
});
test('default timers are called with the browser global receiver',()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
  const c=vm.createContext({});
  vm.runInContext(`function setTimeout(fn,ms){if(this!==globalThis)throw Error('Illegal invocation');return 1;} function clearTimeout(id){if(this!==globalThis)throw Error('Illegal invocation');}`,c);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'extension/voice-session.js'),'utf8'),c);
  vm.runInContext(`const v=new FormTalkVoiceSession({onStatus(){},onFatal(){}});v.later(()=>{},10);v.stop();`,c);
});
test('the actual Start button opens speech, confirms answers, and writes real input values',async()=>{
  const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');const h=harness();
  class Input {
    constructor(name,order){this.labels=[{textContent:name}];this.order=order;this.type='text';this._value='';this.events=[];}
    get value(){return this._value;}set value(v){this._value=v;}
    getAttribute(){return null;}getClientRects(){return [1];}closest(){return null;}
    matches(selector){return selector==='input,textarea,select';}
    compareDocumentPosition(other){return this.order<other.order?4:2;}
    focus(){}scrollIntoView(){}checkValidity(){return true;}dispatchEvent(e){this.events.push(e.type);}
  }
  const first=new Input('First',0),last=new Input('Last',1),controls={};
  const control=id=>controls[id] ||= {textContent:'',value:id==='language'?'en-IN':'',checked:true,parentElement:{},replaceChildren(){}};
  const root={getElementById:control,querySelector:()=>control('heading'),append(){}};
  const host={dataset:{},isConnected:true,attachShadow:()=>root};let stoppedTracks=0;
  const c={document:{getElementById:()=>null,createElement:tag=>tag==='div'?host:{},documentElement:{append(){}},querySelectorAll:selector=>selector==='input,textarea,select'?[first,last]:[]},
    window:{SpeechRecognition:h.voice.Recognition,speechSynthesis:h.voice.synthesis,SpeechSynthesisUtterance:h.voice.Utterance},
    navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop(){stoppedTracks++;}}]})}},
    FormTalkVoiceSession:class extends Voice{constructor(options){super({...options,setTimer:h.voice.setTimer,clearTimer:h.voice.clearTimer});}},
    HTMLInputElement:Input,HTMLSelectElement:class{},HTMLTextAreaElement:class{},
    Node:{DOCUMENT_POSITION_PRECEDING:2},Option:class{},Event:class{constructor(type){this.type=type;}}};
  vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'extension/assistant.js'),'utf8'),c);
  await controls.start.onclick();assert.equal(stoppedTracks,1);assert.match(h.spoken.at(-1).text,/First/);
  function answer(text){h.finishSpeech();h.sessions.at(-1).result([[text,true]]);h.tick(1400);}
  answer('Chiranth');assert.equal(first.value,'');answer('yes');assert.equal(first.value,'Chiranth');
  assert.deepEqual(first.events,['input','change']);assert.match(h.spoken.at(-1).text,/Last/);
  answer('BK');answer('yes');assert.equal(last.value,'BK');
});
test('full first-name / yes / last-name / no / retry / yes conversation',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'extension/assistant.js'),'utf8');
  const h=harness(),writes=[];const controls={confirm:{checked:true},answer:{value:''},status:{textContent:''},language:{value:'en-IN'},read:{checked:true}};
  const c={pending:null,index:0,fields:[{label:'First'},{label:'Last'}],running:true,
    normalized:s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,''),$:id=>controls[id],voice:h.voice,
    render:()=>{},stop:()=>h.voice.stop(),undo:()=>{},findField:()=>1,
    write:(f,v)=>writes.push([f.label,v])};
  c.ask=()=>{if(c.index===2&&!c.pending){c.running=false;h.voice.stop();return;}h.voice.turn(c.pending?`I heard ${c.pending}. Is that correct?`:`What should I enter for ${c.fields[c.index].label}?`);};
  vm.createContext(c);vm.runInContext(source.slice(source.indexOf('  function handle('),source.indexOf("  $('start').onclick")),c);
  h.voice.onText=t=>c.handle(t,true);c.ask();
  function answer(text){h.finishSpeech();h.sessions.at(-1).result([[text,true]]);h.tick(1400);}
  answer('Chiranth');assert.equal(writes.length,0);assert.match(h.spoken.at(-1).text,/Chiranth/);
  answer('yes');assert.deepEqual(writes,[['First','Chiranth']]);assert.match(h.spoken.at(-1).text,/Last/);
  answer('BP');answer('no');assert.equal(writes.length,1);assert.match(h.spoken.at(-1).text,/Last/);
  answer('BK');answer('yes');assert.deepEqual(writes,[['First','Chiranth'],['Last','BK']]);assert.equal(c.running,false);
});
