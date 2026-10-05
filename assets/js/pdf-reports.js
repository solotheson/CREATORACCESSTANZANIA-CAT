'use strict';
// Reports use only the signed-in account's loaded data. No data is sent to a PDF service.
window.DibPdfReports = (() => {
  const cash = value => Number.isFinite(value) ? 'TZS ' + new Intl.NumberFormat('en-TZ', {maximumFractionDigits:2}).format(value) : 'Unavailable';
  const count = value => new Intl.NumberFormat('en-TZ').format(value);
  const text = value => String(value ?? '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\u2192/g, ' to ');
  const quantity = s => s.quantity + (s.adjustment || 0) - s.sold;
  const cost = s => s.buyingPrice + s.transport / s.quantity;
  const dated = rows => [...(rows || [])].sort((a,b) => String(a.date).localeCompare(String(b.date)));
  function inventorySection(stock, admin) {
    const head = ['Product / specifications', 'Purchased', 'Sold', 'Adjustment', 'Available'];
    if (admin) head.push('Cost / unit (TZS)', 'Stock at cost (TZS)');
    head.push('Selling / unit (TZS)', 'Stock selling value (TZS)');
    const body = stock.map(s => {
      const row = [[s.brand, s.model].filter(Boolean).join(' ') + '\n' + [s.screen,s.processor,s.ram,s.storage].filter(Boolean).join(' / '),count(s.quantity),count(s.sold),count(s.adjustment || 0),count(quantity(s))];
      if (admin) row.push(cash(cost(s)),cash(quantity(s)*cost(s)));
      row.push(cash(s.sellingPrice),cash(quantity(s)*s.sellingPrice));
      return row;
    });
    const total = key => count(stock.reduce((n,s)=>n+key(s),0));
    const foot = ['TOTAL',total(s=>s.quantity),total(s=>s.sold),total(s=>s.adjustment||0),total(quantity)];
    if (admin) foot.push('',cash(stock.reduce((n,s)=>n+quantity(s)*cost(s),0)));
    foot.push('',cash(stock.reduce((n,s)=>n+quantity(s)*s.sellingPrice,0)));
    return {title:'Inventory detail',head,body,foot};
  }
  function buildInventory({data,admin,stock=data.stock,scope='All stock',generatedAt,preparedBy}) {
    const totalUnits = stock.reduce((n,s)=>n+quantity(s),0);
    return {title:'Inventory report',generatedAt,preparedBy,scope,
      notes:['Quantities and values cover the selected inventory only. Stock value uses available quantity. All amounts are in TZS.'],
      sections:[{title:'Inventory summary',head:['Metric','Value'],body:[['Product entries',count(stock.length)],['Available products',count(totalUnits)],['Total products sold in selected inventory',count(stock.reduce((n,s)=>n+s.sold,0))]]},inventorySection(stock,admin)]};
  }
  function buildBusiness({data,admin,generatedAt,preparedBy,metrics=[],notes=[]}) {
    if (!admin) throw new Error('Business reports are available to admins only.');
    const f = window.financialSummary(data);
    const soldCost = sale => { const s=data.stock.find(i=>i.id===sale.stockId);return s ? cost(s)*sale.quantity : NaN; };
    const sources = {profit:'Sales profit',stock_capital:'Recovered stock capital',other_income:'Other income',owner_capital:'Owner capital',borrowed:'Borrowed money'};
    const fundingType = {contribution:'Capital invested',withdrawal:'Owner withdrawal',loan_received:'Loan received',loan_repayment:'Loan principal repaid'};
    const sections = [
      {title:'Business summary',head:['Metric','Value'],body:[
        ['Total products sold',count(data.sales.reduce((n,s)=>n+s.quantity,0))],['Sales transactions',count(data.sales.length)],
        ['Sales revenue',cash(f.salesRevenue)],['Total purchase cost',cash(f.purchaseCost)],['Stock at selling price',cash(data.stock.reduce((n,s)=>n+quantity(s)*s.sellingPrice,0))],
        ['Gross profit',cash(f.missingCosts?NaN:f.grossProfit)],['Other revenue',cash(f.otherIncome)],['Operating expenses',cash(f.expenseTotal)],
        ['Net profit / loss',cash(f.missingCosts?NaN:f.netProfit)],
        ['Potential remaining profit',cash(f.missingCosts?NaN:data.stock.reduce((n,s)=>n+quantity(s)*(s.sellingPrice-cost(s)),0))]]},
      {title:'Capital, cash, net worth and expense coverage',startOnNewPage:true,head:['Metric','Value','Explanation'],body:metrics.map(([label,value,hint])=>[label,value===null?'Not set up':cash(value),hint])},
      {...inventorySection(data.stock,true),startOnNewPage:true},
      {title:'Sales detail',head:['Date','Product','Quantity','Unit price (TZS)','Sale total (TZS)','Cost of sold stock (TZS)','Gross profit (TZS)'],body:dated(data.sales).map(s=>[s.date,s.model,count(s.quantity),cash(s.unitPrice),cash(s.quantity*s.unitPrice),cash(soldCost(s)),cash(s.quantity*s.unitPrice-soldCost(s))]),foot:['TOTAL','',count(data.sales.reduce((n,s)=>n+s.quantity,0)),'',cash(f.salesRevenue),cash(f.missingCosts?NaN:f.soldCost),cash(f.missingCosts?NaN:f.grossProfit)]},
      {title:'Paid expenses and funding sources',head:['Date','Category','Note','Amount (TZS)','Expense coverage'],body:dated(data.expenses).map(e=>{
        const coverage=(data.coverage||[]).find(c=>c.expense_id===e.id)||{};
        const allocated=Object.keys(sources).reduce((n,k)=>n+(coverage[k]||0),0);
        const detail=data.coverageAvailable?Object.entries(sources).filter(([key])=>coverage[key]>0).map(([key,label])=>label+': '+cash(coverage[key])).concat(allocated<e.amount?['Unassigned: '+cash(e.amount-allocated)]:[],allocated>e.amount?['Review: assigned amount exceeds expense']:[]).join('\n'):'Coverage unavailable';
        return [e.date,e.category,e.note,cash(e.amount),detail];
      }),foot:['TOTAL','','',cash(f.expenseTotal),'']},
      {title:'Other revenue detail',head:['Date','Source','Note','Amount (TZS)'],body:dated(data.revenue).map(r=>[r.date,r.source,r.note,cash(r.amount)]),foot:['TOTAL','','',cash(f.otherIncome)]},
      {title:'Capital and loan transactions',head:['Date','Type','Note','Amount (TZS)'],body:dated(data.funding).map(r=>[r.date,fundingType[r.type]||r.type,r.note,cash(r.amount)])},
      {title:'Stock adjustment history',head:['Tanzania time','Product','Previous quantity','New quantity','Reason'],body:[...(data.adjustments||[])].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))).map(a=>[new Date(a.created_at).toLocaleString('en-GB',{timeZone:'Africa/Dar_es_Salaam'}),data.stock.find(s=>s.id===a.stock_id)?.model||a.stock_id,count(a.previous_remaining),count(a.new_remaining),a.reason])}
    ];
    return {title:'Business report',generatedAt,preparedBy,scope:'All recorded activity - all dates',
      notes:['Net worth = cash + available stock at cost - outstanding recorded loans. This report covers recorded cash, stock and loans only.',...notes],sections};
  }
  let libraryPromise;
  function loadLibraries() {
    const script = src => new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>{el.remove();reject(new Error('PDF export could not load. Check your connection and try again.'));};document.head.appendChild(el);});
    if (!libraryPromise) libraryPromise=(async()=>{
      if (!window.jspdf?.jsPDF) await script('assets/vendor/jspdf.js');
      if (!window.jspdf.jsPDF.API.autoTable) await script('assets/vendor/jspdf-autotable.js');
    })().catch(error=>{libraryPromise=null;throw error;});
    return libraryPromise;
  }
  function createPdf(report) {
    const doc = new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    doc.setProperties({title:'DIB Company - '+report.title,subject:report.scope,author:'DIB Company'});
    const width=297, height=210, margin=12;
    let y=37;
    const green=[22,82,64], muted=[85,100,96];
    const paragraph = line => {
      doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...muted);
      const lines=doc.splitTextToSize(text(line),width-margin*2);
      for(const item of lines){if(y>height-22){doc.addPage();y=37;}doc.text(item,margin,y);y+=4.5;}
      y+=2;
    };
    paragraph(report.scope);
    for(const note of report.notes)paragraph(note);
    y+=3;
    for(const section of report.sections){
      if(section.startOnNewPage||y>height-40){doc.addPage();y=37;}
      doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(...green);doc.text(text(section.title),margin,y);y+=5;
      doc.autoTable({startY:y,margin:{top:37,right:margin,bottom:18,left:margin},
        head:[section.head.map(text)],body:section.body.length?section.body.map(row=>row.map(text)):[[{content:'No records in this section.',colSpan:section.head.length}]],
        foot:section.foot?[section.foot.map(text)]:undefined,showFoot:'lastPage',showHead:'everyPage',rowPageBreak:'avoid',theme:'striped',
        styles:{font:'helvetica',fontSize:8,cellPadding:section.head.length===3?1.5:2.2,overflow:'linebreak',valign:'top',textColor:[30,45,40],lineColor:[220,230,224],lineWidth:0.1},
        headStyles:{fillColor:green,textColor:255,fontStyle:'bold'},footStyles:{fillColor:[225,240,232],textColor:green,fontStyle:'bold'},alternateRowStyles:{fillColor:[246,249,247]}});
      y=doc.lastAutoTable.finalY+11;
    }
    const pages=doc.getNumberOfPages();
    for(let page=1;page<=pages;page++){
      doc.setPage(page);
      doc.setFillColor(...green);doc.rect(0,0,width,27,'F');
      doc.setFont('helvetica','bold');doc.setFontSize(17);doc.setTextColor(255);doc.text('DIB COMPANY',margin,11);
      doc.setFontSize(11);doc.text(text(report.title),margin,19);
      doc.setFont('helvetica','normal');doc.setFontSize(8);
      doc.text(text('Generated: '+report.generatedAt+' (Tanzania)'),width-margin,10,{align:'right'});
      const prepared=doc.splitTextToSize(text('Prepared by: '+report.preparedBy),110).slice(0,2);
      doc.text(prepared,width-margin,16,{align:'right'});
      doc.setDrawColor(205,220,210);doc.line(margin,height-13,width-margin,height-13);
      doc.setTextColor(...muted);doc.setFontSize(8);doc.text('DIB Stock Control | All amounts in TZS',margin,height-8);
      doc.text('Page '+page+' of '+pages,width-margin,height-8,{align:'right'});
    }
    return doc;
  }
  return {buildInventory,buildBusiness,loadLibraries,createPdf};
})();
