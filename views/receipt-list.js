// views/receipt-list.js
// 入库历史列表视图（含日期筛选和关键词搜索）

async function render(container, { db, t, utils }) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>📋 ${t('receipt_history') || '历史入库单'}</span>
                <button id="new-receipt-btn" class="btn btn-primary">➕ ${t('receipt_new')}</button>
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
                <input type="text" id="receipt-search" placeholder="${t('search_by_supplier_number') || '单号/供应商'}" style="flex:1;">
                <button id="search-btn" class="btn">${t('search')}</button>
            </div>
            <table class="data-table" id="receipt-list">
                <thead>
                    <tr>
                        <th>${t('receipt_number')}</th>
                        <th>${t('receipt_date')}</th>
                        <th>${t('supplier')}</th>
                        <th>${t('remarks')}</th>
                        <th>${t('actions')}</th>
                    </tr>
                </thead>
                <tbody id="receipt-list-tbody"></tbody>
            </table>
        </div>
    `;

    // 获取 DOM 元素
    const newBtn = document.getElementById('new-receipt-btn');
    const searchInput = document.getElementById('receipt-search');
    const searchBtn = document.getElementById('search-btn');
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const quickToday = document.getElementById('quick-today');
    const quickWeek = document.getElementById('quick-week');
    const quickMonth = document.getElementById('quick-month');

    // 通用加载函数（从 DOM 读取当前筛选条件）
    const loadList = () => {
        const keyword = searchInput.value;
        const from = dateFrom.value;
        const to = dateTo.value;
        loadReceiptList(db, t, keyword, from, to);
    };

    // 绑定事件
    newBtn.onclick = () => {
        window._currentReceiptId = null;
        window.loadView('receipt-form');
    };
    searchBtn.onclick = loadList;
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadList();
    });
    // 日期变化自动刷新
    dateFrom.addEventListener('change', loadList);
    dateTo.addEventListener('change', loadList);

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

    // 默认显示当天数据
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

async function loadReceiptList(db, t, keyword, fromDate, toDate) {
    let sql = `
        SELECT 
            gr.id, 
            gr.receipt_number, 
            gr.date, 
            gr.supplier,
            gr.remarks,
            EXISTS (
                SELECT 1 
                FROM goods_issue_items gi
                JOIN goods_receipt_items ri ON gi.receipt_item_id = ri.id
                WHERE ri.receipt_id = gr.id
            ) AS is_used
        FROM goods_receipts gr
        WHERE 1=1
    `;
    const params = [];
    if (keyword) {
        sql += ` AND (gr.receipt_number LIKE ? OR gr.supplier LIKE ?)`;
        params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (fromDate) {
        sql += ` AND gr.date >= ?`;
        params.push(fromDate);
    }
    if (toDate) {
        sql += ` AND gr.date <= ?`;
        params.push(toDate);
    }
    sql += ` ORDER BY gr.date DESC`;
    const receipts = db.prepare(sql).all(params);
    const tbody = document.getElementById('receipt-list-tbody');
    tbody.innerHTML = '';
    for (const r of receipts) {
        const row = tbody.insertRow();
        const cell0 = row.insertCell(0);
        cell0.innerText = r.receipt_number;
        row.insertCell(1).innerText = utils.formatDateToDE(r.date);
        row.insertCell(2).innerText = r.supplier || '';
        row.insertCell(3).innerText = r.remarks || '';
        const actionsCell = row.insertCell(4);
        const editBtn = document.createElement('button');
        editBtn.innerText = t('edit');
        editBtn.classList.add('btn', 'btn-secondary');
        editBtn.style.marginRight = '4px';
        editBtn.onclick = () => {
            window._currentReceiptId = r.id;
            window.loadView('receipt-form');
        };
        actionsCell.appendChild(editBtn);
        const delBtn = document.createElement('button');
        delBtn.innerText = t('delete');
        delBtn.classList.add('btn', 'btn-danger');
        if (r.is_used) {
            delBtn.disabled = true;
            delBtn.style.opacity = '0.5';
            delBtn.title = `${t('del_button_disabled')}`;
        } else {
            delBtn.onclick = () => deleteReceipt(r.id, db, t);
        }
        actionsCell.appendChild(delBtn);
    }
}

async function deleteReceipt(id, db, t) {
    const confirmed = await utils.showConfirm(t('confirm_delete'));
    if (!confirmed) return;
    db.prepare(`DELETE FROM goods_receipt_items WHERE receipt_id = ?`).run(id);
    db.prepare(`DELETE FROM goods_receipts WHERE id = ?`).run(id);
    // 重新加载列表（获取当前筛选条件）
    const keyword = document.getElementById('receipt-search').value;
    const from = document.getElementById('date-from').value;
    const to = document.getElementById('date-to').value;
    await loadReceiptList(db, t, keyword, from, to);
    utils.showAlert(t('delete_success') || '删除成功');
}

module.exports = { render };