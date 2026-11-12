// views/issue-form.js
const { buildInvoiceHTML } = require('./invoice-template.js');

// 销售出库表单模块（新建/编辑）
let currentIssueData = {
    id: null,
    issue_number: '',
    date: '',
    customer_id: null,
    customer_name: '',
    customer_address: '',
    customer_vat_id: '',
    invoice_number: '',
    is_export: false,
    carrier: '',
    tracking_number: '',
    shipping_date: '',
    export_customs_number: '',
    export_customs_date: '',
    export_location: '',
    export_attachment_path: [],
    payment_attachment_paths: [],
    bank_reference: '',
    payment_received_date: '',
    status: 'open',
    remarks: '',
    items: []  // { receipt_item_id, product_name, quantity, selling_net_price, tax_rate }
};
let isEditMode = false;

function generateIssueNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `IS-${year}${month}-${random}`;
}

function generateInvoiceNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}-${seq}`;
}

function syncFormToCurrentIssueData() {
    currentIssueData.issue_number = document.getElementById('issue-number').value;
    currentIssueData.date = document.getElementById('issue-date').value;
    const customerId = document.getElementById('customer-select').value;
    currentIssueData.customer_id = customerId ? parseInt(customerId) : null;
    currentIssueData.customer_name = document.getElementById('customer-name').value;
    currentIssueData.customer_address = document.getElementById('customer-address').value;
    currentIssueData.customer_vat_id = document.getElementById('customer-vat-id').value;
    currentIssueData.invoice_number = document.getElementById('invoice-number').value;
    currentIssueData.is_export = document.getElementById('is-export').checked;
    currentIssueData.export_customs_number = document.getElementById('export-customs-number').value;
    currentIssueData.export_customs_date = document.getElementById('export-customs-date').value;
    currentIssueData.export_location = document.getElementById('export-location').value;
    currentIssueData.carrier = document.getElementById('carrier').value;
    currentIssueData.tracking_number = document.getElementById('tracking-number').value;
    currentIssueData.shipping_date = document.getElementById('shipping-date').value;
    currentIssueData.bank_reference = document.getElementById('bank-reference').value;
    currentIssueData.payment_received_date = document.getElementById('payment-date').value;
    currentIssueData.status = document.getElementById('status').value;
    currentIssueData.remarks = document.getElementById('remarks').value;
}

async function render(container, { db, logChange, t, utils, editId }) {
    // 加载数据（新建或编辑）
    if (editId) {
        const issue = db.prepare(`SELECT * FROM goods_issues WHERE id = ?`).get(editId);
        if (!issue) {
            utils.showAlert('单据不存在');
            window.loadView('goods-issue');
            return;
        }
        const items = db.prepare(`
            SELECT gi.*, ri.product_name
            FROM goods_issue_items gi
            JOIN goods_receipt_items ri ON gi.receipt_item_id = ri.id
            WHERE gi.issue_id = ?
        `).all(editId);
        currentIssueData = {
            id: issue.id,
            issue_number: issue.issue_number,
            date: issue.date,
            customer_id: issue.customer_id,
            customer_name: issue.customer_name || '',
            customer_address: issue.customer_address || '',
            customer_vat_id: issue.customer_vat_id || '',
            invoice_number: issue.invoice_number,
            is_export: !!issue.is_export,
            carrier: issue.carrier || '',
            tracking_number: issue.tracking_number || '',
            shipping_date: issue.shipping_date || '',
            export_customs_number: issue.export_customs_number || '',
            export_customs_date: issue.export_customs_date || '',
            export_location: issue.export_location || '',
            export_attachment_path: issue.export_attachment_path ? utils.normalizeAttachments(issue.export_attachment_path) : [],
            payment_attachment_paths: issue.payment_attachment_paths ? utils.normalizeAttachments(issue.payment_attachment_paths) : [],
            bank_reference: issue.bank_reference || '',
            payment_received_date: issue.payment_received_date || '',
            status: issue.status,
            remarks: issue.remarks || '',
            items: items.map(i => ({
                receipt_item_id: i.receipt_item_id,
                product_name: i.product_name,
                quantity: i.quantity,
                selling_net_price: i.selling_net_price,
                tax_rate: i.tax_rate
            }))
        };
        isEditMode = true;
    } else {
        currentIssueData = {
            id: null,
            issue_number: generateIssueNumber(),
            date: utils.todayStr(),
            customer_id: null,
            customer_name: '',
            customer_address: '',
            customer_vat_id: '',
            invoice_number: generateInvoiceNumber(),
            is_export: false,
            carrier: '',
            tracking_number: '',
            shipping_date: '',
            export_customs_number: '',
            export_customs_date: '',
            export_location: '',
            export_attachment_path: [],
            payment_attachment_paths: [],
            bank_reference: '',
            payment_received_date: '',
            status: 'open',
            remarks: '',
            items: []
        };
        isEditMode = false;
    }

    // 渲染表单HTML（不含历史列表）
    container.innerHTML = `
        <div class="card">
            <div class="card-header">${isEditMode ? `✏️ ${t('issue_edit')}` : `📤 ${t('issue_new')}`}</div>
            <div class="form-group"><label>${t('issue_number')}</label><input type="text" id="issue-number" readonly></div>
            <div class="form-group"><label>${t('issue_date')}</label><input type="date" id="issue-date" value="${currentIssueData.date}"></div>
            <div class="form-group"><label>${t('customer')}</label><select id="customer-select"><option value="">-- ${t('select_customer') || 'Select'} --</option></select></div>
            <div class="form-group"><label>${t('customer_name')}</label><input type="text" id="customer-name" placeholder="${t('customer_name')}"></div>
            <div class="form-group"><label>${t('customer_address')}</label><textarea id="customer-address" rows="3" style="width:100%;"></textarea></div>
            <div class="form-group"><label>${t('customer_vat_id')}</label><input type="text" id="customer-vat-id"></div>
            <div class="form-group"><label>${t('invoice_number')}</label><input type="text" id="invoice-number" value="${currentIssueData.invoice_number}"></div>
            <div class="form-group"><label><input type="checkbox" id="is-export" ${currentIssueData.is_export ? 'checked' : ''}> ${t('is_export')}</label></div>
            <div id="export-fields" style="display:${currentIssueData.is_export ? 'block' : 'none'};">
                <div class="form-group"><label>${t('export_customs_number')}</label><input type="text" id="export-customs-number" value="${escapeHtml(currentIssueData.export_customs_number)}"></div>
                <div class="form-group"><label>${t('export_customs_date')}</label><input type="date" id="export-customs-date" value="${currentIssueData.export_customs_date}"></div>
                <div class="form-group"><label>${t('export_location')}</label><input type="text" id="export-location" value="${escapeHtml(currentIssueData.export_location)}"></div>
                <div class="form-group"><label>${t('export_attachment')}</label><button id="upload-export" class="btn btn-secondary">${t('upload')}</button><span id="export-filename"></span></div>
            </div>
            <div class="form-group"><label>${t('carrier')}</label><input type="text" id="carrier" value="${escapeHtml(currentIssueData.carrier)}"></div>
            <div class="form-group"><label>${t('tracking_number')}</label><input type="text" id="tracking-number" value="${escapeHtml(currentIssueData.tracking_number)}"></div>
            <div class="form-group"><label>${t('shipping_date')}</label><input type="date" id="shipping-date" value="${currentIssueData.shipping_date}"></div>
            <hr>
            <div class="form-group"><button id="add-item" class="btn">${t('add_row')}</button></div>
            <table class="detail-table" id="items-table"><thead><tr><th>${t('product_name')}</th><th>${t('quantity')}</th><th>${t('selling_price')}</th><th>${t('price_type')}</th><th>${t('tax_rate')}</th><th>${t('total_net')}</th><th>${t('total_tax')}</th><th>${t('actions')}</th></tr></thead><tbody id="items-tbody"></tbody></table>
            <div class="form-group"><label>${t('payment_attachment')}</label><button id="upload-payment" class="btn btn-secondary">${t('upload')}</button><span id="payment-filenames"></span></div>
            <div class="form-group"><label>${t('bank_reference')}</label><input type="text" id="bank-reference" value="${escapeHtml(currentIssueData.bank_reference)}"></div>
            <div class="form-group"><label>${t('payment_date')}</label><input type="date" id="payment-date" value="${currentIssueData.payment_received_date}"></div>
            <div class="form-group"><label>${t('payment_status')}</label><select id="status"><option value="open" ${currentIssueData.status === 'open' ? 'selected' : ''}>${t('status_open')}</option><option value="paid" ${currentIssueData.status === 'paid' ? 'selected' : ''}>${t('status_paid')}</option></select></div>
            <div class="form-group"><label>${t('remarks')}</label><textarea id="remarks" rows="2">${escapeHtml(currentIssueData.remarks)}</textarea></div>
            <div class="form-group">
                <button id="preview-invoice" class="btn btn-secondary">${t('preview_invoice')}</button>
                <button id="save-issue" class="btn">${t('save')}</button>
                <button id="cancel-issue" class="btn btn-secondary">${t('cancel')}</button>
            </div>
        </div>
    `;

    // 加载客户下拉列表
    const customers = db.prepare(`SELECT id, name FROM customers ORDER BY name`).all();
    const select = document.getElementById('customer-select');
    for (const c of customers) {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name;
        if (currentIssueData.customer_id === c.id) option.selected = true;
        select.appendChild(option);
    }
    select.addEventListener('change', (e) => {
        const id = e.target.value;
        if (id) {
            const cust = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
            document.getElementById('customer-name').value = cust.name || '';
            let address = '';
            if (cust.street) address += cust.street + '\n';
            if (cust.postcode || cust.city) address += (cust.postcode ? cust.postcode : '') + ' ' + (cust.city ? cust.city : '') + '\n';
            if (cust.country) address += cust.country;
            document.getElementById('customer-address').value = address.trim();
            document.getElementById('customer-vat-id').value = cust.ust_idnr || '';
        } else {
            document.getElementById('customer-name').value = '';
            document.getElementById('customer-address').value = '';
            document.getElementById('customer-vat-id').value = '';
        }
    });
    // 手动触发一次，填充当前编辑的客户信息
    if (currentIssueData.customer_id) {
        select.dispatchEvent(new Event('change'));
    } else {
        // 若没有客户ID但已有文本信息，则回填（例如手动输入的客户）
        document.getElementById('customer-name').value = currentIssueData.customer_name;
        document.getElementById('customer-address').value = currentIssueData.customer_address;
        document.getElementById('customer-vat-id').value = currentIssueData.customer_vat_id;
    }

    document.getElementById('issue-number').value = currentIssueData.issue_number;
    document.getElementById('issue-date').value = currentIssueData.date;
    document.getElementById('invoice-number').value = currentIssueData.invoice_number;
    document.getElementById('is-export').checked = currentIssueData.is_export;
    document.getElementById('export-customs-number').value = currentIssueData.export_customs_number;
    document.getElementById('export-customs-date').value = currentIssueData.export_customs_date;
    document.getElementById('export-location').value = currentIssueData.export_location;
    document.getElementById('carrier').value = currentIssueData.carrier;
    document.getElementById('tracking-number').value = currentIssueData.tracking_number;
    document.getElementById('shipping-date').value = currentIssueData.shipping_date;
    document.getElementById('bank-reference').value = currentIssueData.bank_reference;
    document.getElementById('payment-date').value = currentIssueData.payment_received_date;
    document.getElementById('status').value = currentIssueData.status;
    document.getElementById('remarks').value = currentIssueData.remarks;

    // 附件显示（出口凭证）
    utils.displayAttachmentLinks(document.getElementById('export-filename'), currentIssueData.export_attachment_path);

    // 付款附件列表
    utils.displayAttachmentLinks(document.getElementById('payment-filenames'), currentIssueData.payment_attachment_paths);

    renderItemsTable(currentIssueData.items, t, db);
    bindEvents(container, db, logChange, t, utils);
}

function toggleExportFields(show) {
    const div = document.getElementById('export-fields');
    if (div) div.style.display = show ? 'block' : 'none';
}

function renderItemsTable(items, t, db) {
    const tbody = document.getElementById('items-tbody');
    tbody.innerHTML = '';
    for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const row = tbody.insertRow();
        // 商品名称可选择库存批次
        const selectStock = document.createElement('select');
        selectStock.innerHTML = '<option value="">-- 选择库存 --</option>';
        let stockItems = db.prepare(`SELECT receipt_item_id, product_name, remaining_qty, purchase_price FROM current_stock`).all();
        // 检查原批次是否在 stockItems 中
        const originalExists = stockItems.some(s => s.receipt_item_id === item.receipt_item_id);
        if (!originalExists && item.receipt_item_id) {
            const extra = db.prepare(`
                SELECT ri.id as receipt_item_id, ri.product_name, 0 as remaining_qty, ri.net_unit_price as purchase_price
                FROM goods_receipt_items ri
                WHERE ri.id = ?
            `).get(item.receipt_item_id);
            if (extra) {
                extra.product_name = `${extra.product_name}`;
                stockItems = [extra, ...stockItems];
            }
        }
        for (const s of stockItems) {
            const opt = document.createElement('option');
            opt.value = s.receipt_item_id;
            opt.textContent = `${s.product_name} (剩余: ${s.remaining_qty}, 采购价: ${utils.roundTo(s.purchase_price, 2)})`;
            if (item.receipt_item_id == s.receipt_item_id) opt.selected = true;
            selectStock.appendChild(opt);
        }
        row.insertCell(0).appendChild(selectStock);
        row.insertCell(1).innerHTML = `<input type="number" step="any" class="item-qty" value="${item.quantity}">`;
        row.insertCell(2).innerHTML = `<input type="number" step="any" class="item-price" value="${item.selling_net_price}">`;
        row.insertCell(3).innerHTML = `<select class="price-type"><option value="net">${t('price_net')}</option><option value="gross">${t('price_gross')}</option></select>`;
        row.insertCell(4).innerHTML = `<select class="item-tax">${[19,7,0].map(v => `<option value="${v}" ${item.tax_rate==v ? 'selected' : ''}>${v}%</option>`).join('')}</select>`;
        const netCell = row.insertCell(5);
        const taxCell = row.insertCell(6);
        const actionsCell = row.insertCell(7);
        const delBtn = document.createElement('button');
        delBtn.innerText = t('remove_row');
        delBtn.onclick = () => {
            items.splice(idx, 1);
            renderItemsTable(items, t, db);
        };
        actionsCell.appendChild(delBtn);
        function update() {
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const priceInput = row.querySelector('.item-price');
            let price = parseFloat(priceInput.value) || 0;
            let taxRate = parseInt(row.querySelector('.item-tax').value);
            if (isNaN(taxRate)) taxRate = 19;
            const priceType = row.querySelector('.price-type').value;
            let netPrice;
            if (priceType === 'gross') {
                netPrice = utils.calcNetFromGross(price, taxRate);
            } else {
                netPrice = price;
            }
            const totalNet = netPrice * qty;
            const tax = totalNet * taxRate / 100;
            netCell.innerText = totalNet.toFixed(2);
            taxCell.innerText = tax.toFixed(2);
            items[idx].receipt_item_id = parseInt(selectStock.value) || null;
            items[idx].product_name = selectStock.selectedOptions[0]?.textContent.split('(')[0].trim() || '';
            items[idx].quantity = qty;
            items[idx].selling_net_price = netPrice;
            items[idx].tax_rate = taxRate;
        }
        selectStock.addEventListener('change', update);
        row.querySelector('.item-qty').addEventListener('input', update);
        row.querySelector('.item-price').addEventListener('input', update);
        row.querySelector('.item-tax').addEventListener('change', update);
        row.querySelector('.price-type').addEventListener('change', update);
        update();
    }
}

function bindEvents(container, db, logChange, t, utils) {
    document.getElementById('is-export').addEventListener('change', (e) => toggleExportFields(e.target.checked));
    document.getElementById('add-item').onclick = () => {
        currentIssueData.items.push({
            receipt_item_id: null,
            product_name: '',
            quantity: 1,
            selling_net_price: 0,
            tax_rate: 19
        });
        renderItemsTable(currentIssueData.items, t, db);
    };
    document.getElementById('upload-export').onclick = async () => {
        const newSavedPaths = await utils.uploadMultipleFiles('issues', currentIssueData.issue_number);
        if (newSavedPaths.length) {
            // 追加到现有数组
            currentIssueData.export_attachment_path = [...currentIssueData.export_attachment_path, ...newSavedPaths];
            // 刷新显示
            utils.displayAttachmentLinks(document.getElementById('export-filename'), currentIssueData.export_attachment_path);
        }
    };
    document.getElementById('upload-payment').onclick = async () => {
        const newSavedPaths = await utils.uploadMultipleFiles('payments', currentIssueData.issue_number);
        if (newSavedPaths.length) {
            // 追加到现有数组
            currentIssueData.payment_attachment_paths = [...currentIssueData.payment_attachment_paths, ...newSavedPaths];
            // 刷新显示
            utils.displayAttachmentLinks(document.getElementById('payment-filenames'), currentIssueData.payment_attachment_paths);
        }
    };
    document.getElementById('preview-invoice').onclick = async () => {
        syncFormToCurrentIssueData(); // 收集数据
        const { companyInfo={} } = configs;
        const html = buildInvoiceHTML(currentIssueData, companyInfo, currentIssueData.items);
        try {
            const savePath = await window.generateInvoicePdf(html, utils.getAttachmentsDir('temp'), `invoice_preview.pdf`);
            utils.openFile(savePath);
        } catch (err) {
            console.error(err);
            utils.showAlert('PDF 生成失败，请检查是否文件被占用或权限不足。\n' + err.message, 'error');
        }
    };
    document.getElementById('save-issue').onclick = async () => {
        syncFormToCurrentIssueData(); // 收集数据
        const validItems = currentIssueData.items.filter(i => i.receipt_item_id && i.quantity > 0);
        if (validItems.length === 0) {
            utils.showAlert(t('fill_required'));
            return;
        }

        // 生成正式发票 PDF
        const { companyInfo={} } = configs;
        const invoiceHtml = buildInvoiceHTML(currentIssueData, companyInfo, validItems);
        const invoiceFileName = `Invoice_${currentIssueData.invoice_number}.pdf`;
        const invoiceSavePath = await window.generateInvoicePdf(invoiceHtml, utils.getAttachmentsDir('invoices'), invoiceFileName);

        // 保存到数据库
        const insertIssue = db.prepare(`
            INSERT OR REPLACE INTO goods_issues (id, issue_number, date, customer_id, customer_name, customer_address, customer_vat_id, invoice_number, is_export, carrier, tracking_number, shipping_date, export_customs_number, export_customs_date, export_location, export_attachment_path, payment_attachment_paths, bank_reference, payment_received_date, status, remarks, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        const issueId = currentIssueData.id || null;
        insertIssue.run(issueId, currentIssueData.issue_number, currentIssueData.date, currentIssueData.customer_id, currentIssueData.customer_name, currentIssueData.customer_address, currentIssueData.customer_vat_id, currentIssueData.invoice_number, currentIssueData.is_export ? 1 : 0, currentIssueData.carrier, currentIssueData.tracking_number, currentIssueData.shipping_date, currentIssueData.export_customs_number, currentIssueData.export_customs_date, currentIssueData.export_location, utils.serializeAttachments(currentIssueData.export_attachment_path), utils.serializeAttachments(currentIssueData.payment_attachment_paths), currentIssueData.bank_reference, currentIssueData.payment_received_date, currentIssueData.status, currentIssueData.remarks);
        const newId = issueId || db.prepare(`SELECT last_insert_rowid() as id`).get().id;
        // 更新明细
        db.prepare(`DELETE FROM goods_issue_items WHERE issue_id = ?`).run(newId);
        const insertItem = db.prepare(`INSERT INTO goods_issue_items (issue_id, receipt_item_id, quantity, selling_net_price, tax_rate) VALUES (?, ?, ?, ?, ?)`);
        for (const item of validItems) {
            insertItem.run(newId, item.receipt_item_id, item.quantity, utils.roundTo(item.selling_net_price), item.tax_rate);
        }
        // 更新发票记录
        db.prepare(`DELETE FROM invoices WHERE issue_id = ?`).run(newId);
        const insertInvoice = db.prepare(`
            INSERT INTO invoices (invoice_number, issue_id, pdf_path, net_total, tax_total, gross_total)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const totalNet = validItems.reduce((sum, i) => sum + i.selling_net_price * i.quantity, 0);
        const totalTax = validItems.reduce((sum, i) => sum + i.selling_net_price * i.quantity * i.tax_rate / 100, 0);
        const gross = totalNet + totalTax;
        insertInvoice.run(currentIssueData.invoice_number, newId, invoiceSavePath, totalNet, totalTax, gross);

        logChange('goods_issues', newId, isEditMode ? 'UPDATE' : 'INSERT', {}, currentIssueData);
        await utils.showAlert(t('save_success'));
        // 返回列表
        window.loadView('goods-issue');
    };
    document.getElementById('cancel-issue').onclick = () => {
        window.loadView('goods-issue');
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

module.exports = { render };