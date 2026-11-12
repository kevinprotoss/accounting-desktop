// views/issue-list.js
// 销售历史列表视图（含日期筛选和关键词搜索）

async function render(container, { db, t, utils }) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>📋 ${t('issue_history') || '销售历史'}</span>
                <button id="new-issue-btn" class="btn btn-primary">➕ ${t('issue_new')}</button>
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
                <input type="text" id="issue-search" placeholder="${t('search_by_customer_invoice') || '客户/发票号'}" style="flex:1;">
                <button id="search-btn" class="btn">${t('search')}</button>
            </div>
            <table class="data-table" id="issue-list">
                <thead>
                    <tr>
                        <th>${t('issue_number')}</th>
                        <th>${t('issue_date')}</th>
                        <th>${t('customer')}</th>
                        <th>${t('invoice_number')}</th>
                        <th>${t('payment_status')}</th>
                        <th>${t('remarks')}</th>
                        <th>${t('actions')}</th>
                    </tr>
                </thead>
                <tbody id="issue-list-tbody"></tbody>
            </table>
        </div>
    `;

    // 获取 DOM 元素
    const newBtn = document.getElementById('new-issue-btn');
    const searchInput = document.getElementById('issue-search');
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
        loadIssueList(db, t, keyword, from, to);
    };

    // 绑定事件
    newBtn.onclick = () => {
        window._currentIssueId = null;
        window.loadView('issue-form');
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

async function loadIssueList(db, t, keyword, fromDate, toDate) {
    let sql = `
        SELECT i.id, i.issue_number, i.date, i.customer_name, i.invoice_number, i.status, inv.pdf_path, i.remarks
        FROM goods_issues i
        LEFT JOIN invoices inv ON i.id = inv.issue_id
        WHERE 1=1
    `;
    const params = [];
    if (keyword) {
        sql += ` AND (i.customer_name LIKE ? OR i.invoice_number LIKE ?)`;
        params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (fromDate) {
        sql += ` AND i.date >= ?`;
        params.push(fromDate);
    }
    if (toDate) {
        sql += ` AND i.date <= ?`;
        params.push(toDate);
    }
    sql += ` ORDER BY i.date DESC`;
    const issues = db.prepare(sql).all(params);
    const tbody = document.getElementById('issue-list-tbody');
    tbody.innerHTML = '';
    for (const issue of issues) {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = issue.issue_number;
        row.insertCell(1).innerText = utils.formatDateToDE(issue.date);;
        row.insertCell(2).innerText = issue.customer_name || '';
        row.insertCell(3).innerText = issue.invoice_number || '';
        row.insertCell(4).innerText = issue.status === 'paid' ? t('status_paid') : t('status_open');
        row.insertCell(5).innerText = issue.remarks || '';
        const actionsCell = row.insertCell(6);
        const editBtn = document.createElement('button');
        editBtn.innerText = t('edit');
        editBtn.classList.add('btn', 'btn-secondary');
        editBtn.style.marginRight = '4px';
        editBtn.onclick = () => {
            window._currentIssueId = issue.id;
            window.loadView('issue-form');
        };
        actionsCell.appendChild(editBtn);
        if (issue.pdf_path) {
            const pdfBtn = document.createElement('button');
            pdfBtn.innerText = t('download');
            pdfBtn.classList.add('btn', 'btn-primary');
            pdfBtn.style.marginRight = '4px';
            pdfBtn.onclick = () => utils.openFile(issue.pdf_path);
            actionsCell.appendChild(pdfBtn);
        }
        const deleteBtn = document.createElement('button');
        deleteBtn.innerText = t('delete');
        deleteBtn.classList.add('btn', 'btn-danger');
        deleteBtn.onclick = () => deleteIssue(issue.id, db, t);
        actionsCell.appendChild(deleteBtn);
    }
}

async function deleteIssue(id, db, t) {
    const confirmed = await utils.showConfirm(t('confirm_delete'));
    if (!confirmed) return;
    db.prepare(`DELETE FROM goods_issue_items WHERE issue_id = ?`).run(id);
    db.prepare(`DELETE FROM invoices WHERE issue_id = ?`).run(id);
    db.prepare(`DELETE FROM goods_issues WHERE id = ?`).run(id);
    // 重新加载列表（获取当前筛选条件）
    const keyword = document.getElementById('issue-search').value;
    const from = document.getElementById('date-from').value;
    const to = document.getElementById('date-to').value;
    await loadIssueList(db, t, keyword, from, to);
    utils.showAlert(t('delete_success') || '删除成功');
}

module.exports = { render };