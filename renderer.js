// 主渲染进程：使用 require 加载所有依赖，避免全局冲突
const { ipcRenderer } = require('electron');

const versionArg = process.argv.find(arg => arg.startsWith('--app-version='));
const appVersion = versionArg ? versionArg.split('=')[1] : '';

const dataDirArg = process.argv.find(arg => arg.startsWith('--data-dir='));
const dataDir = dataDirArg ? dataDirArg.split('=')[1] : '';
window.__dataDir = dataDir;

const { db, logChange } = require('./database.js');
const { t, setLanguage, getCurrentLang, updatePageTexts } = require('./i18n.js');
const utils = require('./utils.js');

// 将工具函数挂载到全局，供视图模块使用
window.utils = utils;
window.db = db;
window.logChange = logChange;
window.t = t;
window.getCurrentLang = getCurrentLang;
window.generateInvoicePdf = generateInvoicePdf;

// 加载全局配置
utils.loadConfigs();
// 动态加载视图模块
const views = {
    'goods-receipt': require('./views/receipt-list.js'),
    'receipt-form': require('./views/receipt-form.js'),
    'goods-issue': require('./views/issue-list.js'),
    'issue-form': require('./views/issue-form.js'),
    'yabandpay-overview': require('./views/yabandpay-list.js'),
    'yabandpay-remote-sync': require('./views/yabandpay-remote-sync.js'),
    'yabandpay-form': require('./views/yabandpay-form.js'),
    'stock': require('./views/stock.js'),
    'expenses': require('./views/expenses.js'),
    'company-cars': require('./views/cars.js'),
    'customers': require('./views/customers.js'),
    'company-info': require('./views/company.js'),
    'tax-report': require('./views/tax.js'),
    'audit': require('./views/audit.js')
};

// 初始化视图渲染函数
for (const key in views) {
    if (views[key] && views[key].render) {
        window[`render${key.replace(/-/g, '')}View`] = views[key].render;
    }
}

// DOM 元素
const viewContainer = document.getElementById('view-container');
const versionSpan = document.getElementById('app-version');
const navItems = document.querySelectorAll('.nav-item');
const langZhBtn = document.getElementById('lang-zh');
const langDeBtn = document.getElementById('lang-de');

let currentView = 'goods-receipt';

async function loadView(viewName, keepEditId = false) {
    const previousView = currentView;

    // 高亮处理：表单视图时高亮进货入库菜单
    let menuName = viewName;
    if (viewName === 'receipt-form') {
        menuName = 'goods-receipt';
    }
    if (viewName === 'issue-form') {
        menuName = 'goods-issue';
    }
    if (viewName === 'yabandpay-form' || viewName === 'yabandpay-remote-sync') {
        menuName = 'yabandpay-overview';
    }
    navItems.forEach(item => {
        const itemView = item.getAttribute('data-view');
        if (itemView === menuName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 只有当视图真正发生变化且 not keepEditId 时，才清除旧的全局变量
    if (previousView && previousView !== viewName && !keepEditId) {
        if (previousView === 'receipt-form') delete window._currentReceiptId;
        if (previousView === 'issue-form') delete window._currentIssueId;
        if (previousView === 'yabandpay-form') delete window._currentPaymentOrderId;
    }

    currentView = viewName;
    const renderFn = window[`render${viewName.replace(/-/g, '')}View`];
    if (renderFn) {
        // 处理参数：对于表单视图，可能需要额外的参数（如编辑ID）
        let params = { db, logChange, t, utils };
        if (viewName === 'receipt-form') params.editId = window._currentReceiptId;
        else if (viewName === 'issue-form') params.editId = window._currentIssueId;
        else if (viewName === 'yabandpay-form') params.editId = window._currentPaymentOrderId;
        await renderFn(viewContainer, params);
    } else {
        viewContainer.innerHTML = '<div class="card">视图加载失败</div>';
    }
}

function setLanguageAndRefresh(lang) {
    setLanguage(lang);
    updatePageTexts();
    loadView(currentView, true);
    if (lang === 'zh') {
        langZhBtn.classList.add('active');
        langDeBtn.classList.remove('active');
    } else {
        langZhBtn.classList.remove('active');
        langDeBtn.classList.add('active');
    }
}

async function generateInvoicePdf(html, saveDir, fileName) {
    return await ipcRenderer.invoke('generate-invoice-pdf', html, saveDir, fileName);
};

versionSpan.innerText = appVersion;
navItems.forEach(item => {
    utils.renderNavItems(item);
    item.addEventListener('click', () => loadView(item.getAttribute('data-view')));
});
langZhBtn.addEventListener('click', () => setLanguageAndRefresh('zh'));
langDeBtn.addEventListener('click', () => setLanguageAndRefresh('de'));

// 初始化界面文本
updatePageTexts();
loadView('goods-receipt');
