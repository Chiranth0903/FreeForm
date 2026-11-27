(() => {
  const existing=document.getElementById('formtalk-host');
  if(existing?.dataset.formtalkVersion==='1.2.3')return;
  if(existing){existing.shadowRoot?.getElementById('pause')?.click();existing.remove();}
  const host = document.createElement('div'); host.id = 'formtalk-host';
  host.dataset.formtalkVersion='1.2.3';
  document.documentElement.append(host);
  const root = host.attachShadow({mode:'open'});
  root.innerHTML = `<style>
  :host{all:initial}*{box-sizing:border-box}section{position:fixed;right:24px;bottom:24px;width:360px;max-width:calc(100vw - 32px);max-height:85vh;overflow:auto;background:#111a2d;color:#edf2ff;border:1px solid #344261;border-radius:22px;padding:22px;font:14px/1.5 system-ui;z-index:2147483647;box-shadow:0 20px 80px #0006}h2{margin:0;font-size:23px}small{color:#aab9d5}button,input,select{font:inherit;border-radius:10px;padding:10px;border:1px solid #455574}button{cursor:pointer;background:#263754;color:white}button:hover{background:#385078}.primary{background:#6654e8}header{display:flex;justify-content:space-between;align-items:center}p{margin:16px 0}#question{font-size:18px}input,select{width:100%;background:#0b1220;color:white;margin:6px 0}nav{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}#heard{min-height:22px;color:#a7e1d2}label{display:block;margin-top:12px}.note{font-size:12px;color:#aab9d5}progress{width:100%;accent-color:#9184ff}button:disabled{opacity:.5;cursor:default}</style>
  <section aria-label="FreeForm AI voice assistant"><header><div><h2>FreeForm AI</h2><small>Your voice. Your form.</small></div><button id="close" aria-label="Close">×</button></header>
  <p id="status" role="status" aria-live="polite">Ready to find your form fields.</p><progress id="progress" value="0" max="1"></progress><p id="question"></p>
  <select id="fields" aria-label="Choose a field"></select><div id="heard" aria-live="polite"></div>
  <nav><button id="start" class="primary">▶ Start guide</button><button id="mic">🎙 Speak</button><button id="pause">Pause</button></nav>
  <input id="answer" aria-label="Type an answer or voice command" placeholder="Or type an answer / command"><button id="apply">Apply answer</button>
  <nav><button id="back">← Back</button><button id="skip">Skip →</button><button id="rescan">Rescan</button><button id="undo">Undo</button></nav>
  <label><input id="read" type="checkbox" checked style="width:auto"> Read questions aloud</label>
  <label><input id="confirm" type="checkbox" checked style="width:auto"> Confirm spoken answers before applying</label>
  <label>Speech language<select id="language"><option value="en-IN">English (India)</option><option value="en-US">English (US)</option><option value="en-GB">English (UK)</option></select></label>
  <p class="note">Say “change email to …”, “go to phone”, “skip”, “back”, “undo”, or “stop”. Use exact field names for edits. Dates: YYYY-MM-DD. File uploads and signatures need manual input. Review and submit the form yourself.</p>
  <p class="note">Speech uses Chrome’s recognition service and may send audio for processing. No answers are stored by this extension.</p></section>`;
  const $ = id => root.getElementById(id);
  root.querySelector('h2').textContent='FreeForm AI';
  const hiddenStyle=document.createElement('style');hiddenStyle.textContent='[hidden]{display:none!important}';root.append(hiddenStyle);
  let fields=[], index=0, running=false, history=[], pending=null;
  const voice=new globalThis.FormTalkVoiceSession({
    Recognition:window.SpeechRecognition || window.webkitSpeechRecognition,
    synthesis:window.speechSynthesis,Utterance:window.SpeechSynthesisUtterance,
    onText:text=>handle(text,true),
    onStatus:message=>{$('status').textContent=message;},
    onFatal:message=>{running=false;$('start').textContent='Start conversation';$('status').textContent=message;}
  });
  $('start').textContent='Start conversation';
  $('mic').hidden=true;
  $('confirm').checked=true;
  $('confirm').parentElement.hidden=true;
  $('read').checked=true;
  $('read').parentElement.hidden=true;
  const clean = s => String(s || '').replace(/\s+/g,' ').trim();
  function label(el) {
    const labelled = (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)?.textContent || '').join(' ');
    return clean(el.getAttribute('aria-label') || labelled || [...(el.labels || [])].map(l=>l.textContent).join(' ') || el.placeholder || el.name || el.id || 'Unnamed field').replace(/\s*\*$/, '');
  }
  function scan() {
    stop(); pending=null; fields=[]; const groups=new Map();
    for (const el of document.querySelectorAll('input,textarea,select')) {
      const visible=el.getClientRects().length || (['radio','checkbox'].includes(el.type) && [...(el.labels || [])].some(l=>l.getClientRects().length));
      if (el.disabled || el.readOnly || el.matches('[type=hidden],[type=submit],[type=button],[type=reset],[type=password],[type=file]') || !visible || el.closest('[hidden],[inert]')) continue;
      if (el.type === 'radio') {
        const key=el.form?.id + ':' + el.name;
        if (groups.has(key)) { groups.get(key).elements.push(el); continue; }
        const field={label:clean(el.closest('fieldset')?.querySelector('legend')?.textContent || el.closest('[role=radiogroup]')?.getAttribute('aria-label') || el.name || label(el)),elements:[el],type:'radio'};
        groups.set(key,field); fields.push(field);
      } else fields.push({label:label(el),elements:[el],type:el.type || el.tagName.toLowerCase()});
    }
    // 123FormBuilder exposes a segmented date widget rather than a native date input.
    for(const month of document.querySelectorAll('[id^="date-"][id$="-month"]')) {
      const prefix=month.id.slice(0,-6);
      const segments=[month,document.getElementById(prefix+'-day'),document.getElementById(prefix+'-year')];
      if(segments.some(e=>!e) || !month.getClientRects().length)continue;
      const editable=e=>e.matches('input,select,[contenteditable="true"],[role="spinbutton"]')?e:e.querySelector('input,select,[contenteditable="true"],[role="spinbutton"]');
      const elements=segments.map(editable);
      if(elements.every(Boolean)) {
        fields=fields.filter(f=>!f.elements.some(e=>elements.includes(e)));
        fields.push({label:'Date of birth',elements,type:'segmented-date'});
      } else fields.push({label:'Date of birth (manual entry required)',elements:[month],type:'manual-date'});
    }
    fields.sort((a,b)=>a.elements[0].compareDocumentPosition(b.elements[0]) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1);
    index=0; $('fields').replaceChildren(...fields.map((f,i)=>new Option(`${i+1}. ${f.label}`,String(i))));
    $('status').textContent=`Found ${fields.length} fields. Click Start guide.`; render();
  }
  function options(f) { return f.type==='radio' ? f.elements.map(e=>label(e)) : f.elements[0].options ? [...f.elements[0].options].filter(o=>!o.disabled && o.value).map(o=>o.textContent) : []; }
  function render() {
    $('progress').max=Math.max(1,fields.length); $('progress').value=index;
    $('fields').value=String(index);
    const f=fields[index]; $('question').textContent=pending ? `I heard ${pending}. Is that correct? Say yes or no.` : f ? `What should I enter for ${f.label}?${options(f).length ? ' Choices: '+options(f).join(', ')+'.' : f.type==='checkbox' ? ' Say yes or no.' : ''}` : 'All fields visited. Review your form before submitting. Complete the CAPTCHA yourself.';
    if(f) {f.elements[0].scrollIntoView({behavior:'smooth',block:'center'}); f.elements[0].focus({preventScroll:true});}
  }
  function stop() {running=false;voice.stop();$('start').textContent='Resume conversation';}
  function ask() {
    render(); if (!fields[index] && !pending) {stop();$('status').textContent='Ready for your review. Nothing was submitted.';return;}
    if(running)voice.turn($('question').textContent,{language:$('language').value,speak:true,confirmation:pending!==null});
  }
  const normalized=s=>clean(s).toLowerCase().replace(/[^a-z0-9 ]/g,'');
  function findField(name) {
    const n=normalized(name); const exact=fields.map((f,i)=>({f,i})).filter(x=>normalized(x.f.label)===n);
    const matches=exact.length?exact:fields.map((f,i)=>({f,i})).filter(x=>normalized(x.f.label).includes(n));
    if(matches.length!==1) throw Error(matches.length?'Several fields match. Choose the field from the list.':'Field not found. Choose it from the list.'); return matches[0].i;
  }
  function assign(el,value) {
    if(el.isContentEditable) {el.textContent=value;el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));el.dispatchEvent(new Event('change',{bubbles:true}));el.blur();return;}
    if(!el.matches('input,textarea,select'))throw Error('This custom control needs manual entry. Use Skip to continue.');
    const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function write(f,raw) {
    const el=f.elements[0]; const before=f.elements.map(e=>({value:e.isContentEditable?e.textContent:e.value,checked:e.checked}));let v=clean(raw);
    if(f.type==='manual-date')throw Error('This date widget does not expose editable segments. Enter the birth date on the page, then click Skip.');
    if(f.type==='segmented-date') {
      const iso=parseDate(v);if(!iso)throw Error('Say a date such as 15 October 2005, or type YYYY-MM-DD.');
      const [year,month,day]=iso.split('-');
      try{[month,day,year].forEach((part,i)=>assign(f.elements[i],part));}catch(e){f.elements.forEach((e,i)=>{try{assign(e,before[i].value);}catch{}});throw e;}
    }
    else if(f.type==='checkbox') {if(!/^(yes|no|true|false|check|uncheck|checked|unchecked)$/i.test(v))throw Error('Please say yes or no.');el.checked=/^(yes|true|check|checked)$/i.test(v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}
    else if(f.type==='radio' || el.options) {
      const choices=f.type==='radio'?f.elements:[...el.options];const match=choices.filter(e=>normalized(f.type==='radio'?label(e):e.textContent)===normalized(v) || normalized(e.value)===normalized(v));
      if(match.length!==1)throw Error('Say one of the listed choices exactly.');
      if(f.type==='radio')match[0].click();else assign(el,match[0].value);
    } else {
      if(f.type==='email') v=v.toLowerCase().replace(/\s+at\s+/g,'@').replace(/\s+dot\s+/g,'.').replace(/\s/g,'').replace(/\.$/,'');
      if(f.type==='tel') v=v.replace(/\s/g,'').replace(/\.$/,'');
      if(f.type==='date') {v=parseDate(v);if(!v)throw Error('Say a date such as 15 October 2005, or type YYYY-MM-DD.');}
      if(f.type==='number' && !Number.isFinite(Number(v)))throw Error('Please provide a number.');
      assign(el,v);
      if(el.value!==v || !el.checkValidity()) {assign(el,before[0].value);throw Error('That answer does not meet the field requirements. Please try again.');}
    }
    history.push({f,before}); $('heard').textContent=`Updated ${f.label}.`;
  }
  function undo() {const item=history.pop();if(!item)throw Error('Nothing to undo.');item.f.elements.forEach((el,i)=>{if(['radio','checkbox'].includes(el.type)){el.checked=item.before[i].checked;el.dispatchEvent(new Event('change',{bubbles:true}));}else assign(el,item.before[i].value);});index=Math.max(0,fields.indexOf(item.f));}
  function parseDate(text) {
    let s=clean(text).replace(/(\d)(st|nd|rd|th)\b/gi,'$1').replace(/,/g,'');
    let y,m,d;let match=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(match)[,y,m,d]=match;
    else {
      const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
      match=s.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
      if(match){d=match[1];m=months.findIndex(x=>x===match[2].toLowerCase())+1;y=match[3];}
      else {match=s.match(/^([a-z]+)\s+(\d{1,2})\s+(\d{4})$/i);if(!match)return null;m=months.findIndex(x=>x===match[1].toLowerCase())+1;d=match[2];y=match[3];}
    }
    const date=new Date(Date.UTC(Number(y),Number(m)-1,Number(d)));
    if(date.getUTCFullYear()!==Number(y)||date.getUTCMonth()+1!==Number(m)||date.getUTCDate()!==Number(d))return null;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  function handle(text,spoken=false) {
    try {
      let cmd=normalized(text);
      if(['stop','pause'].includes(cmd)){stop();$('status').textContent='Paused. Click Start guide to continue.';return;}
      const words=cmd.split(/\s+/).filter(Boolean);
      const positive=words.length && words.every(w=>['yes','yeah','yep','yup','confirm','confirmed','correct','apply','okay','ok','thats','that','is','right'].includes(w)) && words.some(w=>['yes','yeah','yep','yup','confirm','confirmed','correct','apply','okay','ok','right'].includes(w));
      const negative=words.length && words.every(w=>['no','nope','nah','retry','incorrect','cancel','thats','that','is','wrong'].includes(w)) && words.some(w=>['no','nope','nah','retry','incorrect','cancel','wrong'].includes(w));
      if(pending && positive) {text=pending;pending=null;cmd=normalized(text);}
      else if(pending && negative){pending=null;$('answer').value='';ask();return;}
      else if(pending && spoken && !['undo','back','previous','go back','skip','next'].includes(cmd) && !/^go to /i.test(text)) {
        // Stay in confirmation state. Never turn an unrecognized confirmation into field data.
        ask();$('status').textContent='Please say yes to keep that answer, or no to repeat it.';return;
      }
      else if(spoken && $('confirm').checked && !['undo','back','previous','go back','skip','next'].includes(cmd) && !/^go to /i.test(text)) {
        pending=text;$('answer').value=text;ask();return;
      } else pending=null;
      if(cmd==='undo')undo();
      else if(['back','previous','go back'].includes(cmd))index=Math.max(0,index-1);
      else if(['skip','next'].includes(cmd))index=Math.min(fields.length,index+1);
      else if(/^go to /i.test(text)) index=findField(text.slice(6));
      else {
        const edit=text.match(/^(?:change|set|update)\s+(.+?)\s+to\s+(.+)$/i);
        if(edit) {const target=findField(edit[1]);write(fields[target],edit[2]);}
        else {if(!fields[index])throw Error('Choose a field to edit, or say change FIELD to VALUE.');write(fields[index],text);index++;}
      }
      $('answer').value=''; if(running)ask();else render();
    } catch(e) {
      pending=null;render();$('status').textContent=e.message;
      if(running)voice.turn(`${e.message} ${$('question').textContent}`,{language:$('language').value,speak:true,confirmation:pending!==null});
    }
  }
  let startAttempt=0;
  $('start').onclick=async()=>{
    const attempt=++startAttempt;
    $('start').disabled=true;
    try {
      voice.stop();
      if(!fields.length)scan();
      if(!(window.SpeechRecognition || window.webkitSpeechRecognition))throw Error('Speech recognition is unavailable in this browser. Use Google Chrome.');
      $('status').textContent='Starting microphone — allow access if Chrome asks.';
      // Request permission directly from the Start button, before delayed speech callbacks.
      if(navigator.mediaDevices?.getUserMedia){
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        stream.getTracks().forEach(track=>track.stop());
      }
      if(attempt!==startAttempt || !host.isConnected)return;
      running=true;$('start').textContent='Restart question';ask();
    } catch(error) {
      running=false;voice.stop();
      $('status').textContent=`Could not start: ${error.name || 'Error'} — ${error.message}. Check this website's microphone permission and try Start again.`;
      $('start').textContent='Start conversation';
    } finally {$('start').disabled=false;}
  };
  $('pause').onclick=()=>{startAttempt++;stop();$('status').textContent='Paused';};
  $('apply').onclick=()=>{voice.stop();handle($('answer').value);};
  $('answer').onkeydown=e=>{if(e.key==='Enter')$('apply').click();};
  $('fields').onchange=()=>{voice.stop();pending=null;index=Number($('fields').value);if(running)ask();else render();};
  $('back').onclick=()=>{voice.stop();handle('back');}; $('skip').onclick=()=>{voice.stop();handle('skip');};$('undo').onclick=()=>{voice.stop();handle('undo');};
  $('rescan').onclick=scan; $('close').onclick=()=>{startAttempt++;stop();host.remove();};
  try{scan();}catch(error){$('status').textContent=`Form scan failed: ${error.message}`;}
})();
