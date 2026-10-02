'use strict';
window.coverageSources = {profit:'Sales profit',stock_capital:'Recovered stock capital',other_income:'Other income',owner_capital:'Owner capital',borrowed:'Borrowed money'};
window.coverageSummary = data => {
  const f=financialSummary(data), totals=Object.fromEntries(Object.keys(coverageSources).map(k=>[k,0]));
  const expenses=new Map((data.expenses||[]).map(e=>[e.id,e]));
  let assigned=0, overAssigned=0;
  for(const row of data.coverage||[]){
    const expense=expenses.get(row.expense_id);if(!expense)continue;
    let amount=0;
    for(const key of Object.keys(totals)){totals[key]+=Number(row[key]||0);amount+=Number(row[key]||0)}
    assigned+=amount;overAssigned+=Math.max(0,amount-expense.amount);
  }
  // With a sales loss, only the collected proceeds recover stock capital.
  const profitPool=Math.round(Math.max(0,f.grossProfit)*100)/100;
  // Assign rounding remainder to capital so both pools always sum to receipts.
  const capitalPool=Math.round((f.salesRevenue-profitPool)*100)/100;
  const profitRemaining=profitPool-totals.profit, capitalRemaining=capitalPool-totals.stock_capital;
  const otherIncomeRemaining=f.otherIncome-totals.other_income;
  const ownerCapitalRemaining=f.contributions-totals.owner_capital;
  const borrowedRemaining=f.borrowed-totals.borrowed;
  return {...totals,assigned,unassigned:Math.max(0,f.expenseTotal-assigned+overAssigned),overAssigned,
    profitPool,capitalPool,profitRemaining,capitalRemaining,
    otherIncomeRemaining,ownerCapitalRemaining,borrowedRemaining,
    salesRemaining:f.salesRevenue-totals.profit-totals.stock_capital,
    needsReview:overAssigned>0.005||profitRemaining < -0.005||capitalRemaining < -0.005||otherIncomeRemaining < -0.005||ownerCapitalRemaining < -0.005||borrowedRemaining < -0.005};
};
