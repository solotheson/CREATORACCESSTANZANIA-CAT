'use strict';
// All entries are paid immediately. Capital and loan principal are not income/expenses.
window.financialSummary = data => {
  const current = rows => rows || [];
  const sum = (rows, value) => rows.reduce((n, r) => n + value(r), 0);
  const stock = current(data.stock), sales = current(data.sales);
  const expenses = current(data.expenses), revenue = current(data.revenue);
  const funding = current(data.funding);
  const cost = s => s.buyingPrice + s.transport / s.quantity;
  const purchaseCost = sum(stock, s => s.quantity * s.buyingPrice + s.transport);
  const salesRevenue = sum(sales, s => s.quantity * s.unitPrice);
  const soldCost = sum(sales, s => { const item = stock.find(i => i.id === s.stockId); return item ? cost(item) * s.quantity : 0; });
  // Current physical inventory includes adjustments; adjustments move no cash.
  const inventory = sum(stock, s => (s.quantity + (s.adjustment || 0) - s.sold) * cost(s));
  const adjustmentValue = sum(stock, s => (s.adjustment || 0) * cost(s));
  const expenseTotal = sum(expenses, e => e.amount);
  const otherIncome = sum(revenue, r => r.amount);
  const byType = type => sum(funding.filter(f => f.type === type), f => f.amount);
  const contributions = byType('contribution'), withdrawals = byType('withdrawal');
  const borrowed = byType('loan_received'), repaid = byType('loan_repayment');
  const grossProfit = salesRevenue - soldCost;
  const netProfit = grossProfit + otherIncome - expenseTotal;
  const cash = contributions + borrowed + salesRevenue + otherIncome - purchaseCost - expenseTotal - withdrawals - repaid;
  const debt = borrowed - repaid;
  return {purchaseCost, salesRevenue, soldCost, inventory, adjustmentValue, expenseTotal, otherIncome,
    contributions, withdrawals, borrowed, repaid, grossProfit, netProfit, cash, debt,
    netWorth: cash + inventory - debt,
    businessResult: netProfit + adjustmentValue,
    expensesBeyondEarnings: Math.max(0, expenseTotal - Math.max(0, grossProfit + otherIncome)),
    hasCapital: funding.some(f => f.type === 'contribution'),
    legacyLoanExpenses: expenses.filter(e => e.category === 'Loan payment').length,
    missingCosts: stock.some(s => !Number.isFinite(s.buyingPrice) || !Number.isFinite(s.transport)) || sales.some(s => !stock.some(i => i.id === s.stockId))};
};
