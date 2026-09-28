/* Supabase is bundled locally; business records are never cached in localStorage. */
window.DibDatabase = class {
  constructor(config) {
    if (!config?.url || !config?.publishableKey) throw new Error('Database connection is not configured. Add the project publishable key in assets/js/config.js.');
    if (config.publishableKey.startsWith('sb_secret_')) throw new Error('Use a publishable key, never a secret key.');
    if (config.publishableKey.startsWith('eyJ')) {
      try { if (JSON.parse(atob(config.publishableKey.split('.')[1])).role !== 'anon') throw new Error('Private key'); }
      catch { throw new Error('Use a publishable key or legacy anon key only.'); }
    }
    // Each page must sign in explicitly; never restore a browser or URL session.
    this.client = supabase.createClient(config.url, config.publishableKey, {
      auth: { persistSession: false, detectSessionInUrl: false, autoRefreshToken: true }
    });
  }
  async check(request) {
    const {data, error} = await request;
    if (error) throw error;
    return data;
  }
  async rows(table, key = 'id') {
    const rows = [];
    // Keyset pagination avoids the API's default row limit.
    for (;;) {
      let query = this.client.from(table).select('*').order(key).limit(500);
      if (rows.length) query = query.gt(key, rows[rows.length - 1][key]);
      const page = await this.check(query);
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  async load(userId) {
    const member = await this.check(this.client.from('dib_members').select('id,display_name,role,active').eq('id', userId).single());
    if (!member?.active || !['admin','user'].includes(member.role)) throw new Error('This account has no active DIB membership. Contact the project owner.');
    const admin = member.role === 'admin';
    const [stock, sales, costs, expenses, revenue, adjustments] = await Promise.all([
      this.rows('dib_stock'), this.rows('dib_sales'),
      admin ? this.rows('dib_purchase_costs', 'stock_id') : [],
      admin ? this.rows('dib_expenses') : [], admin ? this.rows('dib_revenue') : [],
      admin ? this.rows('dib_stock_adjustments') : []
    ]);
    const costMap = new Map(costs.map(c => [c.stock_id, c]));
    return {member, data: {
      stock: stock.map(s => ({...s, sellingPrice: Number(s.selling_price),
        buyingPrice: admin ? Number(costMap.get(s.id)?.buying_price || 0) : undefined,
        transport: admin ? Number(costMap.get(s.id)?.transport || 0) : undefined})),
      sales: sales.map(s => ({...s, stockId:s.stock_id, unitPrice:Number(s.unit_price)})),
      expenses: expenses.map(e => ({...e,amount:Number(e.amount)})),
      revenue: revenue.map(r => ({...r,amount:Number(r.amount)})), adjustments
    }};
  }
  rpc(name, args) { return this.check(this.client.rpc(name, args)); }
  saveStock(id, item) { return this.rpc('dib_save_stock', {p_id:id,p_item:item}); }
  recordSale(id, sale) { return this.rpc('dib_record_sale', {p_id:id,p_stock_id:sale.stockId,p_quantity:sale.quantity,p_unit_price:sale.unitPrice,p_date:sale.date}); }
  adjustStock(id, remaining, expected, reason) { return this.rpc('dib_adjust_stock', {p_stock_id:id,p_remaining:remaining,p_expected_remaining:expected,p_reason:reason}); }
  deleteStock(id) { return this.rpc('dib_delete_stock',{p_id:id}); }
  deleteSale(id) { return this.rpc('dib_delete_sale',{p_id:id}); }
  saveEntry(table, id, values) {
    if (!['dib_expenses','dib_revenue'].includes(table)) throw new Error('Invalid table');
    return this.check(this.client.from(table).upsert({id,...values}).select('id').single());
  }
  deleteEntry(table, id) {
    if (!['dib_expenses','dib_revenue'].includes(table)) throw new Error('Invalid table');
    return this.check(this.client.from(table).delete().eq('id',id).select('id').single());
  }
};
