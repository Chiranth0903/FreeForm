const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'extension/background.js'),'utf8');
test('only the enrollment URL and local demo can receive the assistant',async()=>{
  let click; const injections=[];const badges=[];
  const chrome={action:{onClicked:{addListener:f=>click=f},setBadgeText:async v=>badges.push(v),setTitle:async()=>{}},scripting:{executeScript:async v=>injections.push(v)}};
  vm.runInNewContext(source,{chrome,URL,console});
  await click({id:1,url:'https://form.123formbuilder.com/7008640/health-insurance-enrollment-form'});
  await click({id:2,url:'http://127.0.0.1:8765/'});
  await click({id:3,url:'https://example.com/'});
  await click({id:4,url:'https://form.123formbuilder.com/999/other'});
  assert.deepEqual(injections.map(x=>x.target.tabId),[1,2]);
  assert.equal(injections[0].world,'MAIN');
  assert.deepEqual(badges.filter(x=>x.text==='SITE').map(x=>x.tabId),[3,4]);
});
test('manifest uses click-triggered access without persistent website permissions',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'extension/manifest.json')));
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.permissions,['activeTab','scripting']);
  assert.equal(manifest.host_permissions,undefined);
});
test('spoken date parser accepts explicit dates and rejects invalid or ambiguous dates',()=>{
  const assistant=fs.readFileSync(path.join(__dirname,'extension/assistant.js'),'utf8');
  const start=assistant.indexOf('  function parseDate(text)');
  const end=assistant.indexOf('  function handle(',start);
  const context={clean:s=>String(s||'').replace(/\s+/g,' ').trim()};
  vm.createContext(context);vm.runInContext(assistant.slice(start,end),context);
  assert.equal(context.parseDate('15th October 2005'),'2005-10-15');
  assert.equal(context.parseDate('October 15, 2005'),'2005-10-15');
  assert.equal(context.parseDate('2000-02-29'),'2000-02-29');
  assert.equal(context.parseDate('2001-02-29'),null);
  assert.equal(context.parseDate('31 April 2005'),null);
  assert.equal(context.parseDate('03/04/2005'),null);
});
test('spoken answers and corrections wait for confirmation; retry does not write',()=>{
  const assistant=fs.readFileSync(path.join(__dirname,'extension/assistant.js'),'utf8');
  const start=assistant.indexOf('  function handle(');
  const end=assistant.indexOf("  $('start').onclick",start);
  const controls={confirm:{checked:true},answer:{value:''},status:{textContent:''}};
  const writes=[];
  const context={pending:null,index:0,fields:[{label:'First'},{label:'Email'}],running:true,
    normalized:s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,''),$:id=>controls[id],
    ask:()=>{},render:()=>{},stop:()=>{},undo:()=>{},findField:()=>1,
    write:(field,value)=>writes.push([field.label,value])};
  vm.createContext(context);vm.runInContext(assistant.slice(start,end),context);
  context.handle('Alex',true);assert.equal(writes.length,0);assert.equal(context.pending,'Alex');
  context.handle('confirm',true);assert.deepEqual(writes,[['First','Alex']]);assert.equal(context.index,1);
  context.handle('wrong answer',true);context.handle('retry',true);assert.equal(context.pending,null);assert.equal(writes.length,1);
  context.handle('change email to alex@example.com',true);assert.equal(writes.length,1);
  context.handle('confirm',true);assert.deepEqual(writes[1],['Email','alex@example.com']);
});
test('repeated confirmations apply original values and unclear confirmations never replace them',()=>{
  const assistant=fs.readFileSync(path.join(__dirname,'extension/assistant.js'),'utf8');
  const controls={confirm:{checked:true},answer:{value:''},status:{textContent:''}};const writes=[];
  const c={pending:null,index:0,fields:[{label:'First'},{label:'Last'}],running:true,
    normalized:s=>s.toLowerCase().replace(/[^a-z0-9 ]/g,''),$:id=>controls[id],ask:()=>{},render:()=>{},stop:()=>{},undo:()=>{},findField:()=>1,write:(f,v)=>writes.push([f.label,v])};
  vm.createContext(c);vm.runInContext(assistant.slice(assistant.indexOf('  function handle('),assistant.indexOf("  $('start').onclick")),c);
  c.handle('Chiranth',true);c.handle('pardon',true);assert.equal(c.pending,'Chiranth');assert.equal(writes.length,0);
  c.handle('yes yes',true);assert.deepEqual(writes,[['First','Chiranth']]);assert.equal(c.pending,null);assert.equal(c.index,1);
  c.handle('BP',true);c.handle('no no',true);assert.equal(c.pending,null);assert.equal(c.index,1);
  c.handle('BK',true);c.handle('yes yes yes',true);assert.deepEqual(writes,[['First','Chiranth'],['Last','BK']]);assert.equal(c.index,2);
});
