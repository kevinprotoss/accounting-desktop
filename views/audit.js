// 审计追溯模块
async function render(container, { db, t, utils }) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>🔍 ${t('menu_audit')}</span>
            </div>
            <div class="search-bar">
                <div class="form-group"><label>${t('audit_date_from')}</label><input type="date" id="audit-from"></div>
                <div class="form-group"><label>${t('audit_date_to')}</label><input type="date" id="audit-to"></div>
                <div class="form-group"><label>${t('audit_invoice')}</label><input type="text" id="audit-invoice" placeholder="${t('audit_invoice')}"></div>
                <div class="form-group"><label>${t('audit_customer')}</label><input type="text" id="audit-customer" placeholder="${t('audit_customer')}"></div>
                <div class="form-group"><label>${t('audit_product')}</label><input type="text" id="audit-product" placeholder="${t('audit_product')}"></div>
                <button id="audit-search" class="btn">${t('search')}</button>
            </div>
            <div id="audit-results">
                <table class="data-table" id="audit-table"><thead><tr><th>${t('issue_number')}</th><th>${t('issue_date')}</th><th>${t('customer_name')}</th><th>${t('invoice_number')}</th><th>${t('actions')}</th></tr></thead><tbody id="audit-tbody"></tbody></table>
            </div>
        </div>
        <div id="audit-detail" style="display:none;" class="card"></div>
    `;
    bindEvents(db, t);
    // 初始加载最近三个月的
    const today = utils.todayStr();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    document.getElementById('audit-from').value = utils.formatDate(threeMonthsAgo);
    document.getElementById('audit-to').value = today;
    performSearch(db, t);
}

function bindEvents(db, t) {
    document.getElementById('audit-search').addEventListener('click', () => performSearch(db, t));
}

function performSearch(db, t) {
    const fromDate = document.getElementById('audit-from').value;
    const toDate = document.getElementById('audit-to').value;
    const invoice = document.getElementById('audit-invoice').value.trim();
    const customer = document.getElementById('audit-customer').value.trim();
    const product = document.getElementById('audit-product').value.trim();

    let query = `SELECT g.id, g.issue_number, g.date, g.customer_name, g.invoice_number FROM goods_issues g WHERE 1=1`;
    const params = [];
    if (fromDate) {
        query += ` AND g.date >= ?`;
        params.push(fromDate);
    }
    if (toDate) {
        query += ` AND g.date <= ?`;
        params.push(toDate);
    }
    if (invoice) {
        query += ` AND g.invoice_number LIKE ?`;
        params.push(`%${invoice}%`);
    }
    if (customer) {
        query += ` AND g.customer_name LIKE ?`;
        params.push(`%${customer}%`);
    }
    if (product) {
        // 需要通过子查询查找包含该商品的销售单
        query += ` AND EXISTS (SELECT 1 FROM goods_issue_items gi JOIN goods_receipt_items ri ON gi.receipt_item_id = ri.id WHERE gi.issue_id = g.id AND ri.product_name LIKE ?)`;
        params.push(`%${product}%`);
    }
    query += ` ORDER BY g.date DESC`;
    const issues = db.prepare(query).all(params);
    const tbody = document.getElementById('audit-tbody');
    tbody.innerHTML = '';
    for (const issue of issues) {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = issue.issue_number;
        row.insertCell(1).innerText = issue.date;
        row.insertCell(2).innerText = issue.customer_name || '';
        row.insertCell(3).innerText = issue.invoice_number || '';
        const actionsCell = row.insertCell(4);
        const viewBtn = document.createElement('button');
        viewBtn.innerText = t('view_chain');
        viewBtn.classList.add('btn', 'btn-secondary');
        viewBtn.onclick = () => showDetail(issue.id, db, t);
        actionsCell.appendChild(viewBtn);
    }
}

function showDetail(issueId, db, t) {
    // 获取销售单完整信息
    const issue = db.prepare(`SELECT * FROM goods_issues WHERE id = ?`).get(issueId);
    if (!issue) return;
    const items = db.prepare(`
        SELECT gi.*, ri.product_name, ri.net_unit_price as purchase_price, ri.tax_rate
        FROM goods_issue_items gi
        JOIN goods_receipt_items ri ON gi.receipt_item_id = ri.id
        WHERE gi.issue_id = ?
    `).all(issueId);
    
    let detailHtml = `<div class="card-header">📄 ${t('view_chain')}: ${issue.issue_number}</div>`;
    detailHtml += `<h4>销售信息</h4><table class="data-table"><tr><th>${t('issue_number')}</th><td>${issue.issue_number}</td></tr>
    <tr><th>${t('issue_date')}</th><td>${issue.date}</td></tr>
    <tr><th>${t('customer_name')}</th><td>${issue.customer_name || ''}</td></tr>
    <tr><th>${t('invoice_number')}</th><td>${issue.invoice_number || ''}</td></tr>
    <tr><th>${t('is_export')}</th><td>${issue.is_export ? t('yes') : t('no')}</td></tr>
    <tr><th>${t('carrier')}</th><td>${issue.carrier || ''}</td></tr>
    <tr><th>${t('tracking_number')}</th><td>${issue.tracking_number || ''}</td></tr>
    <tr><th>${t('shipping_date')}</th><td>${issue.shipping_date || ''}</td></tr>`;
    if (issue.is_export) {
        detailHtml += `<tr><th>${t('export_customs_number')}</th><td>${issue.export_customs_number || ''}</td></tr>
        <tr><th>${t('export_customs_date')}</th><td>${issue.export_customs_date || ''}</td></tr>
        <tr><th>${t('export_location')}</th><td>${issue.export_location || ''}</td></tr>`;
        if (issue.export_attachment_path) {
            detailHtml += `<tr><th>${t('export_attachment')}</th><td><button onclick="window.utils.openFile('${issue.export_attachment_path}')">${t('open_file')}</button></td></tr>`;
        }
    }
    detailHtml += `</table>`;

    detailHtml += `<h4>商品明细</h4><table class="data-table"><thead><tr><th>${t('product_name')}</th><th>${t('quantity')}</th><th>${t('selling_price')}</th><th>${t('purchase_price')}</th><th>${t('profit') || '利润'}</th></tr></thead><tbody>`;
    for (const item of items) {
        const profit = (item.selling_net_price - item.purchase_price) * item.quantity;
        detailHtml += `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${item.selling_net_price.toFixed(2)}</td><td>${item.purchase_price.toFixed(2)}</td><td>${profit.toFixed(2)}</td></tr>`;
    }
    detailHtml += `</tbody></table>`;

    if (issue.payment_attachment_paths) {
        const paths = JSON.parse(issue.payment_attachment_paths);
        if (paths.length) {
            detailHtml += `<h4>${t('payment_attachment')}</h4><ul>`;
            paths.forEach(p => {
                detailHtml += `<li><button onclick="window.utils.openFile('${p}')">${p.split('/').pop()}</button></li>`;
            });
            detailHtml += `</ul>`;
        }
    }

    const detailDiv = document.getElementById('audit-detail');
    detailDiv.innerHTML = detailHtml;
    detailDiv.style.display = 'block';
}

module.exports = { render };
