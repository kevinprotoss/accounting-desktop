// views/receipt-form.js
let currentReceiptData = {
    id: null,
    receipt_number: '',
    date: '',
    supplier: '',
    supplier_invoice: '',
    remarks: '',
    attachment_path: [],
    items: []
};
let isEditMode = false;
let hasReference = false;

function generateReceiptNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RE-${year}${month}-${random}`;
}

async function render(container, { db, logChange, t, utils, editId }) {
    // 初始化数据：新建或加载编辑数据
    if (editId) {
        const receipt = db.prepare(`SELECT * FROM goods_receipts WHERE id = ?`).get(editId);
        if (!receipt) {
            utils.showAlert('单据不存在');
            window.loadView('goods-receipt');
            return;
        }
        const rows = db.prepare(`
            SELECT ri.*,
                (SELECT 1 FROM goods_issue_items gi WHERE gi.receipt_item_id = ri.id LIMIT 1) AS is_used
            FROM goods_receipt_items ri
            WHERE ri.receipt_id = ?
        `).all(editId);
        const items = rows.map(row => {
            const { is_used, ...item } = row;
            return { ...item, is_used: !!is_used };
        });
        currentReceiptData = {
            id: receipt.id,
            receipt_number: receipt.receipt_number,
            date: receipt.date,
            supplier: receipt.supplier || '',
            supplier_invoice: receipt.supplier_invoice || '',
            remarks: receipt.remarks || '',
            attachment_path: receipt.attachment_path ? utils.normalizeAttachments(receipt.attachment_path) : [],
            items: items.map(i => ({ ...i }))
        };
        isEditMode = true;
        hasReference = currentReceiptData.items.some(i => i.is_used === true); // 检测是否被销售单引用
    } else {
        currentReceiptData = {
            id: null,
            receipt_number: generateReceiptNumber(),
            date: utils.todayStr(),
            supplier: '',
            supplier_invoice: '',
            remarks: '',
            attachment_path: [],
            items: []
        };
        isEditMode = false;
        hasReference = false;
    }

    // 渲染表单HTML
    container.innerHTML = `
        <div class="card">
            <div class="card-header">${isEditMode ? `✏️ ${t('receipt_edit')}` : `📦 ${t('receipt_new')}`}</div>
            ${hasReference ? `<div class="alert alert-warning" style="background-color: #fff3cd; color: #856404; padding: 8px; margin-bottom: 16px; border-radius: 4px;">⚠️ ${t('receipt_referenced_warning')}</div>` : ''}
            <div class="form-group"><label>${t('receipt_number')}</label><input type="text" id="receipt-number" readonly></div>
            <div class="form-group"><label>${t('receipt_date')}</label><input type="date" id="receipt-date" value="${currentReceiptData.date}"></div>
            <div class="form-group"><label>${t('supplier')}</label><input type="text" id="supplier" value="${escapeHtml(currentReceiptData.supplier)}"></div>
            <div class="form-group"><label>${t('supplier_invoice')}</label><input type="text" id="supplier-invoice" value="${escapeHtml(currentReceiptData.supplier_invoice)}"></div>
            <div class="form-group"><label>${t('remarks')}</label><textarea id="receipt-remarks" rows="2" style="width:100%;"></textarea></div>
            <div class="form-group"><label>${t('receipt_attachment')}</label><button id="upload-attachment" class="btn btn-secondary">${t('upload')}</button><span id="attachment-filename"></span></div>
            <hr>
            <div class="form-group"><button id="add-item" class="btn">${t('add_row')}</button></div>
            <table class="detail-table" id="items-table">
                <thead><tr><th>${t('product_name')}</th><th>${t('quantity')}</th><th>${t('unit_price')}</th><th>${t('price_type')}</th><th>${t('tax_rate')} (%)</th><th>${t('total_net')}</th><th>${t('total_tax')}</th><th>${t('actions')}</th></tr></thead>
                <tbody id="items-tbody"></tbody>
            </table>
            <div class="form-group">
                <button id="save-receipt" class="btn">${t('save')}</button>
                <button id="cancel-receipt" class="btn btn-secondary">${t('cancel')}</button>
            </div>
        </div>
    `;

    // 填充表单值
    document.getElementById('receipt-number').value = currentReceiptData.receipt_number;
    document.getElementById('receipt-date').value = currentReceiptData.date;
    document.getElementById('supplier').value = currentReceiptData.supplier;
    document.getElementById('supplier-invoice').value = currentReceiptData.supplier_invoice;
    document.getElementById('receipt-remarks').value = currentReceiptData.remarks;
    // 显示附件链接
    utils.displayAttachmentLinks(document.getElementById('attachment-filename'), currentReceiptData.attachment_path);

    renderItemsTable(currentReceiptData.items, t);
    bindEvents(container, db, logChange, t, utils);
}

function renderItemsTable(items, t) {
    const tbody = document.getElementById('items-tbody');
    tbody.innerHTML = '';
    items.forEach((item, idx) => {
        const row = tbody.insertRow();
        const isDisabled = item.is_used === true;
        row.insertCell(0).innerHTML = `<input type="text" class="item-name" value="${escapeHtml(item.product_name)}" ${isDisabled ? 'disabled' : ''}>`;
        row.insertCell(1).innerHTML = `<input type="number" step="any" class="item-qty" value="${item.quantity}" ${isDisabled ? 'disabled' : ''}>`;
        row.insertCell(2).innerHTML = `<input type="number" step="any" class="item-price" value="${item.net_unit_price}" ${isDisabled ? 'disabled' : ''}>`;
        row.insertCell(3).innerHTML = `<select class="item-price-type" ${isDisabled ? 'disabled' : ''}><option value="net">${t('price_net')}</option><option value="gross">${t('price_gross')}</option></select>`;
        row.insertCell(4).innerHTML = `<select class="item-tax" ${isDisabled ? 'disabled' : ''}>${[19,7,0].map(v => `<option value="${v}" ${item.tax_rate==v ? 'selected' : ''}>${v}%</option>`).join('')}</select>`;
        const netCell = row.insertCell(5);
        const taxCell = row.insertCell(6);
        const actionsCell = row.insertCell(7);
        const delBtn = document.createElement('button');
        delBtn.innerText = t('remove_row');
        delBtn.classList.add('btn', 'btn-danger');
        if (isDisabled) {
            delBtn.disabled = true;
            delBtn.style.opacity = '0.5';
            delBtn.title = `${t('del_button_disabled')}`;
        } else {
            delBtn.onclick = () => {
                items.splice(idx, 1);
                renderItemsTable(items, t);
            };
        }
        actionsCell.appendChild(delBtn);
        function updateCells() {
            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const priceInput = row.querySelector('.item-price');
            let price = parseFloat(priceInput.value) || 0;
            let taxRate = parseInt(row.querySelector('.item-tax').value);
            if (isNaN(taxRate)) taxRate = 19;
            const priceType = row.querySelector('.item-price-type').value;
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
            items[idx].product_name = row.querySelector('.item-name').value;
            items[idx].quantity = qty;
            items[idx].net_unit_price = netPrice;
            items[idx].tax_rate = taxRate;
        }
        if (!isDisabled) {
            row.querySelector('.item-qty').addEventListener('input', updateCells);
            row.querySelector('.item-price').addEventListener('input', updateCells);
            row.querySelector('.item-tax').addEventListener('change', updateCells);
            row.querySelector('.item-price-type').addEventListener('change', updateCells);
        }
        updateCells();
    });
}

function bindEvents(container, db, logChange, t, utils) {
    document.getElementById('add-item').onclick = () => {
        currentReceiptData.items.push({ 
            product_name: '', 
            quantity: 1, 
            net_unit_price: 0, 
            tax_rate: 19,
            is_used: false
        });
        renderItemsTable(currentReceiptData.items, t);
    };
    document.getElementById('upload-attachment').onclick = async () => {
        const newSavedPaths = await utils.uploadMultipleFiles('receipts', currentReceiptData.receipt_number);
        if (newSavedPaths.length) {
            // 追加到现有数组
            currentReceiptData.attachment_path = [...currentReceiptData.attachment_path, ...newSavedPaths];
            // 刷新显示
            utils.displayAttachmentLinks(document.getElementById('attachment-filename'), currentReceiptData.attachment_path);
        }
    };
    document.getElementById('save-receipt').onclick = async () => {
        // 收集表单数据
        currentReceiptData.receipt_number = document.getElementById('receipt-number').value;
        currentReceiptData.date = document.getElementById('receipt-date').value;
        currentReceiptData.supplier = document.getElementById('supplier').value;
        currentReceiptData.supplier_invoice = document.getElementById('supplier-invoice').value;
        currentReceiptData.remarks = document.getElementById('receipt-remarks').value;
        if (currentReceiptData.items.length === 0) {
            utils.showAlert(t('fill_required'));
            return;
        }
        let newId;
        if (hasReference) {
            const updateReceipt = db.prepare(`
                UPDATE goods_receipts SET
                    receipt_number = ?,
                    date = ?,
                    supplier = ?,
                    supplier_invoice = ?,
                    remarks = ?,
                    attachment_path = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `);
            updateReceipt.run(
                currentReceiptData.receipt_number,
                currentReceiptData.date,
                currentReceiptData.supplier,
                currentReceiptData.supplier_invoice,
                currentReceiptData.remarks,
                utils.serializeAttachments(currentReceiptData.attachment_path),
                currentReceiptData.id
            );
            newId = currentReceiptData.id;
        } else {
            const insertReceipt = db.prepare(`
                INSERT OR REPLACE INTO goods_receipts (id, receipt_number, date, supplier, supplier_invoice, remarks, attachment_path, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);
            const receiptId = currentReceiptData.id || null;
            insertReceipt.run(
                receiptId, 
                currentReceiptData.receipt_number, 
                currentReceiptData.date, 
                currentReceiptData.supplier, 
                currentReceiptData.supplier_invoice, 
                currentReceiptData.remarks, 
                utils.serializeAttachments(currentReceiptData.attachment_path)
            );
            newId = receiptId || db.prepare(`SELECT last_insert_rowid() as id`).get().id;
        }
        const allUnusedIds = db.prepare(`
            SELECT ri.id FROM goods_receipt_items ri
            WHERE ri.receipt_id = ? AND NOT EXISTS (
                SELECT 1 FROM goods_issue_items gi WHERE gi.receipt_item_id = ri.id
            )
        `).all(newId).map(row => row.id);
        if (allUnusedIds.length > 0) {
            // 删除所有未被引用的明细
            db.prepare(`DELETE FROM goods_receipt_items WHERE receipt_id = ? AND id IN (${allUnusedIds.map(() => '?').join(',')})`).run(newId, ...allUnusedIds);
        }
        // 插入新明细（只插入未被引用的，且可能是新增的）
        const insertItem = db.prepare(`INSERT INTO goods_receipt_items (receipt_id, product_name, quantity, net_unit_price, tax_rate) VALUES (?, ?, ?, ?, ?)`);
        for (const item of currentReceiptData.items) {
            if (item.is_used) continue; // 跳过被引用的明细
            if (!item.product_name.trim()) continue;
            insertItem.run(newId, item.product_name, item.quantity, utils.roundTo(item.net_unit_price), item.tax_rate);
        }
        logChange('goods_receipts', newId, isEditMode ? 'UPDATE' : 'INSERT', {}, currentReceiptData);
        await utils.showAlert(t('save_success'));
        window.loadView('goods-receipt');  // 返回列表
    };
    document.getElementById('cancel-receipt').onclick = () => {
        window.loadView('goods-receipt');
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;' }[m]));
}

module.exports = { render };