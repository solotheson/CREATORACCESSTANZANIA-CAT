const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(tables={}) {
  const calls=[];
  const client={from(table){calls.push(table);let after,limit=500,key='id',id,owner;
    const q={select(){return q},eq(k,v){if(k==='created_by')owner=v;else id=v;return q},single(){return Promise.resolve({data:tables[table]?.find(x=>x.id===id)||null,error:null})},order(k){key=k;return q},limit(n){limit=n;return q},gt(k,v){after=v;return q},then(resolve){return Promise.resolve({data:(tables[table]||[]).filter(x=>(after===undefined||x[key]>after)&&(!owner||x.created_by===owner)).sort((a,b)=>a[key].localeCompare(b[key])).slice(0,limit),error:null}).then(resolve)}};return q},rpc(name,args){calls.push({name,args});return Promise.resolve({data:args.p_id,error:null})}};
  const context={window:{},supabase:{createClient:()=>client},atob:s=>Buffer.from(s,'base64').toString()};vm.createContext(context);vm.runInContext(fs.readFileSync('assets/js/database.js','utf8'),context);
  return {db:new context.window.DibDatabase({url:'https://test.supabase.co',publishableKey:'sb_publishable_test'}),calls,Class:context.window.DibDatabase};
}
test('staff requests no private business tables and maps API columns',async()=>{
  const {db,calls}=setup({dib_members:[{id:'staff',role:'user',active:true}],dib_stock:[{id:'s1',selling_price:'200.50',quantity:10,sold:2,adjustment:-1}],dib_sales:[{id:'x1',stock_id:'s1',unit_price:'200.50',created_by:'staff'}]});
  const result=await db.load('staff');assert.deepEqual(calls,['dib_members','dib_stock','dib_sales','dib_expenses']);assert.equal(result.data.stock[0].sellingPrice,200.5);assert.equal(result.data.stock[0].buyingPrice,undefined);assert.equal(result.data.sales[0].stockId,'s1');
});
test('admin joins private costs and paginates beyond default API limit',async()=>{
  const stock=Array.from({length:1101},(_,i)=>({id:String(i).padStart(5,'0'),selling_price:'300'}));
  const {db}=setup({dib_members:[{id:'admin',role:'admin',active:true}],dib_stock:stock,dib_purchase_costs:[{stock_id:'00000',buying_price:'100.25',transport:'50'}]});
  const {data}=await db.load('admin');assert.equal(data.stock.length,1101);assert.equal(data.stock[0].buyingPrice,100.25);assert.equal(data.stock[0].transport,50);
});
test('inactive and unassigned accounts fail before loading business data',async()=>{
  for(const member of [null,{id:'user',role:'admin',active:false}]){const {db,calls}=setup({dib_members:member?[member]:[]});await assert.rejects(db.load('user'),/no active/);assert.deepEqual(calls,['dib_members']);}
});
test('RPC retains caller sale ID for network retries and exact adjustment expectation',async()=>{
  const {db,calls}=setup();const sale={stockId:'s1',quantity:2,unitPrice:400,date:'2026-09-21'};
  await db.recordSale('retry-id',sale);await db.recordSale('retry-id',sale);assert.equal(JSON.stringify(calls[0]),JSON.stringify(calls[1]));
  await db.adjustStock('s1',5,7,'Count');assert.equal(calls[2].args.p_expected_remaining,7);
});
test('database errors propagate and private keys are rejected',async()=>{
  const {db,Class}=setup();await assert.rejects(db.check(Promise.resolve({error:new Error('Not enough stock')})),/Not enough/);
  assert.throws(()=>new Class({url:'x',publishableKey:'sb_secret_x'}),/never a secret/);
});

test('staff loads only owned sales and expenses, including previous dates',async()=>{
  const {db}=setup({dib_members:[{id:'staff',role:'user',active:true}],
    dib_sales:[{id:'own',created_by:'staff',date:'2026-01-01',unit_price:10},{id:'other',created_by:'admin',unit_price:20}],
    dib_expenses:[{id:'own',created_by:'staff',amount:5},{id:'other',created_by:'admin',amount:50},{id:'legacy',amount:90}]});
  const {data}=await db.load('staff');
  assert.deepEqual(Array.from(data.sales,s=>s.id),['own']);
  assert.deepEqual(Array.from(data.expenses,e=>e.id),['own']);
});
test('personal expense RPC does not accept a caller-supplied owner',async()=>{
  const {db,calls}=setup();
  await db.recordExpense('retry-id',{category:'Transport',note:'Trip',amount:10,date:'2026-09-28',created_by:'other'});
  assert.equal(calls[0].name,'dib_record_expense');
  assert.equal(calls[0].args.p_id,'retry-id');
  assert.equal(calls[0].args.p_amount,10);
  assert.equal('created_by' in calls[0].args,false);
});

test('funding is admin-only and numeric amounts are mapped',async()=>{
  const {db,calls}=setup({dib_members:[{id:'admin',role:'admin',active:true}],dib_funding:[{id:'f1',type:'contribution',amount:'123.45'}]});
  const {data}=await db.load('admin');assert.equal(data.funding[0].amount,123.45);assert.equal(data.financeAvailable,true);assert.ok(calls.includes('dib_funding'));
});
test('admin loads numeric expense source amounts while staff never queries coverage',async()=>{
  const {db}=setup({dib_members:[{id:'admin',role:'admin',active:true}],dib_expense_coverage:[{expense_id:'e',profit:'10.25',stock_capital:'20',other_income:'0',owner_capital:'0',borrowed:'0',revision:2}]});
  const {data}=await db.load('admin');assert.equal(data.coverageAvailable,true);assert.equal(data.coverage[0].profit,10.25);
  const staff=setup({dib_members:[{id:'staff',role:'user',active:true}]});
  await staff.db.load('staff');assert.equal(staff.calls.includes('dib_expense_coverage'),false);
});
test('coverage save uses a revision and expected expense amount without recording another expense',async()=>{
  const {db,calls}=setup();const values={profit:10,stock_capital:5,other_income:0,owner_capital:0,borrowed:0};
  await db.saveCoverage('e',2,15,values);
  assert.equal(calls.length,1);assert.equal(calls[0].name,'dib_set_expense_coverage');assert.equal(calls[0].args.p_expected_revision,2);assert.equal(calls[0].args.p_expected_amount,15);
});
test('missing coverage migration disables coverage; other errors propagate',async()=>{
  const {db}=setup();db.rows=async()=>{throw {code:'PGRST205'}};
  assert.equal((await db.loadCoverage()).coverageAvailable,false);
  db.rows=async()=>{throw {code:'42501'}};await assert.rejects(db.loadCoverage(),e=>e.code==='42501');
});
test('missing finance migration is tolerated but network and permission failures propagate',async()=>{
  const {db}=setup();
  for(const code of ['42P01','PGRST205']){
    db.rows=async()=>{throw {code}};
    const result=await db.loadFunding();assert.equal(result.financeAvailable,false);assert.equal(result.funding.length,0);
  }
  for(const code of ['42501','NETWORK']){
    db.rows=async()=>{throw {code}};
    await assert.rejects(db.loadFunding(),e=>e.code===code);
  }
});
