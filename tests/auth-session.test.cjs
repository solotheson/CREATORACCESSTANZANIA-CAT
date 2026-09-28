const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

test('every page disables stored and URL sessions while retaining token refresh',()=>{
  const options=[];
  const context={window:{},supabase:{createClient:(url,key,config)=>{options.push(config);return {}}}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('assets/js/database.js','utf8'),context);
  for(let page=0;page<2;page++)new context.window.DibDatabase({url:'https://test.supabase.co',publishableKey:'sb_publishable_test'});
  for(const config of options){
    assert.equal(config.auth.persistSession,false);
    assert.equal(config.auth.detectSessionInUrl,false);
    assert.equal(config.auth.autoRefreshToken,true);
  }
});

test('restored and cross-tab sign-in events cannot open the account',()=>{
  const source=fs.readFileSync('assets/js/main.js','utf8');
  // Source can use either Windows or Unix line endings.
  const normalized=source.replaceAll('\r','');
  const code=normalized.slice(normalized.indexOf('try {\n  database=new DibDatabase'),normalized.indexOf('// Refresh across devices'));
  let callback, opened=0, cleared=0;
  const context={window:{DIB_CONFIG:{}},document:{querySelector:()=>({})},
    DibDatabase:class {constructor(){this.client={auth:{onAuthStateChange:fn=>{callback=fn}}}}},
    receiveSession:()=>opened++,clearAccount:()=>cleared++,setTimeout:fn=>fn()};
  vm.createContext(context);vm.runInContext(code,context);
  assert.equal(typeof callback,'function');
  for(const event of ['INITIAL_SESSION','SIGNED_IN','TOKEN_REFRESHED'])callback(event,{user:{id:'saved-account'}});
  assert.equal(opened,0);
  callback('SIGNED_OUT',null);assert.equal(cleared,1);
});
