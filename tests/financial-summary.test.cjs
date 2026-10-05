const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const context={window:{}};vm.createContext(context);
vm.runInContext(fs.readFileSync('assets/js/financial-summary.js','utf8'),context);
const summary=context.window.financialSummary;
const fixture=()=>({stock:[{id:'s',quantity:3,sold:1,buyingPrice:1000000,transport:0,adjustment:0}],sales:[{stockId:'s',quantity:1,unitPrice:1500000}],expenses:[{amount:700000}],revenue:[],funding:[{type:'contribution',amount:5000000}]});
test('expenses paid from initial capital reduce profit and cash once',()=>{
  const f=summary(fixture());
  assert.equal(f.netProfit,-200000);assert.equal(f.cash,2800000);
  assert.equal(f.inventory,2000000);assert.equal(f.netWorth,4800000);
  assert.equal(f.expensesBeyondEarnings,200000);
});
test('capital and borrowing are not profit; principal repayment is not expense',()=>{
  const d=fixture();d.funding.push({type:'contribution',amount:300000},{type:'withdrawal',amount:100000},{type:'loan_received',amount:1000000},{type:'loan_repayment',amount:200000});
  const f=summary(d);assert.equal(f.netProfit,-200000);assert.equal(f.cash,3800000);
  assert.equal(f.debt,800000);assert.equal(f.netWorth,5000000);
  assert.equal(f.netWorth,f.contributions-f.withdrawals+f.businessResult);
});
test('stock adjustments change net worth without changing cash',()=>{
  const d=fixture();d.stock[0].adjustment=-1;
  const f=summary(d);assert.equal(f.cash,2800000);assert.equal(f.inventory,1000000);
  assert.equal(f.adjustmentValue,-1000000);assert.equal(f.netWorth,3800000);
  assert.equal(f.netWorth,f.contributions-f.withdrawals+f.businessResult);
});
test('transport is paid once and allocated to sold stock; unsold stock is an asset',()=>{
  const d=fixture();d.stock[0].transport=300000;
  const f=summary(d);assert.equal(f.purchaseCost,3300000);assert.equal(f.soldCost,1100000);
  assert.equal(f.cash,2500000);assert.equal(f.inventory,2200000);assert.equal(f.netProfit,-300000);
});
test('additional income can cover expenses; initial capital is explicitly required',()=>{
  const d=fixture();d.revenue=[{amount:300000}];d.funding=[];
  const f=summary(d);assert.equal(f.netProfit,100000);assert.equal(f.expensesBeyondEarnings,0);assert.equal(f.hasCapital,false);
});
test('missing costs and legacy loan expenses require review',()=>{
  const d=fixture();d.stock[0].buyingPrice=undefined;d.expenses[0].category='Loan payment';
  const f=summary(d);assert.equal(f.missingCosts,true);assert.equal(f.legacyLoanExpenses,1);
});
test('expense funding gap never exceeds expenses when sales lose money',()=>{
  const d=fixture();d.sales[0].unitPrice=500000;
  const f=summary(d);assert.equal(f.netProfit,-1200000);assert.equal(f.expensesBeyondEarnings,700000);
});
test('entered cash calculates net worth without changing profit, capital or recorded cash',()=>{
  const d=fixture();d.funding=[{type:'loan_received',amount:600000}];
  const recorded=summary(d), actual=summary(d,900000);
  assert.equal(actual.cash,900000);assert.equal(actual.netWorth,2300000);
  assert.equal(actual.netProfit,recorded.netProfit);assert.equal(actual.contributions,0);
  assert.equal(actual.recordedCash,recorded.cash);assert.equal(actual.hasActualCash,true);
  assert.equal(summary(d,0).netWorth,1400000);
  assert.equal(summary(d,null).hasActualCash,false);
  for(const value of [-1,NaN,Infinity,1e14,'900000'])assert.equal(summary(d,value).cash,recorded.cash);
});
