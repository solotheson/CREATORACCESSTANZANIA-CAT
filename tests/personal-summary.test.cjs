const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync('assets/js/personal-summary.js','utf8'),context);
const summarize=context.window.personalSummary;
test('daily totals count transactions and units separately and exclude other owners',()=>{
  const sales=[{created_by:'me',date:'2026-09-28',quantity:2,unitPrice:100},{created_by:'other',date:'2026-09-28',quantity:10,unitPrice:500},{created_by:'me',date:'2026-09-27',quantity:1,unitPrice:100}];
  const expenses=[{created_by:'me',date:'2026-09-28',amount:30},{created_by:'other',date:'2026-09-28',amount:900},{date:'2026-09-28',amount:1000}];
  const result=summarize(sales,expenses,'me','2026-09-28','day');
  assert.equal(result.count,1);assert.equal(result.units,2);assert.equal(result.collection,200);assert.equal(result.expenses,30);
});
test('week starts Monday, includes Sunday and crosses month/year without future records',()=>{
  const sales=['2025-12-28','2025-12-29','2026-01-04','2026-01-05'].map(date=>({created_by:'me',date,quantity:1,unitPrice:100}));
  const result=summarize(sales,[],'me','2026-01-04','week');
  assert.equal(result.from,'2025-12-29');assert.equal(result.count,2);assert.equal(result.collection,200);
  assert.equal(summarize(sales,[],'me','2026-01-05','week').count,1);
  assert.equal(summarize([],[],'me','2026-01-05','day').collection,0);
});
