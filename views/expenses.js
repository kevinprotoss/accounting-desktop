// 其他支出模块
let currentExpense = {
    id: null,
    date: '',
    category: '',
    description: '',
    net_amount: 0,
    tax_rate: 19,
    input_tax: 0,
    is_output_tax: false,
    attachment_path: [],
    supplier_invoice: '',
    remarks: ''
};
let isEditMode = false;

async function render(container, { db, logChange, t, utils }) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>📦 ${t('menu_expenses')}</span>
            </div>
            <div class="form-group"><label>${t('expense_category')}</label><select id="exp-category"><option value="fuel">${t('category_fuel')}</option><option value="car">${t('category_car')}</option><option value="office">${t('category_office')}</option><option value="1percent">${t('category_1percent')}</option><option value="other">${t('category_other')}</option></select></div>
            <div class="form-group"><label>${t('expense_desc')}</label><input type="text" id="exp-desc"></div>
            <div class="form-group"><label>${t('expense_date')}</label><input type="date" id="exp-date" value="${utils.todayStr()}"></div>
            <div class="form-group"><label>${t('net_amount')}</label><input type="number" step="any" id="exp-net" value="0"></div>
            <div class="form-group"><label>${t('tax_rate')}</label><select id="exp-tax"><option value="19">19%</option><option value="7">7%</option><option value="0">0%</option></select></div>
            <div class="form-group"><label>${t('input_tax')}</label><input type="number" step="any" id="exp-tax-amount" readonly></div>
            <div class="form-group"><label><input type="checkbox" id="exp-is-output"> ${t('is_output_tax')}</label></div>
            <div class="form-group"><label>${t('expense_attachment')}</label><button id="upload-expense" class="btn btn-secondary">${t('upload')}</button><span id="exp-filename"></span></div>
            <div class="form-group"><label>${t('supplier_invoice')}</label><input type="text" id="exp-invoice"></div>
            <div class="form-group"><label>${t('remarks')}</label><textarea id="exp-remarks" rows="2"></textarea></div>
            <div class="form-group"><button id="save-expense" class="btn">${t('save')}</button><button id="cancel-expense" class="btn btn-secondary" style="display:none;">${t('cancel')}</button></div>
        </div>
        <div class="card"><div class="card-header">📋 ${t('expense_list') || '支出列表'}</div><table class="data-table" id="expense-list"><thead><tr><th>${t('expense_date')}</th><th>${t('expense_category')}</th><th>${t('expense_desc')}</th><th>${t('net_amount')}</th><th>${t('input_tax')}</th><th>${t('actions')}</th></tr></thead><tbody id="expense-tbody"></tbody></table></div>
    `;
    // 实时计算税额
    document.getElementById('exp-net').addEventListener('input', updateTax);
    document.getElementById('exp-tax').addEventListener('change', updateTax);
    function updateTax() {
        const net = parseFloat(document.getElementById('exp-net').value) || 0;
        let rate = parseInt(document.getElementById('exp-tax').value);
        if (isNaN(rate)) rate = 19;
        const tax = net * rate / 100;
        document.getElementById('exp-tax-amount').value = tax.toFixed(2);
    }
    updateTax();
    await loadExpenseList(db, t);
    bindEvents(container, db, logChange, t, utils);
}

async function loadExpenseList(db, t) {
    const expenses = db.prepare(`SELECT * FROM other_expenses ORDER BY date DESC`).all();
    const tbody = document.getElementById('expense-tbody');
    tbody.innerHTML = '';
    for (const e of expenses) {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = e.date;
        row.insertCell(1).innerText = e.category;
        row.insertCell(2).innerText = e.description || '';

        let netDisplay = e.net_amount.toFixed(2);
        let taxDisplay = e.input_tax.toFixed(2);
        if (e.is_output_tax) {
            netDisplay = '-' + netDisplay;
            taxDisplay = '-' + taxDisplay;
        }
        row.insertCell(3).innerText = netDisplay;
        row.insertCell(4).innerText = taxDisplay;

        const actionsCell = row.insertCell(5);
        const editBtn = document.createElement('button');
        editBtn.innerText = t('edit');
        editBtn.classList.add('btn', 'btn-secondary');
        editBtn.style.marginRight = '4px';
        editBtn.onclick = () => loadExpenseForEdit(e.id, db, t);
        const delBtn = document.createElement('button');
        delBtn.innerText = t('delete');
        delBtn.classList.add('btn', 'btn-danger');
        delBtn.onclick = () => deleteExpense(e.id, db, t);
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
    }
}

async function loadExpenseForEdit(id, db, t) {
    const exp = db.prepare(`SELECT * FROM other_expenses WHERE id = ?`).get(id);
    if (!exp) return;
    currentExpense = {
        id: exp.id,
        date: exp.date,
        category: exp.category,
        description: exp.description || '',
        net_amount: exp.net_amount,
        tax_rate: exp.tax_rate,
        input_tax: exp.input_tax,
        is_output_tax: !!exp.is_output_tax,
        attachment_path: exp.attachment_path ? utils.normalizeAttachments(exp.attachment_path) : [],
        supplier_invoice: exp.supplier_invoice || '',
        remarks: exp.remarks || ''
    };
    isEditMode = true;
    document.getElementById('exp-category').value = currentExpense.category;
    document.getElementById('exp-desc').value = currentExpense.description;
    document.getElementById('exp-date').value = currentExpense.date;
    document.getElementById('exp-net').value = currentExpense.net_amount;
    document.getElementById('exp-tax').value = currentExpense.tax_rate;
    document.getElementById('exp-tax-amount').value = currentExpense.input_tax;
    document.getElementById('exp-is-output').checked = currentExpense.is_output_tax;
    document.getElementById('exp-invoice').value = currentExpense.supplier_invoice;
    document.getElementById('exp-remarks').value = currentExpense.remarks;

    utils.displayAttachmentLinks(document.getElementById('exp-filename'), currentExpense.attachment_path);
    
    document.getElementById('cancel-expense').style.display = 'inline-block';
}

function bindEvents(container, db, logChange, t, utils) {
    document.getElementById('save-expense').onclick = () => {
        const category = document.getElementById('exp-category').value;
        const description = document.getElementById('exp-desc').value;
        const date = document.getElementById('exp-date').value;
        const net = parseFloat(document.getElementById('exp-net').value) || 0;
        const taxRate = parseInt(document.getElementById('exp-tax').value) || 19;
        const tax = parseFloat(document.getElementById('exp-tax-amount').value) || 0;
        const isOutput = document.getElementById('exp-is-output').checked;
        const invoice = document.getElementById('exp-invoice').value;
        const remarks = document.getElementById('exp-remarks').value;
        const attachPath = currentExpense.attachment_path || [];
        if (!date || !category) {
            utils.showAlert(t('fill_required'));
            return;
        }
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO other_expenses (id, date, category, description, net_amount, tax_rate, input_tax, is_output_tax, attachment_path, supplier_invoice, remarks, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(currentExpense.id || null, date, category, description, utils.roundTo(net), taxRate, utils.roundTo(tax), isOutput ? 1 : 0, utils.serializeAttachments(attachPath), invoice, remarks);
        const newId = currentExpense.id || db.prepare(`SELECT last_insert_rowid() as id`).get().id;
        logChange('other_expenses', newId, isEditMode ? 'UPDATE' : 'INSERT', {}, {category, net});
        utils.showAlert(t('save_success'));
        resetForm(t, utils);
        loadExpenseList(db, t);
    };
    document.getElementById('cancel-expense').onclick = () => resetForm(t, utils);
    document.getElementById('upload-expense').onclick = async () => {
        const newSavedPaths = await utils.uploadMultipleFiles('expenses', `expense_${Date.now()}`);
        if (newSavedPaths.length) {
            // 追加到现有数组
            currentExpense.attachment_path = [...currentExpense.attachment_path, ...newSavedPaths];
            // 刷新显示
            utils.displayAttachmentLinks(document.getElementById('exp-filename'), currentExpense.attachment_path);
        }
    };
}

function resetForm(t, utils) {
    currentExpense = {
        id: null,
        date: utils.todayStr(),
        category: 'other',
        description: '',
        net_amount: 0,
        tax_rate: 19,
        input_tax: 0,
        is_output_tax: false,
        attachment_path: [],
        supplier_invoice: '',
        remarks: ''
    };
    isEditMode = false;
    document.getElementById('exp-category').value = 'other';
    document.getElementById('exp-desc').value = '';
    document.getElementById('exp-date').value = utils.todayStr();
    document.getElementById('exp-net').value = 0;
    document.getElementById('exp-tax').value = 19;
    document.getElementById('exp-tax-amount').value = 0;
    document.getElementById('exp-is-output').checked = false;
    document.getElementById('exp-invoice').value = '';
    document.getElementById('exp-remarks').value = '';
    document.getElementById('exp-filename').innerText = '';
    document.getElementById('cancel-expense').style.display = 'none';
}

async function deleteExpense(id, db, t) {
    const confirmed = await utils.showConfirm(t('confirm_delete'));
    if (!confirmed) return;
    db.prepare(`DELETE FROM other_expenses WHERE id = ?`).run(id);
    await loadExpenseList(db, t);
}

module.exports = { render };
