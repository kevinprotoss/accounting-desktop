// views/yabandpay-list.js
async function render(container, { db, t, utils }) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between;">
                <span>💳 ${t('yabandpay_transaction_list')}</span>
                <div>
                    <button id="balance-withdraw-btn" class="btn btn-info" style="margin-right: 8px;">💰 ${t('withdraw')}</button>
                    <button id="sync-remote-btn" class="btn btn-success" style="margin-right: 8px;">🔄 ${t('sync_remote_orders')}</button>
                    <button id="new-payment-btn" class="btn btn-primary">➕ ${t('new_payment')}</button>
                </div>
            </div>
            <div class="search-bar" style="margin-bottom: 16px; display: flex; gap: 12px; align-items: flex-end;">
                <div class="form-group" style="margin-bottom:0;">
                    <label>${t('from_date') || '开始日期'}</label>
                    <input type="date" id="start-date">
                </div>
                <div class="form-group" style="margin-bottom:0;">
                    <label>${t('to_date') || '结束日期'}</label>
                    <input type="date" id="end-date">
                </div>
                <button id="search-btn" class="btn">${t('search')}</button>
            </div>
            <table class="data-table" id="transaction-table">
                <thead>
                    <tr>
                        <th>${t('order_id') || '支付订单号'}</th>
                        <th>${t('trade_id') || 'YabandPay交易号'}</th>
                        <th>${t('amount') || '金额 (€)'}</th>
                        <th>${t('state') || '支付状态'}</th>
                        <th>${t('actions') || '操作'}</th>
                    </tr>
                </thead>
                <tbody id="transaction-tbody"></tbody>
            </table>
        </div>
        <!-- 余额提现模态框 -->
        <div id="balance-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; justify-content: center; align-items: center;">
            <div style="background: white; padding: 20px; border-radius: 8px; width: 450px;">
                <h3 style="margin-bottom: 20px;">${t('balance_details')}</h3>
                <div class="form-group"><label>${t('available_balance')}</label><span id="modal-available">--</span> €</div>
                <div class="form-group"><label>${t('deposit_balance')}</label><span id="modal-deposit">--</span> €</div>
                <div class="form-group"><label>${t('usable_balance')}</label><span id="modal-usable">--</span> €</div>
                <hr style="margin: 20px 0;">
                <div class="form-group"><label>${t('withdraw_amount')}</label><input type="number" id="withdraw-amount" step="0.01" class="form-control"></div>
                <div class="form-group"><label>${t('withdraw_reference')}</label><input type="text" id="withdraw-reference" class="form-control" placeholder="${t('optional')}"></div>
                <div class="form-group" style="text-align: right;">
                    <button id="cancel-withdraw" class="btn btn-secondary">${t('cancel')}</button>
                    <button id="confirm-withdraw" class="btn btn-primary">${t('confirm_withdraw')}</button>
                </div>
            </div>
        </div>
    `;

    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    // 获取按钮元素
    const balanceBtn = document.getElementById('balance-withdraw-btn');
    const syncBtn = document.getElementById('sync-remote-btn');
    const newBtn = document.getElementById('new-payment-btn');
    const searchBtn = document.getElementById('search-btn');
    const modal = document.getElementById('balance-modal');
    const cancelBtn = document.getElementById('cancel-withdraw');
    const confirmBtn = document.getElementById('confirm-withdraw');

    // 辅助函数：加载余额并更新按钮文本
    async function loadBalanceAndUpdateButton() {
        try {
            const result = await utils.yabandpayGetBalance();
            if (result.status && result.data) {
                const usable = parseFloat(result.data.usable).toFixed(2);
                balanceBtn.innerHTML = `💰 ${usable} € ${t('withdraw')}`;
                // 同时缓存余额数据供模态框使用
                balanceBtn._balanceData = result.data;
            } else {
                balanceBtn.innerHTML = `⚠️ ${t('balance_error')}`;
            }
        } catch (err) {
            console.error(err);
            balanceBtn.innerHTML = `⚠️ ${t('balance_error')}`;
        }
    }

    // 打开模态框，填充余额信息
    function showBalanceModal() {
        const data = balanceBtn._balanceData;
        if (data) {
            document.getElementById('modal-available').innerText = parseFloat(data.available).toFixed(2);
            document.getElementById('modal-deposit').innerText = parseFloat(data.deposit).toFixed(2);
            document.getElementById('modal-usable').innerText = parseFloat(data.usable).toFixed(2);
        } else {
            document.getElementById('modal-available').innerText = '--';
            document.getElementById('modal-deposit').innerText = '--';
            document.getElementById('modal-usable').innerText = '--';
        }
        document.getElementById('withdraw-amount').value = '';
        document.getElementById('withdraw-reference').value = '';
        modal.style.display = 'flex';
    }

    // 关闭模态框
    function closeModal() {
        modal.style.display = 'none';
    }

    // 提现确认
    async function handleWithdraw() {
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        const reference = document.getElementById('withdraw-reference').value.trim();
        if (isNaN(amount) || amount <= 0) {
            utils.showAlert(t('invalid_amount'));
            return;
        }
        const usable = parseFloat(document.getElementById('modal-usable').innerText);
        if (amount > usable) {
            utils.showAlert(t('amount_exceeds_usable'));
            return;
        }
        try {
            const { notifyUrl = '' } = configs.yabandpaySetting;
            const result = await utils.yabandpayWithdraw(amount, notifyUrl, reference);
            if (result.status) {
                utils.showAlert(t('withdraw_success'));
                closeModal();
                // 不刷新余额按钮，因为提现异步；用户下次进入页面会自动更新
            } else {
                throw new Error(result.message || '提现失败');
            }
        } catch (err) {
            utils.showAlert(t('withdraw_failed') + ': ' + err.message);
        }
    }

    balanceBtn.onclick = showBalanceModal;
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = handleWithdraw;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    // 初始加载余额
    await loadBalanceAndUpdateButton();
    // 禁用按钮
    balanceBtn.disabled = true;
    balanceBtn.style.opacity = '0.5';
    balanceBtn.title = '提现功能暂未开放';

    // 默认最近一个月
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    startDateInput.value = utils.formatDate(oneMonthAgo);
    endDateInput.value = utils.todayStr();

    syncBtn.onclick = () => {
        window.loadView('yabandpay-remote-sync');
    };

    newBtn.onclick = () => {
        window._currentPaymentOrderId = null; // 新建模式
        window.loadView('yabandpay-form');
    };

    async function loadTransactions() {
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;
        let sql = `SELECT id, order_id, trade_id, amount, status, created_at FROM payment_orders WHERE 1=1`;
        const params = [];
        if (startDate) {
            sql += ` AND date(created_at) >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            sql += ` AND date(created_at) <= ?`;
            params.push(endDate);
        }
        sql += ` ORDER BY created_at DESC`;
        const orders = db.prepare(sql).all(params);
        renderTable(orders, t);
    }

    function renderTable(orders, t) {
        const tbody = document.getElementById('transaction-tbody');
        tbody.innerHTML = '';
        for (const order of orders) {
            const row = tbody.insertRow();
            row.insertCell(0).innerText = order.order_id;
            row.insertCell(1).innerText = order.trade_id || '—';
            row.insertCell(2).innerText = order.amount.toFixed(2);
            row.insertCell(3).innerText = order.status; // 可后续映射
            const actionsCell = row.insertCell(4);
    
            // 明细按钮
            const detailBtn = document.createElement('button');
            detailBtn.innerText = t('detail') || '明细';
            detailBtn.classList.add('btn', 'btn-secondary');
            detailBtn.onclick = () => {
                window._currentPaymentOrderId = order.id;
                window.loadView('yabandpay-form');
            };
            actionsCell.appendChild(detailBtn);
    
            // 取消按钮（仅当 pending 且 trade_id 存在）
            if (order.status === 'pending' && order.trade_id) {
                const cancelBtn = document.createElement('button');
                cancelBtn.innerText = t('cancel') || '取消';
                cancelBtn.classList.add('btn', 'btn-danger');
                cancelBtn.onclick = async () => {
                    if (await utils.showConfirm(t('confirm_cancel'))) {
                        try {
                            await utils.yabandpayCancel(order.trade_id);
                            // 更新本地状态
                            db.prepare(`UPDATE payment_orders SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(order.id);
                            loadTransactions(); // 刷新列表
                            utils.showAlert(t('cancel_success'));
                        } catch (err) {
                            utils.showAlert(t('cancel_failed') + ': ' + err.message);
                        }
                    }
                };
                actionsCell.appendChild(cancelBtn);
            }
        }
    }

    searchBtn.onclick = loadTransactions;
    await loadTransactions();
}

module.exports = { render };