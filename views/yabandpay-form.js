// views/yabandpay-form.js
let currentPaymentOrderId = null;
let isEditMode = false;
let hasLocalLink = false;

async function render(container, { db, logChange, t, utils, editId }) {
    currentPaymentOrderId = editId || null;
    isEditMode = !!currentPaymentOrderId;

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                ${isEditMode ? (t('payment_detail') || '支付明细') : (t('new_payment') || '新建支付')}
            </div>
            <form id="payment-form">
                ${isEditMode ? `
                <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
                    <label style="flex-shrink: 0;">${t('order_id') || '支付订单号'}</label>
                    <input type="text" id="order-id" class="form-control" readonly style="background-color: #e9ecef; flex: 1;">
                    <button type="button" id="show-qrcode-btn" class="btn btn-info" style="flex-shrink: 0;">${t('show_qrcode') || '显示二维码'}</button>
                </div>
                ` : `
                <div class="form-group">
                    <label>${t('order_id') || '支付订单号'}</label>
                    <input type="text" id="order-id" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                `}
                ${isEditMode ? `
                <div class="form-group">
                    <label>${t('trade_id') || 'YabandPay交易号'}</label>
                    <input type="text" id="trade-id" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                ` : ''}
                <div class="form-group">
                    <label>${t('select_issues') || '关联销售单'}</label>
                    <select id="issue-select" multiple size="5" class="form-control"></select>
                    <small>${t('ctrl_multiselect') || '按住 Ctrl 键多选'}</small>
                </div>
                <div class="form-group">
                    <label>${t('amount') || '金额 (€)'}</label>
                    <input type="number" id="amount" step="0.01" class="form-control" ${isEditMode ? 'readonly style="background-color: #e9ecef;"' : ''}>
                </div>
                <div class="form-group">
                    <label>${t('currency') || '货币'}</label>
                    <input type="text" id="currency" class="form-control" readonly style="background-color: #e9ecef;" value="EUR">
                </div>
                <div class="form-group">
                    <label>${t('order_description') || '订单描述'}</label>
                    <input type="text" id="description" class="form-control" ${isEditMode ? 'readonly style="background-color: #e9ecef;"' : ''}>
                </div>
                <!-- timeout 仅新建模式显示 -->
                ${!isEditMode ? `
                <div class="form-group">
                    <label>${t('timeout') || '过期时间'}</label>
                    <div style="display: flex; align-items: center;">
                        <input type="number" id="timeout" class="form-control" value="60" min="1" max="1440" style="flex: 1;">
                        <span style="margin-left: 8px;">${t('minutes') || '分钟'}</span>
                    </div>
                    <small>${t('timeout_hint') || '支付二维码过期时间, 范围1-1440分钟'}</small>
                </div>
                ` : ''}
                <!-- 只读扩展字段（编辑模式显示） -->
                ${isEditMode ? `
                <div class="form-group">
                    <label>${t('state') || '支付状态'}</label>
                    <input type="text" id="state" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                <div class="form-group">
                    <label>${t('pay_method') || '支付方式'}</label>
                    <input type="text" id="pay_method" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                <div class="form-group">
                    <label>${t('sub_pay_method') || '子支付方式'}</label>
                    <input type="text" id="sub_pay_method" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                <div class="form-group">
                    <label>${t('pay_time') || '支付时间'}</label>
                    <input type="text" id="pay-time" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                <div class="form-group">
                    <label>${t('settlement_amount') || '结算金额'}</label>
                    <input type="text" id="settlement_amount" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                <div class="form-group">
                    <label>${t('settlement_currency') || '结算货币'}</label>
                    <input type="text" id="settlement_currency" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                <div class="form-group">
                    <label>${t('merchant_cost') || '商户手续费'}</label>
                    <input type="text" id="merchant_cost" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                <div class="form-group">
                    <label>${t('create_date') || '创建时间'}</label>
                    <input type="text" id="create_date" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                <div class="form-group">
                    <label>${t('source') || '来源'}</label>
                    <input type="text" id="source" class="form-control" readonly style="background-color: #e9ecef;">
                </div>
                ` : ''}
                <div class="form-group">
                    <!-- 编辑模式下增加“刷新状态”按钮（仅当 trade_id 存在时显示） -->
                    ${isEditMode ? `<button type="button" id="refresh-btn" class="btn btn-info">${t('refresh') || '刷新'}</button>` : ''}
                    <button id="save-btn" type="button" class="btn btn-primary">${t('save') || '保存'}</button>
                    <button id="cancel-btn" type="button" class="btn btn-secondary">${t('cancel') || '取消'}</button>
                </div>
            </form>
            <!-- 二维码模态框 -->
            <div id="qrcode-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; justify-content: center; align-items: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; text-align: center;">
                    <h4>${t('payment_qrcode') || '支付二维码'}</h4>
                    <div id="modal-qrcode-container"></div>
                    <p id="scan-to-pay-hint" style="margin-bottom: 8px;"><small>${t('scan_to_pay') || '请使用手机扫描二维码支付'}</small></p>
                    <button id="close-modal-btn" class="btn btn-secondary">${t('close') || '关闭'}</button>
                </div>
            </div>
        </div>
    `;

    if (isEditMode) {
        await loadAndPrepareEdit(container, db, t, utils);
    } else {
        await prepareCreate(container, db, t, utils);
    }

    document.getElementById('cancel-btn').onclick = () => window.loadView('yabandpay-overview');
    if (!isEditMode || !hasLocalLink) {
        document.getElementById('save-btn').onclick = isEditMode ? () => saveAssociationsOnly(container, db, t, utils) : () => createAndSave(container, db, t, utils);
    }
    // 刷新按钮事件
    if (isEditMode) {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) refreshBtn.onclick = () => refreshOrder(container, db, t, utils);
    }
    // 二维码按钮事件（在 loadAndPrepareEdit 中根据 qrcode_url 动态启用，这里仅定义模态框关闭）
    const modal = document.getElementById('qrcode-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    if (closeModalBtn) {
        closeModalBtn.onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    }
}

async function prepareCreate(container, db, t, utils) {
    // 加载未关联的销售单
    const availableIssues = db.prepare(`
        SELECT gi.id, gi.issue_number, gi.invoice_number, 
               (SELECT SUM(gi2.selling_net_price * gi2.quantity * (1 + gi2.tax_rate/100)) 
                FROM goods_issue_items gi2 
                WHERE gi2.issue_id = gi.id) as total_gross
        FROM goods_issues gi
        WHERE gi.id NOT IN (SELECT issue_id FROM payment_order_issues)
        ORDER BY gi.date DESC
    `).all();

    const selectEl = document.getElementById('issue-select');
    selectEl.innerHTML = '';
    if (availableIssues.length === 0) {
        selectEl.innerHTML = '<option disabled>没有可关联的销售单（请先创建销售单）</option>';
        selectEl.disabled = true;
    } else {
        for (const issue of availableIssues) {
            const option = document.createElement('option');
            option.value = issue.id;
            option.textContent = `${issue.issue_number} (${issue.invoice_number}) - ${(issue.total_gross || 0).toFixed(2)} €`;
            selectEl.appendChild(option);
        }
        selectEl.disabled = false;
    }

    const amountInput = document.getElementById('amount');
    const descriptionInput = document.getElementById('description');

    function updateAmount() {
        const selected = Array.from(selectEl.selectedOptions);
        let total = 0;
        for (const opt of selected) {
            const issueId = parseInt(opt.value);
            const issue = availableIssues.find(i => i.id === issueId);
            if (issue && issue.total_gross) total += issue.total_gross;
        }
        amountInput.value = total.toFixed(2);
        if (selected.length > 0) {
            const numbers = selected.map(opt => opt.textContent.split(' ')[0]).join(',');
            descriptionInput.value = `Payment for issues: ${numbers}`; // 修改前缀
        } else {
            descriptionInput.value = '';
        }
    }

    selectEl.addEventListener('change', updateAmount);
    updateAmount();

    const tempOrderId = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    document.getElementById('order-id').value = tempOrderId;
}

async function syncOrderFromRemote(tradeId, paymentOrderId, db, utils) {
    if (!tradeId) return null;
    try {
        const result = await utils.yabandpayQueryOrder(tradeId);
        const trans = result.data.transaction_info;
        const newStatus = trans.state;
        const payTime = trans.paid_at ? utils.formatTimestamp(trans.paid_at) : null;
        // 更新本地数据库 (只更新 status 和 pay_time)
        db.prepare(`UPDATE payment_orders SET status = ?, pay_time = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .run(newStatus, payTime, paymentOrderId);
        // 返回所有需要的字段（包括扩展字段）
        return {
            status: newStatus,
            payTime: payTime,
            payMethod: trans.pay_method || '',
            subPayMethod: trans.sub_pay_method || '',
            settlementAmount: trans.settlement_amount || '',
            settlementCurrency: trans.settlement_currency || '',
            merchantCost: trans.merchant_cost || '',
        };
    } catch (err) {
        console.warn('远程同步失败:', err);
        return null;
    }
}

