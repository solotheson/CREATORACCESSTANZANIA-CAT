'use strict';
let data={stock:[],sales:[],expenses:[],revenue:[],adjustments:[]};
let member=null, database=null, sessionUser=null, busy=false, loadGeneration=0;
const isAdmin=()=>member?.role==='admin';
const businessDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const fmt=n=>new Intl.NumberFormat('en-TZ',{style:'currency',currency:'TZS',maximumFractionDigits:0}).format(Math.round(n||0));const number=n=>new Intl.NumberFormat('en-TZ').format(Math.round(n||0));const unitCost=s=>s.buyingPrice+(s.transport/s.quantity);const available=s=>s.quantity+(s.adjustment||0)-s.sold;const totalSales=()=>data.sales.reduce((sum,s)=>sum+s.quantity*s.unitPrice,0);const saleCost=s=>{const item=data.stock.find(x=>x.id===s.stockId);return item?unitCost(item)*s.quantity:0};const totalCostSold=()=>data.sales.reduce((sum,s)=>sum+saleCost(s),0);const totalExpenses=()=>data.expenses.reduce((sum,e)=>sum+e.amount,0);const grossProfit=()=>totalSales()-totalCostSold();const stockValue=()=>data.stock.reduce((sum,s)=>sum+available(s)*unitCost(s),0);const potentialProfit=()=>data.stock.reduce((sum,s)=>sum+available(s)*(s.sellingPrice-unitCost(s)),0);
const totalOtherRevenue=()=>data.revenue.reduce((sum,r)=>sum+r.amount,0);
const netPosition=()=>grossProfit()+totalOtherRevenue()-totalExpenses();
const expensesAfterRevenue=()=>Math.max(0,totalExpenses()-totalOtherRevenue());
const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function toast(message){const t=document.querySelector('#toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500)}function dateText(d){return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(new Date(`${d}T12:00:00`))}
function renderDashboard(){const units=data.stock.reduce((sum,s)=>sum+available(s),0),net=netPosition();document.querySelector('#overview-cards').innerHTML=[['Available stock',number(units),'Across '+data.stock.length+' laptop models'],['Stock value',fmt(stockValue()),'At purchase cost'],['Sales revenue',fmt(totalSales()),data.sales.length+' recorded sales'],['Net position',fmt(net),'Includes other revenue and expenses']].map((c,i)=>`<article class="metric"><span class="metric-label">${c[0]}</span><strong>${c[1]}</strong><small class="${i===3&&net>=0?'good':''}">${c[2]}</small></article>`).join('');const max=Math.max(...data.stock.map(available),1);document.querySelector('#stock-bars').innerHTML=data.stock.map(s=>`<div class="stock-row"><b>${escapeHtml(s.model)}</b><div class="bar"><span style="width:${available(s)/max*100}%"></span></div><em>${available(s)} left</em></div>`).join('');const low=data.stock.filter(s=>available(s)<=3);document.querySelector('#low-stock').innerHTML=low.length?low.map(s=>`<div class="low-item"><div><b>${escapeHtml(s.brand)} ${escapeHtml(s.model)}</b><small>${escapeHtml(s.processor)} · ${escapeHtml(s.ram)}</small></div><span class="badge ${available(s)===0?'out':''}">${available(s)===0?'Out of stock':available(s)+' left'}</span></div>`).join(''):'<p class="empty">Everything is well stocked.</p>';const activities=[...data.sales.map(s=>({type:'sale',date:s.date,title:`Sold ${s.quantity} × ${escapeHtml(s.model)}`,value:s.quantity*s.unitPrice})),...data.revenue.map(r=>({type:'revenue',date:r.date,title:escapeHtml(r.source),value:r.amount})),...data.expenses.map(e=>({type:'expense',date:e.date,title:escapeHtml(e.category),value:e.amount}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);document.querySelector('#recent-activity').innerHTML=activities.map(a=>`<div class="activity"><div class="activity-left"><span class="activity-sign ${a.type==='expense'?'expense':''}">${a.type==='expense'?'−':'↗'}</span><div><b>${a.title}</b><small>${dateText(a.date)}</small></div></div><span class="activity-value">${a.type==='expense'?'−':'+'}${fmt(a.value)}</span></div>`).join('')||'<p class="empty">No transactions yet.</p>';document.querySelector('#potential-profit').textContent=fmt(potentialProfit())}
function renderInventory(){const q=document.querySelector('#inventory-search').value.toLowerCase(),filter=document.querySelector('#stock-filter').value;const rows=data.stock.filter(s=>`${escapeHtml(s.brand)} ${escapeHtml(s.model)} ${escapeHtml(s.processor)}`.toLowerCase().includes(q)).filter(s=>filter==='all'||(filter==='in'&&available(s)>3)||(filter==='low'&&available(s)>0&&available(s)<=3)||(filter==='out'&&available(s)===0));document.querySelector('#inventory-body').innerHTML=rows.map(s=>{const count=available(s),state=count===0?'out':count<=3?'low':'';return `<tr><td><b>${escapeHtml(s.brand)} ${escapeHtml(s.model)}</b></td><td><span class="specs">${escapeHtml(s.screen)} · ${escapeHtml(s.processor)} · ${escapeHtml(s.ram)}/${escapeHtml(s.storage)}</span></td><td>${fmt(unitCost(s))}</td><td>${fmt(s.sellingPrice)}</td><td><span class="status ${state}">${count===0?'Out':count+' in stock'}</span></td><td>${fmt(count*s.sellingPrice)}</td><td><button class="row-button edit-button" data-edit-stock="${s.id}">Edit</button> <button class="row-button" data-delete-stock="${s.id}">Remove</button></td></tr>`}).join('')||'<tr><td colspan="7" class="empty">No items match your search.</td></tr>'}
function renderSales(){document.querySelector('#sales-summary').innerHTML=[['Revenue',fmt(totalSales())],['Gross profit',fmt(grossProfit())],['Average sale',fmt(data.sales.length?totalSales()/data.sales.length:0)]].map(x=>`<div class="strip-stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');document.querySelector('#sales-body').innerHTML=[...data.sales].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>`<tr><td>${dateText(s.date)}</td><td><b>${escapeHtml(s.model)}</b></td><td>${s.quantity}</td><td>${fmt(s.quantity*s.unitPrice)}</td><td>${fmt(saleCost(s))}</td><td>${fmt(s.quantity*s.unitPrice-saleCost(s))}</td><td><button class="row-button" data-delete-sale="${s.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No sales recorded yet.</td></tr>'}
function renderPurchases(){document.querySelector('#purchases-body').innerHTML=[...data.stock].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>`<tr><td>${dateText(s.date)}</td><td><b>${escapeHtml(s.brand)} ${escapeHtml(s.model)}</b></td><td>${s.quantity}</td><td>${fmt(s.buyingPrice)}</td><td>${fmt(s.transport)}</td><td>${fmt(unitCost(s)*s.quantity)}</td><td><button class="row-button edit-button" data-edit-stock="${s.id}">Edit</button></td></tr>`).join('')}
function renderExpenses(){document.querySelector('#expense-summary').innerHTML=[['Total expenses',fmt(totalExpenses())],['Other revenue',fmt(totalOtherRevenue())],['Expenses after other revenue',fmt(expensesAfterRevenue())],['Net after expenses',fmt(netPosition())]].map(x=>`<div class="strip-stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');document.querySelector('#expenses-body').innerHTML=[...data.expenses].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr><td>${dateText(e.date)}</td><td><b>${escapeHtml(e.category)}</b></td><td>${escapeHtml(e.note||'—')}</td><td>${fmt(e.amount)}</td><td><button class="row-button" data-delete-expense="${e.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">No expenses recorded yet.</td></tr>'}
function renderReports(){const invested=data.stock.reduce((sum,s)=>sum+unitCost(s)*s.quantity,0),net=netPosition();document.querySelector('#report-cards').innerHTML=[['Total purchase cost',fmt(invested),'All stock purchases'],['Stock at selling price',fmt(data.stock.reduce((sum,s)=>sum+available(s)*s.sellingPrice,0)),'Remaining inventory'],['Gross profit',fmt(grossProfit()),'Sales less sold stock cost'],['Other revenue',fmt(totalOtherRevenue()),'Extra income received'],['Expenses after other revenue',fmt(expensesAfterRevenue()),'Remaining expenses to cover'],['Operating expenses',fmt(totalExpenses()),'Rent, wages, loan and other'],['Net position',fmt(net),'Sales profit + other revenue − expenses',net>=0],['Potential remaining profit',fmt(potentialProfit()),'If current stock sells at set prices',true]].map(x=>`<article class="report-card ${x[3]?'positive':''}"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join('')}
function populateSaleSelect(){const select=document.querySelector('#sale-stock'),selected=select.value;select.innerHTML='<option value="">Choose stock item</option>'+data.stock.filter(s=>available(s)>0).map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${escapeHtml(s.brand)} ${escapeHtml(s.model)} — ${available(s)} available</option>`).join('')}
function renderAll(){renderDashboard();renderInventory();renderSales();renderPurchases();renderExpenses();renderRevenue();renderReports();populateSaleSelect();renderAdjustments();applyPermissions()}function openModal(id){if(!member || (id!=='sale-modal'&&!isAdmin()))return;document.querySelector(`#${id}`).showModal();if(id==='stock-modal')prepareStockForm();if(id==='revenue-modal')prepareRevenueForm();if(id==='sale-modal')document.querySelector('#sale-form [name=date]').value=businessDate();if(id==='expense-modal')document.querySelector('#expense-form [name=date]').value=businessDate()}function showView(view){if(!isAdmin()&&!['inventory','sales'].includes(view))view='inventory';document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===view));document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelector('#page-title').textContent=view==='dashboard'?'DIB Stock Control':view==='revenue'?'Other Revenue':view[0].toUpperCase()+view.slice(1);document.querySelector('.sidebar').classList.remove('open');window.scrollTo(0,0)}

// Account lifecycle: clear every rendered record before another account can load.
function clearAccount(message='Sign in with your DIB account.') {
  loadGeneration++;
  member=null; sessionUser=null;
  data={stock:[],sales:[],expenses:[],revenue:[],adjustments:[]};
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  document.querySelectorAll('form').forEach(f=>{f.reset();delete f.dataset.recordId});
  editingStockId=null; editingRevenueId=null; adjustment=null; pendingSale=null;
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
    showView(isAdmin()?'dashboard':'inventory');
  } catch(error) {if(sessionUser===next)clearAccount(error.message||'Could not load your account. Try signing in again.');}
}
function applyPermissions() {
  const admin=isAdmin();
  document.querySelectorAll('[data-view], [data-view-jump]').forEach(el=>{const view=el.dataset.view||el.dataset.viewJump;el.hidden=!admin&&!['inventory','sales'].includes(view)});
  document.querySelectorAll('[data-open="stock-modal"],#export-data,#download-report').forEach(el=>el.hidden=!admin);
  document.querySelectorAll('[data-edit-stock],[data-delete-stock],[data-delete-sale]').forEach(el=>el.hidden=!admin);
  document.querySelectorAll('#inventory th:nth-child(3),#inventory td:nth-child(3),#sales th:nth-child(5),#sales td:nth-child(5),#sales th:nth-child(6),#sales td:nth-child(6),#sales th:nth-child(7),#sales td:nth-child(7)').forEach(el=>el.hidden=!admin);
  document.querySelector('#inventory .page-actions p:last-child').textContent=admin?'Available laptops, their cost and selling price.':'Available laptops and selling prices. Adjust quantities after a physical stock count.';
  document.querySelector('#sales .page-actions p:last-child').textContent=admin?'Record sales and monitor the margin on each item.':'Record and view today’s sales (Tanzania time).';
  if(!admin)document.querySelector('#sales-summary').innerHTML=`<div class="strip-stat"><span>Today’s sales</span><b>${fmt(totalSales())}</b></div><div class="strip-stat"><span>Units sold today</span><b>${number(data.sales.reduce((n,s)=>n+s.quantity,0))}</b></div>`;
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
let editingStockId=null, editingRevenueId=null, adjustment=null, pendingSale=null;
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
  document.querySelector('#revenue-summary').innerHTML=[['Other revenue',fmt(totalOtherRevenue())],['Expenses after other revenue',fmt(expensesAfterRevenue())],['Net position',fmt(netPosition())]].map(x=>`<div class="strip-stat"><span>${x[0]}</span><b>${x[1]}</b></div>`).join('');
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
  e.preventDefault();if(!isAdmin())return;const form=e.target;if(!form.reportValidity())return;
  const f=formValues(form),values={...f,amount:+f.amount};
  if(!validAmount(values.amount)||(kind==='revenue'&&values.amount<=0)){toast('Enter a valid amount.');return}
  const label=kind==='revenue'?'source':'category';values[label]=f[label].trim();if(!values[label])return;
  const id=(kind==='revenue'&&editingRevenueId)||(form.dataset.recordId ||= crypto.randomUUID());
  mutate(()=>database.saveEntry(kind==='revenue'?'dib_revenue':'dib_expenses',id,values),()=>closeSaved(form),'Record saved');
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
document.querySelector('#download-report').onclick=()=>{if(!isAdmin())return;download('dib-stock-report.csv',[['DIB Stock Control Report'],['Generated',businessDate()],['Metric','Value'],['Sales revenue',totalSales()],['Gross profit',grossProfit()],['Other revenue',totalOtherRevenue()],['Expenses',totalExpenses()],['Net position',netPosition()],['Stock value',stockValue()]].map(r=>r.map(csvEscape).join(',')).join('\n'))};
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
  if(changed&&!isAdmin()){data.sales=[];renderAll()}
  try{await refreshData()}catch{document.querySelector('.sidebar-footer').textContent='Offline · showing last loaded records';}
},30000);
renderAll();

function renderAdjustments(){
  document.querySelector('#adjustment-history').innerHTML=[...data.adjustments].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(a=>{
    const item=data.stock.find(s=>s.id===a.stock_id);
    return `<tr><td>${escapeHtml(new Date(a.created_at).toLocaleString('en-GB',{timeZone:'Africa/Dar_es_Salaam'}))}</td><td>${escapeHtml(item?.model||a.stock_id)}</td><td>${a.previous_remaining} → ${a.new_remaining}</td><td>${escapeHtml(a.reason)}</td><td>${escapeHtml(a.created_by||'—')}</td></tr>`;
  }).join('')||'<tr><td colspan="5" class="empty">No stock adjustments recorded.</td></tr>';
}
