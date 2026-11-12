// 公司车管理模块
let currentCar = {
    id: null,
    license_plate: '',
    gross_list_price: 0,
    acquisition_date: '',
    active: true
};
let isEditMode = false;

async function render(container, { db, logChange, t, utils }) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>🚗 ${t('menu_cars')}</span>
            </div>
            <div class="form-group"><label>${t('license_plate')}</label><input type="text" id="car-license" placeholder="${t('license_plate')}"></div>
            <div class="form-group"><label>${t('gross_list_price')}</label><input type="number" step="any" id="car-price" value="0"></div>
            <div class="form-group"><label>${t('acquisition_date')}</label><input type="date" id="car-date" value="${utils.todayStr()}"></div>
            <div class="form-group"><label><input type="checkbox" id="car-active" checked> ${t('active')}</label></div>
            <div class="form-group">
                <button id="save-car" class="btn">${t('save')}</button>
                <button id="cancel-car" class="btn btn-secondary" style="display:none;">${t('cancel')}</button>
            </div>
        </div>
        <div class="card">
            <div class="card-header">📋 ${t('car_list') || '车辆列表'}</div>
            <table class="data-table" id="car-list"><thead><tr><th>${t('license_plate')}</th><th>${t('gross_list_price')}</th><th>${t('acquisition_date')}</th><th>${t('active')}</th><th>${t('actions')}</th></tr></thead><tbody id="car-list-tbody"></tbody></table>
        </div>
        <div class="card">
            <div class="card-header">📆 ${t('generate_1percent')}</div>
            <div class="form-group"><label>${t('tax_year')}</label><input type="number" id="gen-year" value="${new Date().getFullYear()}"></div>
            <div class="form-group"><label>${t('tax_quarter')}</label><select id="gen-quarter"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select></div>
            <button id="gen-1percent" class="btn">${t('generate_1percent')}</button>
            <div id="gen-result" style="margin-top: 12px;"></div>
        </div>
    `;
    await loadCarList(db, t);
    bindEvents(container, db, logChange, t, utils);
}

async function loadCarList(db, t) {
    const cars = db.prepare(`SELECT * FROM company_cars ORDER BY acquisition_date DESC`).all();
    const tbody = document.getElementById('car-list-tbody');
    tbody.innerHTML = '';
    for (const car of cars) {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = car.license_plate;
        row.insertCell(1).innerText = car.gross_list_price.toFixed(2);
        row.insertCell(2).innerText = car.acquisition_date || '';
        row.insertCell(3).innerText = car.active ? t('yes') : t('no');
        const actionsCell = row.insertCell(4);
        const editBtn = document.createElement('button');
        editBtn.innerText = t('edit');
        editBtn.classList.add('btn', 'btn-secondary');
        editBtn.style.marginRight = '4px';
        editBtn.onclick = () => loadCarForEdit(car.id, db, t);
        const delBtn = document.createElement('button');
        delBtn.innerText = t('delete');
        delBtn.classList.add('btn', 'btn-danger');
        delBtn.onclick = () => deleteCar(car.id, db, t);
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
    }
}

async function loadCarForEdit(id, db, t) {
    const car = db.prepare(`SELECT * FROM company_cars WHERE id = ?`).get(id);
    if (!car) return;
    currentCar = {
        id: car.id,
        license_plate: car.license_plate,
        gross_list_price: car.gross_list_price,
        acquisition_date: car.acquisition_date || '',
        active: !!car.active
    };
    isEditMode = true;
    document.getElementById('car-license').value = currentCar.license_plate;
    document.getElementById('car-price').value = currentCar.gross_list_price;
    document.getElementById('car-date').value = currentCar.acquisition_date;
    document.getElementById('car-active').checked = currentCar.active;
    document.getElementById('cancel-car').style.display = 'inline-block';
}

function bindEvents(container, db, logChange, t, utils) {
    document.getElementById('save-car').onclick = () => {
        const license = document.getElementById('car-license').value.trim();
        if (!license) {
            utils.showAlert(t('fill_required'));
            return;
        }
        const price = parseFloat(document.getElementById('car-price').value) || 0;
        const date = document.getElementById('car-date').value;
        const active = document.getElementById('car-active').checked;
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO company_cars (id, license_plate, gross_list_price, acquisition_date, active)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(currentCar.id || null, license, price, date, active ? 1 : 0);
        const newId = currentCar.id || db.prepare(`SELECT last_insert_rowid() as id`).get().id;
        logChange('company_cars', newId, isEditMode ? 'UPDATE' : 'INSERT', {}, {license, price, date, active});
        utils.showAlert(t('save_success'));
        // reset form
        currentCar = { id: null, license_plate: '', gross_list_price: 0, acquisition_date: '', active: true };
        isEditMode = false;
        document.getElementById('car-license').value = '';
        document.getElementById('car-price').value = 0;
        document.getElementById('car-date').value = utils.todayStr();
        document.getElementById('car-active').checked = true;
        document.getElementById('cancel-car').style.display = 'none';
        loadCarList(db, t);
    };
    document.getElementById('cancel-car').onclick = () => {
        currentCar = { id: null, license_plate: '', gross_list_price: 0, acquisition_date: '', active: true };
        isEditMode = false;
        document.getElementById('car-license').value = '';
        document.getElementById('car-price').value = 0;
        document.getElementById('car-date').value = utils.todayStr();
        document.getElementById('car-active').checked = true;
        document.getElementById('cancel-car').style.display = 'none';
    };
    document.getElementById('gen-1percent').onclick = async () => {
        const year = parseInt(document.getElementById('gen-year').value);
        const quarter = parseInt(document.getElementById('gen-quarter').value);
        // 获取所有激活的车辆
        const cars = db.prepare(`SELECT * FROM company_cars WHERE active = 1`).all();
        if (cars.length === 0) {
            document.getElementById('gen-result').innerHTML = '<span style="color:red;">没有激活的车辆</span>';
            return;
        }
        // 计算季度月份数
        let months = 3;
        // 简单处理：不考虑车辆购置日期在季度内的情况，个体户可接受
        const startMonth = (quarter-1)*3 + 1;
        const endMonth = quarter*3;
        // 为每个车辆生成一条支出记录（或者分别生成）
        let created = 0;
        for (const car of cars) {
            // 每月1%金额（含税）: gross_list_price * 0.01
            const monthlyGross = car.gross_list_price * 0.01;
            // 每月净额 = monthlyGross / 1.19
            const monthlyNet = monthlyGross / 1.19;
            const monthlyTax = monthlyGross - monthlyNet;
            const totalNet = monthlyNet * months;
            const totalTax = monthlyTax * months;
            // 检查是否已经生成了该季度此车辆的1%规则记录（避免重复）
            const existing = db.prepare(`
                SELECT id FROM other_expenses 
                WHERE category = '1percent' AND description LIKE ? AND date BETWEEN ? AND ?
            `).get(`%${car.license_plate}%`, `${year}-${String(startMonth).padStart(2,'0')}-01`, `${year}-${String(endMonth).padStart(2,'0')}-31`);
            if (existing) {
                continue;
            }
            const insertStmt = db.prepare(`
                INSERT INTO other_expenses (date, category, description, net_amount, tax_rate, input_tax, is_output_tax, remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const recordDate = `${year}-${String(startMonth).padStart(2,'0')}-01`;
            insertStmt.run(recordDate, '1percent', `1% Regelung ${car.license_plate} Q${quarter} ${year}`, totalNet, 19, totalTax, 1, `Auto-generated for ${car.license_plate}`);
            created++;
        }
        document.getElementById('gen-result').innerHTML = `<span style="color:green;">生成了 ${created} 条1%规则支出记录</span>`;
        // 刷新 expense 列表如果可见？这里不刷新，由用户自行查看。
    };
}

async function deleteCar(id, db, t) {
    const confirmed = await utils.showConfirm(t('confirm_delete'));
    if (!confirmed) return;
    db.prepare(`DELETE FROM company_cars WHERE id = ?`).run(id);
    await loadCarList(db, t);
}

module.exports = { render };