async function refreshOrder(container, db, t, utils, silent = false) {
    const tradeIdInput = document.getElementById('trade-id');
    const tradeId = tradeIdInput ? tradeIdInput.value : '';
    if (!tradeId) {
        utils.showAlert('该订单没有 trade_id, 无法刷新状态');
        return false;
    }
    const syncResult = await syncOrderFromRemote(tradeId, currentPaymentOrderId, db, utils);
    if (syncResult) {
        // 更新界面上的基础字段和扩展字段
        document.getElementById('state').value = syncResult.status;
        document.getElementById('pay-time').value = syncResult.payTime || '';
        document.getElementById('pay_method').value = syncResult.payMethod || '';
        document.getElementById('sub_pay_method').value = syncResult.subPayMethod || '';
        document.getElementById('settlement_amount').value = syncResult.settlementAmount || '';
        document.getElementById('settlement_currency').value = syncResult.settlementCurrency || '';
        document.getElementById('merchant_cost').value = syncResult.merchantCost || '';
        if (!silent) utils.showAlert(t('status_updated') || '状态已刷新');
        return true;
    } else {
        if (!silent) utils.showAlert(t('refresh_failed') || '刷新失败，请稍后重试');
        return false;
    }
}

async function loadAndPrepareEdit(container, db, t, utils) {
    try {
        // 查询本地订单
        const order = db.prepare(`
            SELECT id, order_id, trade_id, amount, currency, description, qrcode_url, status, pay_time, source, created_at
            FROM payment_orders WHERE id = ?
        `).get(currentPaymentOrderId);
        if (!order) {
            utils.showAlert('订单不存在');
            window.loadView('yabandpay-overview');
            return;
        }
        
        // 填充基础字段
        document.getElementById('order-id').value = order.order_id || '';
        document.getElementById('trade-id').value = order.trade_id || '';
        document.getElementById('amount').value = order.amount ? parseFloat(order.amount).toFixed(2) : '';
        document.getElementById('currency').value = order.currency || 'EUR';
        document.getElementById('description').value = order.description || '';
        document.getElementById('create_date').value = order.created_at ? order.created_at : '';
        document.getElementById('source').value = order.source === 'local' ? t('source_local') || '本地' : t('source_remote') || '远程';
        // 临时显示本地状态和支付时间（等待远程刷新覆盖）
        document.getElementById('state').value = order.status || '';
        document.getElementById('pay-time').value = order.pay_time ? utils.formatTimestamp(order.pay_time) : '';
        // 扩展字段清空
        document.getElementById('pay_method').value = '';
        document.getElementById('sub_pay_method').value = '';
        document.getElementById('settlement_amount').value = '';
        document.getElementById('settlement_currency').value = '';
        document.getElementById('merchant_cost').value = '';

        // 静默刷新远程数据（如果有 trade_id）
        if (order.trade_id) {
            await refreshOrder(container, db, t, utils, true);
        }

        // 查询本地关联销售单
        const linkedIssues = db.prepare(`
            SELECT gi.id, gi.issue_number, gi.invoice_number
            FROM payment_order_issues pl
            JOIN goods_issues gi ON pl.issue_id = gi.id
            WHERE pl.payment_order_id = ?
        `).all(currentPaymentOrderId);
        hasLocalLink = linkedIssues.length > 0;

        const selectEl = document.getElementById('issue-select');
        if (hasLocalLink) {
            selectEl.innerHTML = '';
            for (const issue of linkedIssues) {
                const option = document.createElement('option');
                option.value = issue.id;
                option.textContent = `${issue.issue_number} (${issue.invoice_number})`;
                option.selected = true;
                selectEl.appendChild(option);
            }
            selectEl.disabled = true;
        } else {
            const availableIssues = db.prepare(`
                SELECT gi.id, gi.issue_number, gi.invoice_number,
                       (SELECT SUM(gi2.selling_net_price * gi2.quantity * (1 + gi2.tax_rate/100))
                        FROM goods_issue_items gi2
                        WHERE gi2.issue_id = gi.id) as total_gross
                FROM goods_issues gi
                WHERE gi.id NOT IN (SELECT issue_id FROM payment_order_issues)
                ORDER BY gi.date DESC
            `).all();
            selectEl.innerHTML = '';
            for (const issue of availableIssues) {
                const option = document.createElement('option');
                option.value = issue.id;
                option.textContent = `${issue.issue_number} (${issue.invoice_number}) - ${(issue.total_gross || 0).toFixed(2)} €`;
                selectEl.appendChild(option);
            }
            selectEl.disabled = false;
        }

        // 二维码按钮
        const showBtn = document.getElementById('show-qrcode-btn');
        if (showBtn) {
            showBtn.onclick = async () => {
                const modal = document.getElementById('qrcode-modal');
                const container = document.getElementById('modal-qrcode-container');
                const hint = document.getElementById('scan-to-pay-hint');
                container.innerHTML = '';
                // 获取二维码 URL（可以从创建支付时存储的字段获取，或根据 trade_id 重新生成）
                // 假设在 payment_links 表中存储了 qrcode_url，或者调用接口重新获取
                // 这里简单示例：如果 trans.qrcode_url 存在，则直接使用，否则提示暂无
                if (order.qrcode_url) {
                    const QRCode = require('qrcode');
                    const canvas = document.createElement('canvas');
                    await QRCode.toCanvas(canvas, order.qrcode_url, { width: 250 });
                    container.appendChild(canvas);
                    if (hint) hint.style.display = 'block';
                } else {
                    container.innerHTML = '<p>暂无二维码</p>';
                    if (hint) hint.style.display = 'none';
                }
                modal.style.display = 'flex';
            };
        }
    } catch (err) {
        utils.showAlert(t('load_failed') + ': ' + err.message);
        window.loadView('yabandpay-list');
    }
}

