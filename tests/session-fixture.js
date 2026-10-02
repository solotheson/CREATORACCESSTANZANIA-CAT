// Browser fixture only. This script never contacts Supabase.
window.DibDatabase=class {
  constructor(){
    this.role=location.pathname.endsWith('/user')?'user':'admin';
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam'}).format(new Date());
    this.data={stock:[{id:'s1',brand:'HP',model:'QA <test>',screen:'14 inch',processor:'i5',ram:'8GB',storage:'256GB',quantity:5,sold:1,adjustment:0,buyingPrice:100,transport:25,sellingPrice:200,date:today}],sales:[{id:'x1',stockId:'s1',model:'QA <test>',quantity:1,unitPrice:200,date:today,created_by:'fixture'}],expenses:[],revenue:[],adjustments:[],funding:[],financeAvailable:true,coverage:[],coverageAvailable:true};
    this.client={auth:{onAuthStateChange:callback=>setTimeout(()=>callback('INITIAL_SESSION',{user:{id:'fixture'}}),0),signInWithPassword:async()=>({data:{session:{user:{id:'fixture'}}},error:null}),signOut:async()=>({data:null,error:null})}};
  }
  async load(){const data=structuredClone(this.data);if(this.role==='user'){data.funding=[];data.financeAvailable=false;data.coverage=[];data.coverageAvailable=false}if(this.role==='user')data.stock.forEach(s=>{delete s.buyingPrice;delete s.transport});return {member:{id:'fixture',display_name:'Test '+this.role,role:this.role,active:true},data}}
  async check(p){const result=await p;if(result.error)throw result.error;return result.data}
  async saveStock(id,item){const found=this.data.stock.find(s=>s.id===id);if(found)Object.assign(found,item);else this.data.stock.push({id,sold:0,adjustment:0,...item})}
  async recordSale(id,sale){if(this.data.sales.some(s=>s.id===id))return;const item=this.data.stock.find(s=>s.id===sale.stockId);if(sale.quantity>item.quantity+item.adjustment-item.sold)throw Object.assign(new Error('Not enough stock'),{code:'P0001'});item.sold+=sale.quantity;this.data.sales.push({id,model:item.model,...sale})}
  async adjustStock(id,remaining,expected,reason){const item=this.data.stock.find(s=>s.id===id);if(item.quantity+item.adjustment-item.sold!==expected)throw new Error('Stock changed. Refresh before adjusting it.');item.adjustment+=remaining-expected;this.data.adjustments.push({id:crypto.randomUUID(),stock_id:id,previous_remaining:expected,new_remaining:remaining,reason,created_by:'fixture',created_at:new Date().toISOString()})}
  async recordExpense(id,values){return this.saveEntry('dib_expenses',id,{...values,created_by:'fixture'})}
  async saveCoverage(id,revision,amount,values){
    const expense=this.data.expenses.find(e=>e.id===id),rows=this.data.coverage,old=rows.find(r=>r.expense_id===id);
    if(!expense||expense.amount!==amount||(old?.revision||0)!==revision)throw new Error('Expense or coverage changed. Reopen coverage.');
    if(Object.values(values).reduce((n,v)=>n+v,0)>amount)throw new Error('Coverage exceeds expense amount');
    const next={expense_id:id,...values,revision:revision+1};if(old)Object.assign(old,next);else rows.push(next);
  }
  async saveEntry(table,id,values){const rows=table==='dib_funding'?this.data.funding:table==='dib_revenue'?this.data.revenue:this.data.expenses;const item=rows.find(r=>r.id===id);if(item)Object.assign(item,values);else rows.push({id,...values})}
  async deleteEntry(table,id){const key=table==='dib_funding'?'funding':table==='dib_revenue'?'revenue':'expenses';this.data[key]=this.data[key].filter(r=>r.id!==id)}
};
