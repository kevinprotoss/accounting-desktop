// views/stock.js
async function render(container, { db, t, utils }) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>📦 ${t('menu_stock')}</span>
            </div>
            <!-- 日期筛选区域 -->
            <div class="date-filter" style="margin-bottom: 16px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px;">
                <div style="display: flex; gap: 12px;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label>${t('from_date') || '开始日期'}</label>
                        <input type="date" id="date-from" style="width:140px;">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label>${t('to_date') || '结束日期'}</label>
                        <input type="date" id="date-to" style="width:140px;">
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button id="quick-today" class="btn btn-secondary">${t('today') || '当天'}</button>
                    <button id="quick-week" class="btn btn-secondary">${t('last_week') || '最近1周'}</button>
                    <button id="quick-month" class="btn btn-secondary">${t('last_month') || '最近1月'}</button>
                </div>
            </div>
            <!-- 关键词搜索栏 -->
            <div class="search-bar" style="margin-bottom: 16px;">
                <input type="text" id="stock-filter" placeholder="${t('product_filter')}" style="flex:1;">
                <button id="refresh-stock" class="btn">${t('search')}</button>
            </div>
            <table class="data-table" id="stock-table">
                <thead>
                    <tr>
                        <th>${t('product_name')}</th>
                        <th>${t('remaining_qty')}</th>
                        <th>${t('purchase_price')}</th>
                        <th>${t('tax_rate')}</th>
                        <th>${t('receipt_date_info')}</th>
                        <th>${t('supplier')}</th>
                    </tr>
                </thead>
                <tbody id="stock-tbody"></tbody>
            </table>
        </div>
    `;

    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const quickToday = document.getElementById('quick-today');
    const quickWeek = document.getElementById('quick-week');
    const quickMonth = document.getElementById('quick-month');
    const filterInput = document.getElementById('stock-filter');
    const refreshBtn = document.getElementById('refresh-stock');

    const loadList = () => {
        const keyword = filterInput.value;
        const from = dateFrom.value;
        const to = dateTo.value;
        loadStock(db, t, keyword, from, to);
    };

    // 日期变化自动刷新
    dateFrom.addEventListener('change', loadList);
    dateTo.addEventListener('change', loadList);
    filterInput.addEventListener('input', loadList);
    refreshBtn.addEventListener('click', loadList);

    // 快捷按钮
    quickToday.onclick = () => {
        const today = utils.todayStr();
        dateFrom.value = today;
        dateTo.value = today;
        loadList();
    };
    quickWeek.onclick = () => {
        const end = utils.todayStr();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 6);
        const start = utils.formatDate(startDate);
        dateFrom.value = start;
        dateTo.value = end;
        loadList();
    };
    quickMonth.onclick = () => {
        const end = utils.todayStr();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        const start = utils.formatDate(startDate);
        dateFrom.value = start;
        dateTo.value = end;
        loadList();
    };

    // 默认显示当天数据（可选，若不需要可注释）
    // const today = utils.todayStr();
    // dateFrom.value = today;
    // dateTo.value = today;
    // 默认显示最近一个月数据
    const end = utils.todayStr();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const start = utils.formatDate(startDate);
    dateFrom.value = start;
    dateTo.value = end;
    await loadList();
}

async function loadStock(db, t, filter, fromDate, toDate) {
    let query = `
        SELECT * FROM current_stock
        WHERE 1=1
    `;
    const params = [];
    if (filter) {
        query += ` AND product_name LIKE ?`;
        params.push(`%${filter}%`);
    }
    if (fromDate) {
        query += ` AND receipt_date >= ?`;
        params.push(fromDate);
    }
    if (toDate) {
        query += ` AND receipt_date <= ?`;
        params.push(toDate);
    }
    query += ` ORDER BY receipt_date DESC`;
    const rows = db.prepare(query).all(params);
    const tbody = document.getElementById('stock-tbody');
    tbody.innerHTML = '';
    for (const row of rows) {
        const tr = tbody.insertRow();
        tr.insertCell(0).innerText = row.product_name;
        tr.insertCell(1).innerText = row.remaining_qty;
        tr.insertCell(2).innerText = row.purchase_price.toFixed(2);
        tr.insertCell(3).innerText = `${row.tax_rate}%`;
        tr.insertCell(4).innerText = utils.formatDateToDE(row.receipt_date);
        tr.insertCell(5).innerText = row.supplier || '';
    }
}

module.exports = { render };