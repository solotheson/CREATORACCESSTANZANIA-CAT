'use strict';
// Business dates are YYYY-MM-DD in Tanzania. Weeks run Monday through today.
window.personalSummary = (sales, expenses, userId, today, period) => {
  const start = new Date(today+'T00:00:00Z');
  if(period==='week')start.setUTCDate(start.getUTCDate()-((start.getUTCDay()+6)%7));
  const from=start.toISOString().slice(0,10);
  const own=rows=>rows.filter(row=>row.created_by===userId&&row.date>=from&&row.date<=today);
  const ownSales=own(sales),ownExpenses=own(expenses);
  return {from,to:today,count:ownSales.length,units:ownSales.reduce((sum,s)=>sum+s.quantity,0),
    collection:ownSales.reduce((sum,s)=>sum+s.quantity*s.unitPrice,0),
    expenses:ownExpenses.reduce((sum,e)=>sum+e.amount,0)};
};
