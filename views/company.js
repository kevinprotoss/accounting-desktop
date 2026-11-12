// 公司信息模块（个体户自身信息）
window.addEventListener('configs-changed', () => document.querySelectorAll('.nav-item').forEach(window.utils.renderNavItems));

async function render(container, { db, logChange, t, utils }) {
    // 加载 YabandPay 配置
    const { companyInfo={}, yabandpaySetting={} } = configs;
    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span>🏢 ${t('menu_company')}</span>
            </div>
            <div class="form-group"><label>${t('company_name')}</label><input type="text" id="comp-name" value="${escapeHtml(companyInfo.name || '')}"></div>
            <div class="form-group"><label>${t('company_street')}</label><input type="text" id="comp-street" value="${escapeHtml(companyInfo.street || '')}"></div>
            <div class="form-group"><label>${t('company_postcode')}</label><input type="text" id="comp-postcode" value="${escapeHtml(companyInfo.postcode || '')}"></div>
            <div class="form-group"><label>${t('company_city')}</label><input type="text" id="comp-city" value="${escapeHtml(companyInfo.city || '')}"></div>
            <div class="form-group"><label>${t('company_ust_id')}</label><input type="text" id="comp-ustid" value="${escapeHtml(companyInfo.ustIdNumber || '')}"></div>
            <div class="form-group"><label>${t('company_tax_number')}</label><input type="text" id="comp-taxnum" value="${escapeHtml(companyInfo.taxNumber || '')}"></div>
            <div class="form-group"><label>${t('company_eori_number')}</label><input type="text" id="comp-eorinum" value="${escapeHtml(companyInfo.eoriNumber || '')}"></div>
            <div class="form-group"><label>${t('company_bank')}</label><input type="text" id="comp-bank" value="${escapeHtml(companyInfo.bank || '')}"></div>
            <div class="form-group"><label>${t('company_iban')}</label><input type="text" id="comp-iban" value="${escapeHtml(companyInfo.iban || '')}"></div>
            <div class="form-group"><label>${t('company_bic')}</label><input type="text" id="comp-bic" value="${escapeHtml(companyInfo.bic || '')}"></div>
            <hr style="margin: 20px 0;">
            <h3 style="margin-bottom: 20px;">${t('yabandpay_config')}</h3>
            <div class="form-group"><label>${t('yabandpay_user')}</label><input type="text" id="yabandpay-user" value="${escapeHtml(yabandpaySetting.user)}"></div>
            <div class="form-group"><label>${t('yabandpay_secret')}</label><input type="password" id="yabandpay-secret" value="${escapeHtml(yabandpaySetting.secretKey)}"></div>
            <div class="form-group"><label>${t('yabandpay_api_url')}</label><input type="text" id="yabandpay-url" value="${escapeHtml(yabandpaySetting.apiUrl)}"></div>
            <div class="form-group"><label>${t('yabandpay_redirect_url')}</label><input type="text" id="yabandpay-redirect-url" value="${escapeHtml(yabandpaySetting.redirectUrl)}"></div>
            <div class="form-group"><label>${t('yabandpay_notify_url')}</label><input type="text" id="yabandpay-notify-url" value="${escapeHtml(yabandpaySetting.notifyUrl)}"></div>
            <div class="form-group"><button id="save-company" class="btn">${t('save')}</button></div>
        </div>
    `;
    document.getElementById('save-company').onclick = () => {
        // 保存公司信息
        companyInfo.name = document.getElementById('comp-name').value;
        companyInfo.street = document.getElementById('comp-street').value;
        companyInfo.postcode = document.getElementById('comp-postcode').value;
        companyInfo.city = document.getElementById('comp-city').value;
        companyInfo.ustIdNumber = document.getElementById('comp-ustid').value;
        companyInfo.taxNumber = document.getElementById('comp-taxnum').value;
        companyInfo.eoriNumber = document.getElementById('comp-eorinum').value;
        companyInfo.bank = document.getElementById('comp-bank').value;
        companyInfo.iban = document.getElementById('comp-iban').value;
        companyInfo.bic = document.getElementById('comp-bic').value;

        // 保存 YabandPay 配置
        yabandpaySetting.user = document.getElementById('yabandpay-user').value.trim();
        yabandpaySetting.secretKey = document.getElementById('yabandpay-secret').value.trim();
        yabandpaySetting.apiUrl = document.getElementById('yabandpay-url').value.trim() || 'https://mapi.yabandpay.com/Payments';
        yabandpaySetting.redirectUrl = document.getElementById('yabandpay-redirect-url').value.trim() || 'about blank';
        yabandpaySetting.notifyUrl = document.getElementById('yabandpay-notify-url').value.trim() || 'about blank';

        logChange('company_info', 1, 'UPDATE', {}, {name});
        utils.saveConfigs();
        utils.showAlert(t('save_success'));
        
        window.dispatchEvent(new CustomEvent('configs-changed'));
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
