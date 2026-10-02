'use strict';
let data={stock:[],sales:[],expenses:[],revenue:[],adjustments:[],funding:[],financeAvailable:false,coverage:[],coverageAvailable:false};
let member=null, database=null, sessionUser=null, busy=false, loadGeneration=0;
const isAdmin=()=>member?.role==='admin';
const businessDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmt=n=>new Intl.NumberFormat('en-TZ',{style:'currency',currency:'TZS',maximumFractionDigits:0}).format(Math.round(n||0));const number=n=>new Intl.NumberFormat('en-TZ').format(Math.round(n||0));const unitCost=s=>s.buyingPrice+(s.transport/s.quantity);const available=s=>s.quantity+(s.adjustment||0)-s.sold;const totalSales=()=>data.sales.reduce((sum,s)=>sum+s.quantity*s.unitPrice,0);const saleCost=s=>{const item=data.stock.find(x=>x.id===s.stockId);return item?unitCost(item)*s.quantity:0};const totalCostSold=()=>data.sales.reduce((sum,s)=>sum+saleCost(s),0);const totalExpenses=()=>data.expenses.reduce((sum,e)=>sum+e.amount,0);const grossProfit=()=>totalSales()-totalCostSold();const stockValue=()=>data.stock.reduce((sum,s)=>sum+available(s)*unitCost(s),0);const potentialProfit=()=>data.stock.reduce((sum,s)=>sum+available(s)*(s.sellingPrice-unitCost(s)),0);
const totalOtherRevenue=()=>data.revenue.reduce((sum,r)=>sum+r.amount,0);
const netPosition=()=>grossProfit()+totalOtherRevenue()-totalExpenses();
const expensesAfterRevenue=()=>Math.max(0,totalExpenses()-totalOtherRevenue());
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function toast(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}function dateText(d){return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${d}T12:00:00`))}
function renderPersonalDashboard(){
  const period=document.querySelector('#personal-period').value;
  const summary=personalSummary(data.sales,data.expenses,sessionUser,businessDate(),period);
  document.querySelector('#personal-range').textContent=dateText(summary.from)+' – '+dateText(summary.to)+' · Tanzania time';
  document.querySelector('#personal-cards').innerHTML=[['Sales recorded',number(summary.count)],['Units sold',number(summary.units)],['Sales collection',fmt(summary.collection)],['My expenses',fmt(summary.expenses)]].map(([label,value])=>`<article class="metric"><span class="metric-label">${label}</span><strong>${value}</strong></article>`).join('');
}
function renderDashboard(){renderPersonalDashboard();const units=data.stock.reduce((sum,s)=>sum+available(s),0),net=netPosition();document.querySelector('#overview-cards').innerHTML=[['Available stock',number(units),'Across '+data.stock.length+' laptop models'],['Stock value',fmt(stockValue()),'At purchase cost'],['Sales revenue',fmt(totalSales()),data.sales.length+' recorded sales'],['Net profit / loss',fmt(net),'Includes other revenue and expenses']].map((c,i)=>`<article class="metric"><span class="metric-label">${c[0]}</span><strong>${c[1]}</strong><small class="${i===3&&net>=0?'good':''}">${c[2]}</small></article>`).join('');const max=Math.max(...data.stock.map(available),1);document.querySelector('#stock-bars').innerHTML=data.stock.map(s=>`<div class="stock-row"><b>${escapeHtml(s.model)}</b><div class="bar"><span style="width:${available(s)/max*100}%"></span></div><em>${available(s)} left</em></div>`).join('');const low=data.stock.filter(s=>available(s)<=3);document.querySelector('#low-stock').innerHTML=low.length?low.map(s=>`<div class="low-item"><div><b>${escapeHtml(s.brand)} ${escapeHtml(s.model)}</b><small>${escapeHtml(s.processor)} · ${escapeHtml(s.ram)}</small></div><span class="badge ${available(s)===0?'out':''}">${available(s)===0?'Out of stock':available(s)+' left'}</span></div>`).join(''):'<p class="empty">Everything is well stocked.</p>';const activities=[...data.sales.map(s=>({type:'sale',date:s.date,title:`Sold ${s.quantity} × ${escapeHtml(s.model)}`,value:s.quantity*s.unitPrice})),...data.revenue.map(r=>({type:'revenue',date:r.date,title:escapeHtml(r.source),value:r.amount})),...data.expenses.map(e=>({type:'expense',date:e.date,title:escapeHtml(e.category),value:e.amount}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);document.querySelector('#recent-activity').innerHTML=activities.map(a=>`<div class="activity"><div class="activity-left"><span class="activity-sign ${a.type==='expense'?'expense':''}">${a.type==='expense'?'−':'↗'}</span><div><b>${a.title}</b><small>${dateText(a.date)}</small></div></div><span class="activity-value">${a.type==='expense'?'−':'+'}${fmt(a.value)}</span></div>`).join('')||'<p class="empty">No transactions yet.</p>';document.querySelector('#potential-profit').textContent=fmt(potentialProfit())}
function renderInventory(){const q=document.querySelector('#inventory-search').value.toLowerCase(),filter=document.querySelector('#stock-filter').value;const rows=data.stock.filter(s=>`${escapeHtml(s.brand)} ${escapeHtml(s.model)} ${escapeHtml(s.processor)}`.toLowerCase().includes(q)).filter(s=>filter==='all'||(filter==='in'&&available(s)>3)||(filter==='low'&&available(s)>0&&available(s)<=3)||(filter==='out'&&available(s)===0));document.querySelector('#inventory-body').innerHTML=rows.map(s=>{const count=available(s),state=count===0?'out':count<=3?'low':'';return `<tr><td><b>${escapeHtml(s.brand)} ${escapeHtml(s.model)}</b></td><td><span class="specs">${escapeHtml(s.screen)} · ${escapeHtml(s.processor)} · ${escapeHtml(s.ram)}/${escapeHtml(s.storage)}</span></td><td>${fmt(unitCost(s))}</td><td>${fmt(s.sellingPrice)}</td><td><span class="status ${state}">${count===0?'Out':count+' in stock'}</span></td><td>${fmt(count*s.sellingPrice)}</td><td><button class="row-button edit-button" data-edit-stock="${s.id}">Edit</button> <button class="row-button" data-delete-stock="${s.id}">Remove</button></td></tr>`}).join('')||'<tr><td colspan="7" class="empty">No items match your search.</td></tr>'}
function renderSales(){document.querySelector('#sales-summary').innerHTML=[['Revenue',fmt(totalSales())],['Gross profit',fmt(grossProfit())],['Average sale',fmt(data.sales.length?totalSales()/data.sales.length:0)]].map(x=>`<div class="strip-stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');document.querySelector('#sales-body').innerHTML=[...data.sales].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>`<tr><td>${dateText(s.date)}</td><td><b>${escapeHtml(s.model)}</b></td><td>${s.quantity}</td><td>${fmt(s.quantity*s.unitPrice)}</td><td>${fmt(saleCost(s))}</td><td>${fmt(s.quantity*s.unitPrice-saleCost(s))}</td><td><button class="row-button" data-delete-sale="${s.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No sales recorded yet.</td></tr>'}
function renderPurchases(){document.querySelector('#purchases-body').innerHTML=[...data.stock].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>`<tr><td>${dateText(s.date)}</td><td><b>${escapeHtml(s.brand)} ${escapeHtml(s.model)}</b></td><td>${s.quantity}</td><td>${fmt(s.buyingPrice)}</td><td>${fmt(s.transport)}</td><td>${fmt(unitCost(s)*s.quantity)}</td><td><button class="row-button edit-button" data-edit-stock="${s.id}">Edit</button></td></tr>`).join('')}
function renderExpenses(){document.querySelector('#expense-summary').innerHTML=[['Total expenses',fmt(totalExpenses())],['Other revenue',fmt(totalOtherRevenue())],['Expenses after other revenue',fmt(expensesAfterRevenue())],['Net after expenses',fmt(netPosition())]].map(x=>`<div class="strip-stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');document.querySelector('#expenses-body').innerHTML=[...data.expenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr><td>${dateText(e.date)}</td><td><b>${escapeHtml(e.category)}</b></td><td>${escapeHtml(e.note||'—')}</td><td>${fmt(e.amount)}</td><td>${expenseCoverageCell(e)}</td><td><button class="row-button" data-delete-expense="${e.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">No expenses recorded yet.</td></tr>'}
function renderReports(){const invested=data.stock.reduce((sum,s)=>sum+unitCost(s)*s.quantity,0),net=netPosition();document.querySelector('#report-cards').innerHTML=[['Total purchase cost',fmt(invested),'All stock purchases'],['Stock at selling price',fmt(data.stock.reduce((sum,s)=>sum+available(s)*s.sellingPrice,0)),'Remaining inventory'],['Gross profit',fmt(grossProfit()),'Sales less sold stock cost'],['Other revenue',fmt(totalOtherRevenue()),'Extra income received'],['Expenses after other revenue',fmt(expensesAfterRevenue()),'Expense amount less other income; already paid'],['Operating expenses',fmt(totalExpenses()),'Rent, wages, loan and other'],['Net profit / loss',fmt(net),'Sales profit + other revenue − expenses',net>=0],['Potential remaining profit',fmt(potentialProfit()),'If current stock sells at set prices',true]].map(x=>`<article class="report-card ${x[3]?'positive':''}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('')}
function populateSaleSelect(){const select=document.querySelector('#sale-stock'),selected=select.value;select.innerHTML='<option value="">Choose stock item</option>'+data.stock.filter(s=>available(s)>0).map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${escapeHtml(s.brand)} ${escapeHtml(s.model)} — ${available(s)} available</option>`).join('')}
function renderAll(){renderDashboard();renderInventory();renderSales();renderPurchases();renderExpenses();renderCoverageSummary();renderRevenue();renderReports();renderFinances();populateSaleSelect();renderAdjustments();applyPermissions()}function openModal(id){if(!member || (!['sale-modal','expense-modal'].includes(id)&&!isAdmin()))return;document.querySelector(`#${id}`).showModal();if(id==='funding-modal')prepareFundingForm();if(id==='stock-modal')prepareStockForm();if(id==='revenue-modal')prepareRevenueForm();if(id==='sale-modal')document.querySelector('#sale-form [name=date]').value=businessDate();if(id==='expense-modal')document.querySelector('#expense-form [name=date]').value=businessDate()}function showView(view){if(!isAdmin()&&!['dashboard','inventory','sales','expenses'].includes(view))view='inventory';document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view));document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelector('#page-title').textContent=view==='dashboard'?'DIB Stock Control':view==='revenue'?'Other Revenue':view==='finances'?'Business position':view[0].toUpperCase()+view.slice(1);document.querySelector('.sidebar').classList.remove('open');window.scrollTo(0,0)}

// Account lifecycle: clear every rendered record before another account can load.
function clearAccount(message='Sign in with your DIB account.') {
  loadGeneration++;
  member=null; sessionUser=null;
  data={stock:[],sales:[],expenses:[],revenue:[],adjustments:[],funding:[],financeAvailable:false,coverage:[],coverageAvailable:false};
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  document.querySelectorAll('form').forEach(f=>{f.reset();delete f.dataset.recordId});
  editingStockId=null; editingRevenueId=null; editingFundingId=null; editingCoverage=null; adjustment=null; pendingSale=null;
  document.body.classList.add('signed-out');
  document.body.dataset.role='';
  renderAll();
  document.querySelector('#auth-status').textContent=message;
  document.querySelector('#account-label').textContent='';
}
async function refreshData() {
  if(!sessionUser)return;
  const generation=++loadGeneration, userId=sessionUser;
  let result;
  try{result=await database.load(userId)}catch(error){if(generation===loadGeneration&&(error.code==='PGRST116'||/no active DIB membership/.test(error.message)))clearAccount('Your account access changed. Contact the project owner.');throw error}
  if(generation!==loadGeneration || sessionUser!==userId)return;
  member=result.member;data=result.data;
  document.body.dataset.role=member.role;
  document.querySelector('#account-label').textContent=`${member.display_name} · ${member.role==='admin'?'Admin':'User'}`;
  document.querySelector('.sidebar-footer').textContent='Synced · '+new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Dar_es_Salaam',hour:'2-digit',minute:'2-digit'}).format(new Date());
  renderAll();
}
async function receiveSession(session) {
  const next=session?.user?.id;
  if(!next){clearAccount();return}
  if(next===sessionUser)return;
  clearAccount('Loading your account…');sessionUser=next;
  try {
    await refreshData();
    if(sessionUser!==next || !member)return;
    document.body.classList.remove('signed-out');
    showView('dashboard');
  } catch(error) {if(sessionUser===next)clearAccount(error.message||'Could not load your account. Try signing in again.');}
}
function applyPermissions() {
  const admin=isAdmin();
  document.querySelector('#admin-dashboard').hidden=!admin;
  document.querySelector('#personal-dashboard').hidden=admin;
  if(!admin)document.querySelector('#expense-summary').innerHTML='<div class="strip-stat"><span>My expenses (all dates)</span><b>'+fmt(totalExpenses())+'</b></div>';
  document.querySelector('#expenses .page-actions p:last-child').textContent=admin?'Record expenses already paid, including those paid using capital.':'Record and view your own expenses. Contact Admin for corrections.';
  document.querySelectorAll('[data-view], [data-view-jump]').forEach(el=>{const view=el.dataset.view||el.dataset.viewJump;el.hidden=!admin&&!['dashboard','inventory','sales','expenses'].includes(view)});
  document.querySelectorAll('[data-open="stock-modal"],#export-data,#download-report').forEach(el=>el.hidden=!admin);
  document.querySelectorAll('[data-edit-stock],[data-delete-stock],[data-delete-sale],[data-delete-expense]').forEach(el=>el.hidden=!admin);
  document.querySelectorAll('#expenses th:nth-child(5),#expenses td:nth-child(5)').forEach(el=>el.hidden=!admin);
  document.querySelectorAll('#inventory th:nth-child(3),#inventory td:nth-child(3),#sales th:nth-child(5),#sales td:nth-child(5),#sales th:nth-child(6),#sales td:nth-child(6),#sales th:nth-child(7),#sales td:nth-child(7)').forEach(el=>el.hidden=!admin);
  document.querySelector('#inventory .page-actions p:last-child').textContent=admin?'Available laptops, their cost and selling price.':'Available laptops and selling prices. Adjust quantities after a physical stock count.';
  document.querySelector('#sales .page-actions p:last-child').textContent=admin?'Record sales and monitor the margin on each item.':'Record today’s sales and view your own sales history.';
  if(!admin)document.querySelector('#sales-summary').innerHTML=`<div class="strip-stat"><span>My sales collection (all dates)</span><b>${fmt(totalSales())}</b></div><div class="strip-stat"><span>My units sold (all dates)</span><b>${number(data.sales.reduce((n,s)=>n+s.quantity,0))}</b></div>`;
  document.querySelector('#sale-form [name=date]').readOnly=!admin;
  document.querySelectorAll('#inventory-body tr').forEach(row=>{
    const edit=row.querySelector('[data-edit-stock]');if(!edit)return;
    const button=document.createElement('button');button.type='button';button.className='row-button edit-button';button.textContent='Adjust stock';button.dataset.adjustStock=edit.dataset.editStock;edit.parentNode.append(button);
  });
}
// Keep one mutation in flight; no optimistic business-data writes.
async function mutate(action, onSuccess, message) {
  if(busy||!member)return;
  busy=true;
  const userId=sessionUser;
  document.querySelectorAll('dialog button, #refresh-data').forEach(b=>b.disabled=true);
  try {
    await action();
    if(sessionUser!==userId)return;
    onSuccess?.();
    try {await refreshData();toast(message)}
    catch {toast('Saved to the database. Refresh to load the latest records.');document.querySelector('.sidebar-footer').textContent='Saved · refresh needed';}
  } catch(error) {if(sessionUser===userId)toast(error.message||'Could not save. Check your connection and retry.');}
  finally {busy=false;document.querySelectorAll('dialog button, #refresh-data').forEach(b=>b.disabled=false)}
}
let editingStockId=null, editingRevenueId=null, editingFundingId=null, editingCoverage=null, adjustment=null, pendingSale=null;
function prepareStockForm(item=null) {
  const form=document.querySelector('#stock-form');form.reset();editingStockId=item?.id||null;
  form.querySelector('h2').textContent=item?'Edit stock / purchase':'Add stock';
  form.elements.quantity.min=Math.max(1,item?item.sold-(item.adjustment||0):1);
  form.elements.date.value=businessDate();
  form.querySelector('.form-hint').textContent='Total cost = buying price × purchased quantity + transport. Cost corrections update profit reports. Use Adjust stock for physical count corrections.';
  if(item)for(const name of ['brand','model','screen','processor','ram','storage','quantity','buyingPrice','transport','sellingPrice','date'])form.elements[name].value=item[name];
  delete form.dataset.recordId;
}
function prepareRevenueForm(item=null) {
  const form=document.querySelector('#revenue-form');form.reset();editingRevenueId=item?.id||null;
  form.querySelector('h2').textContent=item?'Edit revenue':'Add revenue';form.elements.date.value=businessDate();
  if(item)for(const name of ['source','amount','note','date'])form.elements[name].value=item[name];
  delete form.dataset.recordId;
}
function renderRevenue() {
  document.querySelector('#revenue-summary').innerHTML=[['Other revenue',fmt(totalOtherRevenue())],['Expenses after other revenue',fmt(expensesAfterRevenue())],['Net profit / loss',fmt(netPosition())]].map(x=>`<div class="strip-stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
  document.querySelector('#revenue-body').innerHTML=[...data.revenue].sort((a,b)=>b.date.localeCompare(a.date)).map(r=>`<tr><td>${dateText(r.date)}</td><td><b>${escapeHtml(r.source)}</b></td><td>${escapeHtml(r.note||'—')}</td><td>${fmt(r.amount)}</td><td><button class="row-button edit-button" data-edit-revenue="${r.id}">Edit</button> <button class="row-button" data-delete-revenue="${r.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">No other revenue recorded yet.</td></tr>';
}
const closeSaved=form=>{form.closest('dialog').close();form.reset();delete form.dataset.recordId};
const formValues=form=>Object.fromEntries(new FormData(form));
const validAmount=n=>Number.isFinite(n)&&n>=0&&n<1e14;
document.querySelector('#stock-form').onsubmit=e=>{
  e.preventDefault();if(!isAdmin()||!e.target.reportValidity())return;
  const form=e.target,f=formValues(form),item=editingStockId?data.stock.find(s=>s.id===editingStockId):null;
  const values={...f,brand:f.brand.trim(),model:f.model.trim(),quantity:+f.quantity,buyingPrice:+f.buyingPrice,transport:+f.transport,sellingPrice:+f.sellingPrice};
  if(!values.brand||!values.model||!Number.isSafeInteger(values.quantity)||values.quantity<Math.max(1,item?item.sold-(item.adjustment||0):1)||['buyingPrice','transport','sellingPrice'].some(k=>!validAmount(values[k]))){toast('Enter valid stock quantities and amounts.');return}
  const id=editingStockId||(form.dataset.recordId ||= crypto.randomUUID());
  mutate(()=>database.saveStock(id,values),()=>closeSaved(form),'Stock saved');
};
document.querySelector('#sale-stock').onchange=e=>{
  const item=data.stock.find(s=>s.id===e.target.value);document.querySelector('#sale-form [name=unitPrice]').value=item?.sellingPrice??'';
  document.querySelector('#sale-availability').textContent=item?`${item.model}: ${available(item)} available${isAdmin()?` at a cost of ${fmt(unitCost(item))} each`:''}.`:'Choose an item to check available stock.';
};
document.querySelector('#sale-form').onsubmit=e=>{
  e.preventDefault();const form=e.target;if(!form.reportValidity())return;
  const f=formValues(form),sale={stockId:f.stockId,quantity:+f.quantity,unitPrice:+f.unitPrice,date:isAdmin()?f.date:businessDate()};
  if(!Number.isSafeInteger(sale.quantity)||sale.quantity<1||!validAmount(sale.unitPrice)){toast('Enter a valid quantity and price.');return}
  // Retain the exact request ID/payload after a network failure. Editing it first
  // requires resolving the old request, otherwise an ambiguous success could duplicate a sale.
  const signature=JSON.stringify(sale);
  if(pendingSale&&pendingSale.signature!==signature){toast('Retry the original sale to resolve its status before entering another.');return}
  pendingSale ||= {id:crypto.randomUUID(),signature};
  mutate(async()=>{try{return await database.recordSale(pendingSale.id,sale)}catch(error){if(error.code)pendingSale=null;throw error}},()=>{pendingSale=null;closeSaved(form)},'Sale recorded and stock updated');
};
for(const kind of ['expense','revenue'])document.querySelector(`#${kind}-form`).onsubmit=e=>{
  e.preventDefault();if(!member||(kind==='revenue'&&!isAdmin()))return;const form=e.target;if(!form.reportValidity())return;
  const f=formValues(form),values={...f,amount:+f.amount};
  if(!validAmount(values.amount)||(kind==='revenue'&&values.amount<=0)){toast('Enter a valid amount.');return}
  const label=kind==='revenue'?'source':'category';values[label]=f[label].trim();if(!values[label])return;
  const id=(kind==='revenue'&&editingRevenueId)||(form.dataset.recordId ||= crypto.randomUUID());
  mutate(()=>kind==='expense'&&!isAdmin()?database.recordExpense(id,values):database.saveEntry(kind==='revenue'?'dib_revenue':'dib_expenses',id,values),()=>closeSaved(form),'Record saved');
};
document.querySelector('#adjust-form').onsubmit=e=>{
  e.preventDefault();if(!adjustment||!e.target.reportValidity())return;const form=e.target,f=formValues(form);
  if(!Number.isSafeInteger(+f.remaining)||+f.remaining<0||!f.reason.trim())return;
  const current={...adjustment};
  mutate(()=>database.adjustStock(current.id,+f.remaining,current.expected,f.reason.trim()),()=>{adjustment=null;closeSaved(form)},'Stock adjustment recorded');
};
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!member||busy)return;
  if(b.dataset.adjustStock){const item=data.stock.find(s=>s.id===b.dataset.adjustStock);if(!item)return;adjustment={id:item.id,expected:available(item)};const form=document.querySelector('#adjust-form');form.reset();form.elements.remaining.value=available(item);document.querySelector('#adjust-item').textContent=`${item.brand} ${item.model} · currently ${available(item)} remaining`;document.querySelector('#adjust-modal').showModal();return}
  if(!isAdmin())return;
  if(b.dataset.editStock){const item=data.stock.find(s=>s.id===b.dataset.editStock);if(item){prepareStockForm(item);document.querySelector('#stock-modal').showModal()}return}
  if(b.dataset.editRevenue){const item=data.revenue.find(r=>r.id===b.dataset.editRevenue);if(item){prepareRevenueForm(item);document.querySelector('#revenue-modal').showModal()}return}
  if(b.dataset.deleteStock&&confirm('Remove this unused purchase? Items with sales or adjustment history cannot be removed.'))mutate(()=>database.deleteStock(b.dataset.deleteStock),null,'Stock removed');
  if(b.dataset.deleteSale&&confirm('Delete this sale and restore its stock quantity?'))mutate(()=>database.deleteSale(b.dataset.deleteSale),null,'Sale deleted and stock restored');
  for(const kind of ['Expense','Revenue'])if(b.dataset['delete'+kind]&&confirm('Delete this record?'))mutate(()=>database.deleteEntry(kind==='Expense'?'dib_expenses':'dib_revenue',b.dataset['delete'+kind]),null,'Record deleted');
});
document.querySelectorAll('.nav-link').forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll('[data-view-jump]').forEach(b=>b.onclick=()=>showView(b.dataset.viewJump));
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openModal(b.dataset.open));
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(!busy)b.closest('dialog').close()});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('cancel',e=>{if(busy)e.preventDefault()}));
document.querySelector('#mobile-menu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');
document.querySelector('#inventory-search').oninput=()=>{renderInventory();applyPermissions()};
document.querySelector('#stock-filter').onchange=()=>{renderInventory();applyPermissions()};
document.querySelector('#today').textContent=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Dar_es_Salaam',weekday:'short',day:'numeric',month:'short'}).format(new Date());
document.querySelector('#refresh-data').onclick=async()=>{try{await refreshData();toast('Latest records loaded')}catch(error){toast(error.message||'Refresh failed.');document.querySelector('.sidebar-footer').textContent='Refresh failed · showing last loaded records'}};
document.querySelector('#login-form').onsubmit=async e=>{
  e.preventDefault();if(!database)return;const button=document.querySelector('#login-button');button.disabled=true;
  const f=formValues(e.target);document.querySelector('#auth-status').textContent='Signing in…';
  try {const result=await database.check(database.client.auth.signInWithPassword({email:f.email.trim(),password:f.password}));e.target.elements.password.value='';await receiveSession(result.session)}
  catch(error){document.querySelector('#auth-status').textContent=error.message||'Sign-in failed.'}
  finally{button.disabled=false}
};
document.querySelector('#sign-out').onclick=async()=>{
  if(busy){toast('Wait for the current save to finish.');return}
  clearAccount('Signing out…');
  try{await database.check(database.client.auth.signOut({scope:'local'}));document.querySelector('#auth-status').textContent='Signed out.'}
  catch{document.querySelector('#auth-status').textContent='Could not clear the session. Reconnect and sign out again.'}
};
function csvEscape(value){let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return `"${s.replaceAll('"','""')}"`}
function download(name,content,type='text/csv'){const url=URL.createObjectURL(new Blob([content],{type})),a=Object.assign(document.createElement('a'),{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
document.querySelector('#download-report').onclick=()=>{if(!isAdmin())return;download('dib-stock-report.csv',[['DIB Stock Control Report'],['Generated',businessDate()],['Metric','Value'],['Sales revenue',totalSales()],['Gross profit',grossProfit()],['Other revenue',totalOtherRevenue()],['Expenses',totalExpenses()],['Net profit / loss',netPosition()],['Stock value',stockValue()],...financeExportRows(),...coverageExportRows()].map(r=>r.map(csvEscape).join(',')).join('\n'))};
document.querySelector('#export-data').onclick=()=>{if(isAdmin())download('dib-stock-backup.json',JSON.stringify({exportedAt:new Date().toISOString(),...data},null,2),'application/json')};
try {
  database=new DibDatabase(window.DIB_CONFIG);
  database.client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT')clearAccount();
    // Only a successful login-form submission may open this page's account.
    // Ignore restored sessions and sign-ins broadcast by another tab.
  });
  document.querySelector('#login-button').disabled=false;
  document.querySelector('#auth-status').textContent='Sign in with your DIB account.';
} catch(error){document.querySelector('#auth-status').textContent=error.message;}
// Refresh across devices and across Tanzania midnight; errors never overwrite data.
let lastBusinessDate=businessDate();
setInterval(async()=>{
  if(!member||busy||document.hidden||document.querySelector('dialog[open]'))return;
  const changed=businessDate()!==lastBusinessDate;lastBusinessDate=businessDate();
  if(changed&&!isAdmin())renderAll();
  try{await refreshData()}catch{document.querySelector('.sidebar-footer').textContent='Offline · showing last loaded records';}
},30000);
renderAll();

document.querySelector('#personal-period').onchange=renderPersonalDashboard;
function renderAdjustments(){
  document.querySelector('#adjustment-history').innerHTML=[...data.adjustments].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(a=>{
    const item=data.stock.find(s=>s.id===a.stock_id);
    return `<tr><td>${escapeHtml(new Date(a.created_at).toLocaleString('en-GB',{timeZone:'Africa/Dar_es_Salaam'}))}</td><td>${escapeHtml(item?.model||a.stock_id)}</td><td>${a.previous_remaining} → ${a.new_remaining}</td><td>${escapeHtml(a.reason)}</td><td>${escapeHtml(a.created_by||'—')}</td></tr>`;
  }).join('')||'<tr><td colspan="5" class="empty">No stock adjustments recorded.</td></tr>';
}

function fundingLabel(type){return {contribution:'Capital invested',withdrawal:'Owner withdrawal',loan_received:'Loan received',loan_repayment:'Loan principal repaid'}[type]||type}
function expenseCoverageCell(expense){
  if(!isAdmin())return '';
  if(!data.coverageAvailable)return '<small>Coverage update needed</small>';
  const row=(data.coverage||[]).find(c=>c.expense_id===expense.id)||{};
  const total=Object.keys(coverageSources).reduce((n,k)=>n+(row[k]||0),0);
  const lines=Object.entries(coverageSources).filter(([key])=>row[key]>0).map(([key,label])=>`${escapeHtml(label)}: ${fmt(row[key])}`).join('<br>');
  return `<div class="coverage-cell"><b>${fmt(total)} of ${fmt(expense.amount)} assigned</b><small>${lines}${total<expense.amount?`<br>Source not recorded: ${fmt(expense.amount-total)}`:''}${total>expense.amount?'<br>Review: exceeds expense amount':''}</small><button class="row-button edit-button" data-expense-coverage="${expense.id}">Coverage</button></div>`;
}
function coverageMetrics(){
  const c=coverageSummary(data),f=financialSummary(data),valid=data.coverageAvailable&&!f.missingCosts;
  return [
    ['Expense sources recorded',data.coverageAvailable?c.assigned:null],['Source not recorded',data.coverageAvailable?c.unassigned:null],
    ['Expenses from sales profit',data.coverageAvailable?c.profit:null],['Expenses from recovered stock capital',data.coverageAvailable?c.stock_capital:null],
    ['Sales profit left after allocations',valid?c.profitRemaining:null],['Recovered stock capital left after allocations',valid?c.capitalRemaining:null],
    ['Sales receipts left after allocations',valid?c.salesRemaining:null],['Expenses from other income',data.coverageAvailable?c.other_income:null],
    ['Expenses from owner capital',data.coverageAvailable?c.owner_capital:null],['Expenses from borrowed money',data.coverageAvailable?c.borrowed:null]
  ];
}
function coverageExportRows(){return [['Expense coverage scope','Sources of already-paid expenses. Sales balances are before restocking, withdrawals and loan repayments.'],...coverageMetrics().map(([label,value])=>[label,value===null?'Unavailable':value])];}
function renderCoverageSummary(){
  const panel=document.querySelector('#coverage-overview');panel.hidden=!isAdmin();
  if(!isAdmin()){document.querySelector('#coverage-cards').innerHTML='';document.querySelector('#coverage-status').textContent='';return}
  const c=coverageSummary(data), f=financialSummary(data);
  document.querySelector('#coverage-status').textContent=!data.coverageAvailable?'Expense coverage requires the database update. Existing expense payments remain unchanged.':
    f.missingCosts?'Purchase costs are missing; sales balances are unavailable.':
    c.needsReview?'Some allocations exceed their expense amount or current sales funds. Review coverage after any sale or purchase correction.':
    c.unassigned>0?`${fmt(c.unassigned)} of paid expenses still needs its source recorded. Sales balances are provisional until every expense is assigned.`:
    'Every paid expense has its source recorded. Coverage identifies payments; it does not deduct them again.';
  document.querySelector('#coverage-cards').innerHTML=coverageMetrics().map(([label,value])=>`<article class="report-card ${value!==null&&value<0?'negative':''}"><span>${label}</span><strong>${value===null?'Unavailable':fmt(value)}</strong></article>`).join('');
}
function openExpenseCoverage(id){
  if(!isAdmin()||!data.coverageAvailable)return;
  const expense=data.expenses.find(e=>e.id===id);if(!expense)return;
  const row=(data.coverage||[]).find(c=>c.expense_id===id)||{};
  const c=coverageSummary(data),form=document.querySelector('#coverage-form');
  editingCoverage={id,amount:expense.amount,revision:row.revision||0,
    profitAvailable:Math.round((c.profitRemaining+(row.profit||0))*100)/100,
    capitalAvailable:Math.round((c.capitalRemaining+(row.stock_capital||0))*100)/100,
    salesAvailable:c.salesRemaining+(row.profit||0)+(row.stock_capital||0)};
  form.reset();for(const key of Object.keys(coverageSources))form.elements[key].value=row[key]||0;
  document.querySelector('#coverage-expense').textContent=`${expense.category} · ${dateText(expense.date)} · Paid ${fmt(expense.amount)}`;
  document.querySelector('#coverage-available').textContent=`Available to assign to this expense: sales profit ${fmt(editingCoverage.profitAvailable)}; recovered stock capital ${fmt(editingCoverage.capitalAvailable)}. Recovered capital is the cost portion of sales receipts, including purchase transport.`;
  document.querySelector('#coverage-error').textContent='';updateCoveragePreview();document.querySelector('#coverage-modal').showModal();
}
function updateCoveragePreview(){
  if(!editingCoverage)return;
  const form=document.querySelector('#coverage-form'),values=Object.fromEntries(Object.keys(coverageSources).map(k=>[k,Number(form.elements[k].value)]));
  const total=Object.values(values).reduce((a,b)=>a+b,0),c=editingCoverage;
  document.querySelector('#coverage-preview').textContent=`Assigned: ${fmt(total)}. Source not recorded: ${fmt(Math.max(0,c.amount-total))}. After this allocation: profit left ${fmt(c.profitAvailable-values.profit)}; recovered stock capital left ${fmt(c.capitalAvailable-values.stock_capital)}; sales receipts left ${fmt(c.salesAvailable-values.profit-values.stock_capital)}.`;
}
document.querySelector('#coverage-form').oninput=updateCoveragePreview;
document.querySelector('#coverage-form').onsubmit=e=>{
  e.preventDefault();if(!isAdmin()||!data.coverageAvailable||!editingCoverage||!e.target.reportValidity())return;
  const form=e.target,c={...editingCoverage},values=Object.fromEntries(Object.keys(coverageSources).map(k=>[k,Number(form.elements[k].value)]));
  const cents=n=>Math.round(n*100),total=Object.values(values).reduce((n,v)=>n+cents(v),0);
  let error='';
  if(Object.values(values).some(v=>!validAmount(v)||Math.abs(v*100-cents(v))>0.001))error='Use nonnegative amounts with at most two decimals.';
  else if(total>cents(c.amount))error='Assigned sources cannot exceed the paid expense amount.';
  else if(financialSummary(data).missingCosts)error='Restore missing purchase costs before assigning sales funds.';
  else if(cents(values.profit)>cents(c.profitAvailable)||cents(values.stock_capital)>cents(c.capitalAvailable))error='This allocation exceeds unassigned sales profit or recovered stock capital.';
  document.querySelector('#coverage-error').textContent=error;if(error)return;
  mutate(()=>database.saveCoverage(c.id,c.revision,c.amount,values),()=>{editingCoverage=null;closeSaved(form)},'Expense sources saved; payment was not deducted again');
};
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-expense-coverage]');if(button&&!busy)openExpenseCoverage(button.dataset.expenseCoverage);
});
function financeMetrics(){
  const f=financialSummary(data), ready=data.financeAvailable&&f.hasCapital&&!f.missingCosts;
  return [
    ['Capital invested',data.financeAvailable?f.contributions:null,'All recorded owner contributions'],
    ['Owner withdrawals',data.financeAvailable?f.withdrawals:null,'Money taken out; not an expense'],
    ['Paid expenses',f.expenseTotal,'Already deducted once, including payments using capital'],
    ['Net profit / loss',f.missingCosts?null:f.netProfit,'Sales margin + other income − paid expenses'],
    ['Expenses beyond earnings',f.missingCosts?null:f.expensesBeyondEarnings,'Paid expenses exceeding positive sales margin and other income; funded by capital or borrowing'],
    ['Cash remaining',ready?f.cash:null,'Combined cash, bank and mobile money'],
    ['Stock at cost',f.missingCosts?null:f.inventory,'Remaining physical inventory'],
    ['Outstanding loan principal',data.financeAvailable?f.debt:null,'Loans received − principal repaid'],
    ['Recorded net worth',ready?f.netWorth:null,'Cash + stock at cost − recorded loans'],
    ['Stock adjustment value',f.missingCosts?null:f.adjustmentValue,'Inventory gains / losses; no cash movement'],
    ['Result including stock changes',f.missingCosts?null:f.businessResult,'Net profit / loss + stock adjustment value']
  ];
}
function renderFinances(){
  const status=document.querySelector('#finance-status'), cards=document.querySelector('#finance-cards');
  if(!isAdmin()){
    status.textContent='';cards.innerHTML='';document.querySelector('#funding-body').innerHTML='';return;
  }
  const f=financialSummary(data), warnings=[];
  if(!data.financeAvailable)warnings.push('Capital tracking is not available yet. The database update must be applied before recording funds.');
  else if(!f.hasCapital)warnings.push('Start by recording your initial capital and every later contribution. Cash and net worth will appear after your first capital entry.');
  else warnings.push('Based on all recorded transactions. Complete all historical capital, purchases, expenses, withdrawals and loans, then compare cash with your actual balances.');
  if(f.legacyLoanExpenses)warnings.push(`${f.legacyLoanExpenses} old “Loan payment” expense(s) need review: profit is provisional until principal and interest are separated. Replace only the principal portion with a loan principal repayment; keep interest as an expense. Do not record the same payment twice.`);
  if(data.financeAvailable&&f.hasCapital&&f.cash<0)warnings.push('Calculated cash is negative. Check for missing capital or loans, duplicate expenses, or incorrect purchases.');
  if(f.debt<0)warnings.push('Loan repayments exceed recorded borrowing. Add missing loan receipts or correct repayment entries.');
  if(f.missingCosts)warnings.push('Some purchase costs are missing. Cash and net worth are unavailable until costs are restored.');
  status.textContent=warnings.join(' ');
  cards.innerHTML=financeMetrics().map(([label,value,hint])=>`<article class="report-card ${value!==null&&value<0?'negative':''}"><span>${escapeHtml(label)}</span><strong>${value===null?'Not set up':fmt(value)}</strong><small>${escapeHtml(hint)}</small></article>`).join('');
  document.querySelectorAll('[data-open="funding-modal"]').forEach(b=>b.disabled=!data.financeAvailable);
  document.querySelector('#funding-body').innerHTML=[...(data.funding||[])].sort((a,b)=>b.date.localeCompare(a.date)).map(f=>`<tr><td>${dateText(f.date)}</td><td>${escapeHtml(fundingLabel(f.type))}</td><td>${escapeHtml(f.note||'—')}</td><td>${fmt(f.amount)}</td><td><button class="row-button edit-button" data-edit-funding="${f.id}">Edit</button> <button class="row-button" data-delete-funding="${f.id}">Delete mistake</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">No capital, withdrawals or loans recorded.</td></tr>';
}
function financeExportRows(){
  if(!data.financeAvailable)return [['Business position','Unavailable: database update needed']];
  const f=financialSummary(data);
  return [['Business position scope','All recorded cash, inventory and loans; historical funding must be complete'],
    ['Loan payment expenses requiring review',f.legacyLoanExpenses],
    ...financeMetrics().map(([label,value])=>[label,value===null?'Not set up':value])];
}
function prepareFundingForm(item=null){
  const form=document.querySelector('#funding-form');form.reset();editingFundingId=item?.id||null;
  delete form.dataset.recordId;
  form.querySelector('h2').textContent=item?'Edit funds':'Record funds';
  form.elements.date.value=businessDate();form.elements.date.max=businessDate();
  if(item)for(const name of ['type','amount','date','note'])form.elements[name].value=item[name];
}
document.querySelector('#funding-form').onsubmit=e=>{
  e.preventDefault();if(!isAdmin()||!data.financeAvailable||!e.target.reportValidity())return;
  const form=e.target,f=formValues(form),values={type:f.type,amount:+f.amount,date:f.date,note:f.note.trim()};
  if(!['contribution','withdrawal','loan_received','loan_repayment'].includes(values.type)||!validAmount(values.amount)||values.amount<=0||values.date>businessDate()){toast('Enter a positive amount and a date on or before today.');return}
  const id=editingFundingId||(form.dataset.recordId ||= crypto.randomUUID());
  mutate(()=>database.saveEntry('dib_funding',id,values),()=>{editingFundingId=null;closeSaved(form)},'Business funds saved');
};
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!isAdmin()||busy||!data.financeAvailable)return;
  if(b.dataset.editFunding){const item=data.funding.find(f=>f.id===b.dataset.editFunding);if(item){prepareFundingForm(item);document.querySelector('#funding-modal').showModal()}}
  if(b.dataset.deleteFunding&&confirm('Delete this mistaken funds entry? This changes cash and business position. Actual payments should remain recorded.'))mutate(()=>database.deleteEntry('dib_funding',b.dataset.deleteFunding),null,'Mistaken funds entry deleted');
});
