const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const context={};context.window=context;vm.createContext(context);
for(const file of ['financial-summary','expense-coverage'])vm.runInContext(fs.readFileSync(`assets/js/${file}.js`,'utf8'),context);
const fixture=()=>({stock:[{id:'s',quantity:3,sold:1,buyingPrice:1000000,transport:0}],sales:[{stockId:'s',quantity:1,unitPrice:1500000}],expenses:[{id:'e',amount:700000}],revenue:[],funding:[{type:'contribution',amount:5000000}],coverage:[]});
test('manual split identifies profit used, recovered capital used and sales receipts left',()=>{
  const d=fixture();d.coverage=[{expense_id:'e',profit:500000,stock_capital:200000}];
  const c=context.coverageSummary(d);
  assert.equal(c.assigned,700000);assert.equal(c.unassigned,0);assert.equal(c.profitRemaining,0);
  assert.equal(c.capitalRemaining,800000);assert.equal(c.salesRemaining,800000);
  const f=context.financialSummary(d);assert.equal(f.cash,2800000);assert.equal(f.netProfit,-200000);
});
test('coverage never changes cash, profit or net worth and partial source entry stays unassigned',()=>{
  const d=fixture(),before=context.financialSummary(d);
  d.coverage=[{expense_id:'e',profit:100000,stock_capital:200000,owner_capital:100000}];
  const c=context.coverageSummary(d);assert.equal(c.unassigned,300000);assert.equal(c.salesRemaining,1200000);
  assert.deepEqual(context.financialSummary(d),before);
});
test('other sources do not consume sales funds',()=>{
  const d=fixture();d.coverage=[{expense_id:'e',other_income:200000,owner_capital:300000,borrowed:200000}];
  const c=context.coverageSummary(d);assert.equal(c.salesRemaining,1500000);assert.equal(c.unassigned,0);
});

test('each funding source is reduced only by its saved expense allocation',()=>{
  const d=fixture();d.revenue=[{amount:400000}];d.funding.push({type:'loan_received',amount:500000});
  d.coverage=[{expense_id:'e',profit:100000,stock_capital:200000,other_income:150000,owner_capital:100000,borrowed:50000}];
  const c=context.coverageSummary(d);
  assert.equal(c.unassigned,100000);assert.equal(c.profitRemaining,400000);assert.equal(c.capitalRemaining,800000);
  assert.equal(c.otherIncomeRemaining,250000);assert.equal(c.ownerCapitalRemaining,4900000);assert.equal(c.borrowedRemaining,450000);
  assert.equal(c.needsReview,false);
  d.coverage[0].other_income=500000;
  assert.equal(context.coverageSummary(d).otherIncomeRemaining,-100000);
  assert.equal(context.coverageSummary(d).needsReview,true);
  d.expenses=[];
  const removed=context.coverageSummary(d);
  assert.equal(removed.otherIncomeRemaining,400000);assert.equal(removed.ownerCapitalRemaining,5000000);assert.equal(removed.borrowedRemaining,500000);
});
test('sales at a loss only recover the cash actually received',()=>{
  const d=fixture();d.sales[0].unitPrice=600000;
  const c=context.coverageSummary(d);assert.equal(c.profitPool,0);assert.equal(c.capitalPool,600000);assert.equal(c.salesRemaining,600000);
});
test('sale corrections surface overallocated funds instead of hiding a negative balance',()=>{
  const d=fixture();d.coverage=[{expense_id:'e',profit:500000}];d.sales[0].unitPrice=1100000;
  const c=context.coverageSummary(d);assert.equal(c.profitRemaining,-400000);assert.equal(c.needsReview,true);
});
test('expense corrections expose overcoverage and retain other unassigned expenses',()=>{
  const d=fixture();d.expenses=[{id:'e',amount:100000},{id:'e2',amount:50000}];d.coverage=[{expense_id:'e',profit:200000}];
  const c=context.coverageSummary(d);assert.equal(c.overAssigned,100000);assert.equal(c.unassigned,50000);assert.equal(c.needsReview,true);
});
test('deleted expenses do not consume coverage pools',()=>{
  const d=fixture();d.coverage=[{expense_id:'deleted',profit:500000}];
  const c=context.coverageSummary(d);assert.equal(c.assigned,0);assert.equal(c.profitRemaining,500000);
});
test('fractional transport allocation cannot create extra cents across funding pools',()=>{
  const d=fixture();d.stock[0]={id:'s',quantity:2,sold:1,buyingPrice:0,transport:0.01};d.sales[0].unitPrice=0.01;
  const c=context.coverageSummary(d);assert.equal(c.profitPool+c.capitalPool,0.01);
});
