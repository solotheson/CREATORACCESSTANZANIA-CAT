const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const context={window:{}};vm.createContext(context);
for(const file of ['financial-summary','pdf-reports'])vm.runInContext(fs.readFileSync(`assets/js/${file}.js`,'utf8'),context);
const reports=context.window.DibPdfReports;
const fixture=()=>({stock:[{id:'s',brand:'HP',model:'EliteBook',quantity:5,sold:2,adjustment:-1,buyingPrice:100,transport:50,sellingPrice:200}],sales:[{id:'sale',stockId:'s',model:'EliteBook',quantity:2,unitPrice:200,date:'2026-10-05'}],expenses:[{id:'e',amount:40,date:'2026-10-05',category:'Rent',note:'Paid'}],revenue:[],funding:[{type:'contribution',amount:1000,date:'2026-10-04'}],coverage:[{expense_id:'e',profit:30}],coverageAvailable:true,adjustments:[]});
test('inventory exports filtered stock with transport cost, adjustments and correct totals',()=>{
  const d=fixture();const report=reports.buildInventory({data:d,admin:true,scope:'Low stock'});
  const table=report.sections[1];
  assert.equal(report.scope,'Low stock');assert.equal(table.body[0][4],'2');
  assert.equal(table.body[0][5],'TZS 110');assert.equal(table.foot[6],'TZS 220');assert.equal(table.foot[8],'TZS 400');
  assert.equal(reports.buildInventory({data:d,admin:true,stock:[]}).sections[1].body.length,0);
});
test('staff inventory never exports purchase costs and cannot export business report',()=>{
  const d=fixture();const report=reports.buildInventory({data:d,admin:false});
  const table=report.sections[1];assert.equal(table.head.length,7);assert.ok(!table.head.some(v=>v.includes('cost')));
  assert.ok(!JSON.stringify(table).includes('TZS 110'));
  assert.throws(()=>reports.buildBusiness({data:d,admin:false}),/admins only/);
});
test('business exports details and unassigned expense amounts without deducting coverage again',()=>{
  const d=fixture();const report=reports.buildBusiness({data:d,admin:true,metrics:[['Cash remaining',0,'Entered actual balance - session only']]});
  assert.equal(report.sections[0].body.find(row=>row[0]==='Total products sold')[1],'2');
  assert.equal(report.sections[1].body[0][1],'TZS 0');
  const sales=report.sections.find(s=>s.title==='Sales detail');assert.equal(sales.foot[4],'TZS 400');assert.equal(sales.foot[5],'TZS 220');
  const expenses=report.sections.find(s=>s.title==='Paid expenses and funding sources');
  assert.match(expenses.body[0][4],/Sales profit: TZS 30/);assert.match(expenses.body[0][4],/Unassigned: TZS 10/);assert.equal(expenses.foot[3],'TZS 40');
});
test('missing purchase costs are reported as unavailable',()=>{
  const d=fixture();delete d.stock[0].buyingPrice;
  const report=reports.buildBusiness({data:d,admin:true});
  assert.equal(report.sections[0].body.find(row=>row[0]==='Gross profit')[1],'Unavailable');
  assert.equal(report.sections[2].body[0][5],'Unavailable');
});
