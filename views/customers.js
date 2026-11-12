// 客户管理模块
let currentCustomer = {
    id: null,
    name: '',
    street: '',
    postcode: '',
    city: '',
    ust_idnr: '',
    email: '',
    phone: ''
};
let isEditMode = false;

async function render(container, { db, logChange, t, utils }) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>👥 ${t('menu_customers')}</span>
            </div>
            <div class="form-group"><label>${t('customer_name')}</label><input type="text" id="cust-name" placeholder="${t('customer_name')}"></div>
            <div class="form-group"><label>${t('customer_street')}</label><input type="text" id="cust-street" placeholder="${t('customer_street')}"></div>
            <div class="form-group"><label>${t('customer_postcode')}</label><input type="text" id="cust-postcode" placeholder="${t('customer_postcode')}"></div>
            <div class="form-group"><label>${t('customer_city')}</label><input type="text" id="cust-city" placeholder="${t('customer_city')}"></div>
            <div class="form-group"><label>${t('customer_country')}</label><input type="text" id="cust-country" placeholder="${t('customer_country')}"></div>
            <div class="form-group"><label>${t('customer_vat_id')}</label><input type="text" id="cust-vat" placeholder="${t('customer_vat_id')}"></div>
            <div class="form-group"><label>${t('customer_email')}</label><input type="email" id="cust-email" placeholder="${t('customer_email')}"></div>
            <div class="form-group"><label>${t('customer_phone')}</label><input type="text" id="cust-phone" placeholder="${t('customer_phone')}"></div>
            <div class="form-group">
                <button id="save-customer" class="btn">${t('save')}</button>
                <button id="cancel-customer" class="btn btn-secondary" style="display:none;">${t('cancel')}</button>
            </div>
        </div>
        <div class="card">
            <div class="card-header">📋 ${t('customer_list') || '客户列表'}</div>
            <table class="data-table" id="customer-list">
                <thead><tr><th>${t('customer_name')}</th><th>${t('customer_vat_id')}</th><th>${t('customer_email')}</th><th>${t('actions')}</th></tr></thead>
                <tbody id="customer-tbody"></tbody>
            </table>
        </div>
    `;
    await loadCustomerList(db, t);
    bindEvents(container, db, logChange, t, utils);
}

async function loadCustomerList(db, t) {
    const customers = db.prepare(`SELECT * FROM customers ORDER BY name`).all();
    const tbody = document.getElementById('customer-tbody');
    tbody.innerHTML = '';
    for (const c of customers) {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = c.name;
        row.insertCell(1).innerText = c.ust_idnr || '';
        row.insertCell(2).innerText = c.email || '';
        const actionsCell = row.insertCell(3);
        const editBtn = document.createElement('button');
        editBtn.innerText = t('edit');
        editBtn.classList.add('btn', 'btn-secondary');
        editBtn.style.marginRight = '4px';
        editBtn.onclick = () => loadCustomerForEdit(c.id, db, t);
        const delBtn = document.createElement('button');
        delBtn.innerText = t('delete');
        delBtn.classList.add('btn', 'btn-danger');
        delBtn.onclick = () => deleteCustomer(c.id, db, t);
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
    }
}

async function loadCustomerForEdit(id, db, t) {
    const cust = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
    if (!cust) return;
    currentCustomer = {
        id: cust.id,
        name: cust.name,
        street: cust.street || '',
        postcode: cust.postcode || '',
        city: cust.city || '',
        country: cust.country || '',
        ust_idnr: cust.ust_idnr || '',
        email: cust.email || '',
        phone: cust.phone || ''
    };
    isEditMode = true;
    document.getElementById('cust-name').value = currentCustomer.name;
    document.getElementById('cust-street').value = currentCustomer.street;
    document.getElementById('cust-postcode').value = currentCustomer.postcode;
    document.getElementById('cust-city').value = currentCustomer.city;
    document.getElementById('cust-country').value = currentCustomer.country || '';
    document.getElementById('cust-vat').value = currentCustomer.ust_idnr;
    document.getElementById('cust-email').value = currentCustomer.email;
    document.getElementById('cust-phone').value = currentCustomer.phone;
    document.getElementById('cancel-customer').style.display = 'inline-block';
}

function bindEvents(container, db, logChange, t, utils) {
    document.getElementById('save-customer').onclick = () => {
        const name = document.getElementById('cust-name').value.trim();
        if (!name) {
            utils.showAlert(t('fill_required'));
            return;
        }
        const street = document.getElementById('cust-street').value;
        const postcode = document.getElementById('cust-postcode').value;
        const city = document.getElementById('cust-city').value;
        const country = document.getElementById('cust-country').value;
        const vat = document.getElementById('cust-vat').value;
        const email = document.getElementById('cust-email').value;
        const phone = document.getElementById('cust-phone').value;
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO customers (id, name, street, postcode, city, country, ust_idnr, email, phone, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(currentCustomer.id || null, name, street, postcode, city, country, vat, email, phone);
        const newId = currentCustomer.id || db.prepare(`SELECT last_insert_rowid() as id`).get().id;
        logChange('customers', newId, isEditMode ? 'UPDATE' : 'INSERT', {}, {name});
        utils.showAlert(t('save_success'));
        resetForm(t, utils);
        loadCustomerList(db, t);
    };
    document.getElementById('cancel-customer').onclick = () => resetForm(t, utils);
}

function resetForm(t, utils) {
    currentCustomer = { id: null, name: '', street: '', postcode: '', city: '', ust_idnr: '', email: '', phone: '' };
    isEditMode = false;
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-street').value = '';
    document.getElementById('cust-postcode').value = '';
    document.getElementById('cust-city').value = '';
    document.getElementById('cust-vat').value = '';
    document.getElementById('cust-email').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cancel-customer').style.display = 'none';
}

async function deleteCustomer(id, db, t) {
    const confirmed = await utils.showConfirm(t('confirm_delete'));
    if (!confirmed) return;
    // 检查是否有销售单关联
    const count = db.prepare(`SELECT COUNT(*) as c FROM goods_issues WHERE customer_id = ?`).get(id).c;
    if (count > 0) {
        utils.showAlert('无法删除：该客户已有销售记录');
        return;
    }
    db.prepare(`DELETE FROM customers WHERE id = ?`).run(id);
    await loadCustomerList(db, t);
}

module.exports = { render };