async function createAndSave(container, db, t, utils) {
    const selectedIds = Array.from(document.getElementById('issue-select').selectedOptions).map(opt => parseInt(opt.value));
    const amount = parseFloat(document.getElementById('amount').value);
    let description = document.getElementById('description').value.trim();
    const timeoutMinutes = parseInt(document.getElementById('timeout').value) || 60;
    if (!amount || amount <= 0) {
        utils.showAlert(t('select_issues_or_amount') || '请选择销售单');
        return;
    }
    if (!description) description = `Payment of €${amount.toFixed(2)}`;
    const orderId = document.getElementById('order-id').value;

    try {
        const { redirectUrl = '', notifyUrl = '' } = configs.yabandpaySetting;
        const result = await utils.yabandpayQRcodePayment(orderId, amount.toString(), 'EUR', description, 'offline', 'QRcode', redirectUrl, notifyUrl, timeoutMinutes.toString());
        const tradeId = result.data.trade_id;
        const qrcodeUrl = result.data.url;

        // 插入支付订单主记录
        const insertOrder = db.prepare(`
            INSERT INTO payment_orders (order_id, trade_id, amount, currency, description, qrcode_url, status, source, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', 'local', CURRENT_TIMESTAMP)
        `);
        insertOrder.run(orderId, tradeId, amount, 'EUR', description, qrcodeUrl);
        const newOrderId = db.prepare(`SELECT last_insert_rowid() as id`).get().id;

        // 插入关联关系
        const insertLink = db.prepare(`INSERT INTO payment_order_issues (payment_order_id, issue_id) VALUES (?, ?)`);
        for (const issueId of selectedIds) {
            insertLink.run(newOrderId, issueId);
        }

        utils.showAlert(t('payment_created') || '支付创建成功');
        window._currentPaymentOrderId = newOrderId;
        window.loadView('yabandpay-form');
    } catch (err) {
        utils.showAlert(t('create_failed') + ': ' + err.message);
    }
}

async function saveAssociationsOnly(container, db, t, utils) {
    const selectedIds = Array.from(document.getElementById('issue-select').selectedOptions).map(opt => parseInt(opt.value));
    if (selectedIds.length === 0) {
        utils.showAlert(t('select_at_least_one_issue') || '请至少选择一个销售单');
        return;
    }
    try {
        const insertStmt = db.prepare(`INSERT OR IGNORE INTO payment_order_issues (payment_order_id, issue_id) VALUES (?, ?)`);
        for (const issueId of selectedIds) {
            insertStmt.run(currentPaymentOrderId, issueId);
        }
        utils.showAlert(t('associations_saved') || '关联关系已保存');
        window._currentPaymentOrderId = currentPaymentOrderId;
        window.loadView('yabandpay-form');
    } catch (err) {
        utils.showAlert(t('save_failed') + ': ' + err.message);
    }
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