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
