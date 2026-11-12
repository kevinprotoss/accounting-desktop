// 税务报表模块
async function render(container, { db, t, utils }) {
    const currentYear = new Date().getFullYear();
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>📊 ${t('menu_tax')}</span>
            </div>
            <div class="search-bar">
                <div class="form-group"><label>${t('tax_year')}</label><input type="number" id="tax-year" value="${currentYear}"></div>
                <div class="form-group"><label>${t('tax_quarter')}</label><select id="tax-quarter"><option value="1">Q1</option><option value="2">Q2</option><option value="3">Q3</option><option value="4">Q4</option></select></div>
                <button id="calc-tax" class="btn">${t('search')}</button>
                <button id="export-elster" class="btn btn-secondary">${t('export_elster')}</button>
            </div>
            <div id="tax-result" style="margin-top: 20px;">
                <!-- 计算结果展示 -->
            </div>
        </div>
    `;

    document.getElementById('calc-tax').addEventListener('click', () => calculateTax(db, t));
    document.getElementById('export-elster').addEventListener('click', () => exportElster(db, t));
    calculateTax(db, t);
}

function calculateTax(db, t) {
    const year = parseInt(document.getElementById('tax-year').value);
    const quarter = parseInt(document.getElementById('tax-quarter').value);
    const startMonth = (quarter-1)*3 + 1;
    const endMonth = quarter*3;
    const startDate = `${year}-${String(startMonth).padStart(2,'0')}-01`;
    const endDate = `${year}-${String(endMonth).padStart(2,'0')}-31`;

    // 1. 国内销售（非出口，税率19%或7%）
    const domestic = db.prepare(`
        SELECT SUM(gi.selling_net_price * gi.quantity) as net, SUM(gi.selling_net_price * gi.quantity * gi.tax_rate / 100) as tax
        FROM goods_issues g
        JOIN goods_issue_items gi ON g.id = gi.issue_id
        WHERE g.date BETWEEN ? AND ? AND g.is_export = 0
    `).get(startDate, endDate);
    const domesticNet = domestic.net || 0;
    const domesticTax = domestic.tax || 0;

    // 2. 出口销售（is_export = 1）
    const exportSales = db.prepare(`
        SELECT SUM(gi.selling_net_price * gi.quantity) as net
        FROM goods_issues g
        JOIN goods_issue_items gi ON g.id = gi.issue_id
        WHERE g.date BETWEEN ? AND ? AND g.is_export = 1
    `).get(startDate, endDate);
    const exportNet = exportSales.net || 0;

    // 3. 进项税（来自 goods_receipt_items 的税额）
    const inputTaxReceipts = db.prepare(`
        SELECT SUM(ri.quantity * ri.net_unit_price * ri.tax_rate / 100) as tax
        FROM goods_receipts r
        JOIN goods_receipt_items ri ON r.id = ri.receipt_id
        WHERE r.date BETWEEN ? AND ?
    `).get(startDate, endDate);
    let inputTax = inputTaxReceipts.tax || 0;

    // 4. 其他支出中的进项税（is_output_tax = 0）
    const inputTaxExpenses = db.prepare(`
        SELECT SUM(input_tax) as tax FROM other_expenses
        WHERE date BETWEEN ? AND ? AND is_output_tax = 0
    `).get(startDate, endDate);
    inputTax += (inputTaxExpenses.tax || 0);

    // 5. 附加销项税（is_output_tax = 1，如1%规则）
    const additionalOutput = db.prepare(`
        SELECT SUM(input_tax) as tax FROM other_expenses
        WHERE date BETWEEN ? AND ? AND is_output_tax = 1
    `).get(startDate, endDate);
    const additionalTax = additionalOutput.tax || 0;

    const totalOutputTax = domesticTax + additionalTax;
    const vatPayable = totalOutputTax - inputTax;

    const resultHtml = `
        <table class="data-table">
            <tr><th>${t('domestic_sales_net')}</th><td>${domesticNet.toFixed(2)} €</td></tr>
            <tr><th>${t('domestic_tax')}</th><td>${domesticTax.toFixed(2)} €</td></tr>
            <tr><th>${t('export_sales_net')}</th><td>${exportNet.toFixed(2)} €</td></tr>
            <tr><th>${t('input_tax_total')}</th><td>${inputTax.toFixed(2)} €</td></tr>
            <tr><th>${t('additional_output_tax')}</th><td>${additionalTax.toFixed(2)} €</td></tr>
            <tr><th>${t('total_output_tax')}</th><td>${totalOutputTax.toFixed(2)} €</td></tr>
            <tr><th style="background:#f0f0f0">${t('vat_payable')}</th><td style="background:#f0f0f0"><strong>${vatPayable.toFixed(2)} €</strong></td></tr>
        </table>
    `;
    document.getElementById('tax-result').innerHTML = resultHtml;
    // 保存数据用于导出
    window.currentTaxData = { year, quarter, domesticNet, domesticTax, exportNet, inputTax, additionalTax, totalOutputTax, vatPayable };
}

function exportElster(db, t) {
    if (!window.currentTaxData) {
        utils.showAlert('请先计算税务数据');
        return;
    }
    const data = window.currentTaxData;
    const lines = [
        `ELSTER Umsatzsteuer-Voranmeldung ${data.year} Q${data.quarter}`,
        `Zeile 13 (19% Umsatz): ${data.domesticNet.toFixed(2)} €`,
        `Zeile 13 Steuer: ${data.domesticTax.toFixed(2)} €`,
        `Zeile 22 (0% Ausfuhr): ${data.exportNet.toFixed(2)} €`,
        `Zeile 38 Vorsteuer: ${data.inputTax.toFixed(2)} €`,
        `Zusätzliche USt (1% usw.): ${data.additionalTax.toFixed(2)} €`,
        `Zahllast: ${data.vatPayable.toFixed(2)} €`,
    ];
    const blob = new Blob([lines.join('\n')], {type: 'text/plain'});
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `elster_${data.year}_Q${data.quarter}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    utils.showAlert(t('export_success'));
}

module.exports = { render };
