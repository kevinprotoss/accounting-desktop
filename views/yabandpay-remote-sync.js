// views/yabandpay-remote-sync.js
async function render(container, { db, t, utils }) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between;">
                <span>🔄 ${t('sync_remote_yabandpay_orders')}</span>
                <button id="back-btn" class="btn btn-secondary">${t('back_to_list')}</button>
            </div>
            <div class="search-bar" style="margin-bottom: 16px; display: flex; gap: 12px; align-items: flex-end;">
                <div class="form-group" style="margin-bottom:0;">
                    <label>${t('from_date')}</label>
                    <input type="date" id="start-date">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>${t('to_date')}</label>
                    <input type="date" id="end-date">
                </div>
                <button id="search-btn" class="btn">${t('search')}</button>
            </div>
            <table class="data-table" id="remote-transactions-table">
                <thead>
                    <tr>
                        <th>${t('trade_id')}</th>
                        <th>${t('amount')}</th>
                        <th>${t('state')}</th>
                        <th>${t('pay_time')}</th>
                        <th>${t('actions')}</th>
                    </tr>
                </thead>
                <tbody id="remote-tbody"></tbody>
            </table>
        </div>
    `;

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    const searchBtn = document.getElementById('search-btn');
    const backBtn = document.getElementById('back-btn');

    // 默认最近一个月
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    startDateInput.value = utils.formatDate(oneMonthAgo);
    endDateInput.value = utils.todayStr();

    backBtn.onclick = () => window.loadView('yabandpay-overview');

    async function loadRemoteTransactions() {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        if (!startDate || !endDate) {
            utils.showAlert('请选择开始和结束日期');
            return;
        }

        // 转换日期为时间戳（YabandPay batchquery 需要秒级时间戳）
        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000) + 86399;

        try {
            // 调用批量查询接口，返回 CSV 字符串
            // const csvString = await utils.yabandpayBatchQuery(startTimestamp, endTimestamp);
            // const transactions = utils.parseYabandpayBatchCSV(csvString);
            // 临时 mock
            // const transactions = utils.mockYabandpayBatchQuery();
            const result = await utils.yabandpayGetTradebill(startTimestamp, endTimestamp);
            if (!result.status || result.code !== "200") {
                throw new Error(result.message || '查询失败');
            }
            const transactions = result.data.tradebill || [];

            // 获取本地已存在的 trade_id 列表（排除已导入的）
            const existingTradeIds = new Set(
                db.prepare(`SELECT trade_id FROM payment_orders WHERE trade_id IS NOT NULL`).all().map(row => row.trade_id)
            );

            // 过滤出未导入的订单
            const newTransactions = transactions.filter(tx => !existingTradeIds.has(tx.trade_id));

            renderTable(newTransactions, t, db, utils);
        } catch (err) {
            utils.showAlert('查询远程订单失败：' + err.message);
        }
    }

    function renderTable(transactions, t, db, utils) {
        const tbody = document.getElementById('remote-tbody');
        tbody.innerHTML = '';

        for (const tx of transactions) {
            const tradeId = tx.trade_id;
            const remoteOrderId = tx.order_id || '';
            const amount = parseFloat(tx.amount) || 0;
            const state = tx.state || '—';
            const payTime = tx.date || '';

            const row = tbody.insertRow();
            row.insertCell(0).innerText = tradeId;
            row.insertCell(1).innerText = amount.toFixed(2);
            row.insertCell(2).innerText = state;
            row.insertCell(3).innerText = payTime;
            const actionsCell = row.insertCell(4);

            const importBtn = document.createElement('button');
            importBtn.innerText = t('import_local');
            importBtn.classList.add('btn', 'btn-primary');
            importBtn.onclick = async () => {
                if (await utils.showConfirm(t('confirm_import'))) {
                    try {
                        // 插入 payment_orders 表
                        const localOrderId = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                        let description = tx.description || '';
                        if (remoteOrderId) {
                            description = `Remote Order: ${remoteOrderId} | ${tx.description || ''}`;
                        }
                        const insertStmt = db.prepare(`
                            INSERT INTO payment_orders (order_id, trade_id, amount, currency, description, status, pay_time, source, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, 'remote', CURRENT_TIMESTAMP)
                        `);
                        insertStmt.run(
                            localOrderId,
                            tradeId,
                            amount,
                            tx['Currency'] || 'EUR',
                            description,
                            state,
                            payTime,
                        );
                        utils.showAlert(t('import_success'));
                        // 从列表中移除当前行（或禁用按钮）
                        importBtn.disabled = true;
                        importBtn.innerText = t('imported');
                        importBtn.classList.remove('btn-primary');
                        importBtn.classList.add('btn-secondary');
                    } catch (err) {
                        utils.showAlert(t('import_failed') + ': ' + err.message);
                    }
                }
            };
            actionsCell.appendChild(importBtn);
        }
    }

    searchBtn.onclick = loadRemoteTransactions;
    await loadRemoteTransactions();
}

module.exports = { render };