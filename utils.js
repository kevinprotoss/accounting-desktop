// 通用工具函数：金额计算、文件路径处理、日期格式化等
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 获取数据目录（exe 同级下的 data）
function getDataDir() {
    const dataDir = path.join(window.__dataDir, 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
}

// 获取附件子目录
function getAttachmentsDir(subFolder) {
    const dir = path.join(getDataDir(), 'attachments', subFolder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

/**
 * 保存配置
 * @param {Object} config
 * @param {string} configFilePath - 配置文件绝对路径
 */
function setConfig(config, configFilePath) {
    const dir = path.dirname(configFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
}

/**
 * 检查配置是否存在
 * @param {string} configFilePath
 */
function getConfig(configFilePath) {
    if (!fs.existsSync(configFilePath)) {
        return;
    }
    try {
        const content = fs.readFileSync(configFilePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        return;
    }
}

// 加载所有配置到内存
function loadConfigs() {
    if (typeof window !== 'undefined') {
        window.configs = {
            companyInfo: getConfig(path.join(getDataDir(), 'company-info.json')) || {},
            yabandpaySetting: getConfig(path.join(getDataDir(), 'yabandpay-setting.json')) || {}
        };
    }
}

function saveConfigs() {
    if (typeof window !== 'undefined') {
        const { companyInfo, yabandpaySetting } = window.configs;
        if (typeof companyInfo !== 'undefined') {
            setConfig(companyInfo, path.join(getDataDir(), 'company-info.json'));
        }
        if (typeof yabandpaySetting !== 'undefined') {
            setConfig(yabandpaySetting, path.join(getDataDir(), 'yabandpay-setting.json'));
        }
    }
}

/**
 * 计算净价对应的含税总价
 * @param {number} netPrice - 净价（不含税）
 * @param {number} taxRate - 税率（如 19）
 * @returns {number} 含税总价
 */
function calcGrossFromNet(netPrice, taxRate) {
    return netPrice * (1 + taxRate / 100);
}

/**
 * 计算含税总价对应的净价
 * @param {number} grossPrice - 含税总价
 * @param {number} taxRate - 税率（如 19）
 * @returns {number} 净价
 */
function calcNetFromGross(grossPrice, taxRate) {
    return grossPrice / (1 + taxRate / 100);
}

/**
 * 计算税额
 * @param {number} netPrice - 净价
 * @param {number} taxRate - 税率
 * @returns {number} 税额
 */
function calcTax(netPrice, taxRate) {
    return netPrice * taxRate / 100;
}

/**
 * 根据净价和税率，返回 { net, tax, gross }
 * @param {number} netPrice 
 * @param {number} taxRate 
 * @returns {Object}
 */
function getAmountsFromNet(netPrice, taxRate) {
    const net = netPrice;
    const tax = calcTax(net, taxRate);
    const gross = net + tax;
    return { net, tax, gross };
}

/**
 * 根据含税总价和税率，返回 { net, tax, gross }
 * @param {number} grossPrice 
 * @param {number} taxRate 
 * @returns {Object}
 */
function getAmountsFromGross(grossPrice, taxRate) {
    const gross = grossPrice;
    const net = calcNetFromGross(gross, taxRate);
    const tax = gross - net;
    return { net, tax, gross };
}

/**
 * 生成简单的唯一ID（用于临时前端列表）
 * @returns {string}
 */
function generateTempId() {
    return Date.now() + '-' + Math.random().toString(36).substr(2, 6);
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param {Date|string} dateInput 
 * @returns {string}
 */
function formatDate(dateInput) {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateToDE(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}.${month}.${year}`;
}

/**
 * 将 Unix 时间戳（秒）转换为本地日期时间字符串
 * @param {number|string} timestamp - 秒级时间戳，例如 1708422208
 * @returns {string} 格式化后的日期时间字符串，例如 "2024-02-20 15:23:28"
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const ts = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    if (isNaN(ts)) return '';
    const date = new Date(ts * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 获取当前日期字符串 YYYY-MM-DD
 * @returns {string}
 */
function todayStr() {
    return formatDate(new Date());
}

/**
 * 从文件路径提取文件名
 * @param {string} filePath 
 * @returns {string}
 */
function getFileName(filePath) {
    return path.basename(filePath);
}

/**
 * 复制文件到目标目录，如果目标不存在则创建目录
 * @param {string} sourcePath - 源文件路径
 * @param {string} targetDir - 目标目录
 * @param {string} newFileName - 新文件名（可选）
 * @returns {Promise<string>} 返回目标文件的绝对路径
 */
async function copyFileToDir(sourcePath, subFolder, newFileName) {
    const targetDir = getAttachmentsDir(subFolder);        // 绝对路径
    const fileName = newFileName || path.basename(sourcePath);
    const targetPath = path.join(targetDir, fileName);
    await fs.promises.copyFile(sourcePath, targetPath);
    // 返回相对于 data 目录的路径（例如 attachments/receipts/xxx.jpg）
    const relativePath = path.relative(getDataDir(), targetPath);
    return relativePath;
}

/**
 * 安全地打开文件（使用系统默认程序）
 * @param {string} filePath 
 */
function openFile(filePathOrRelative) {
    // 如果是相对路径，则补全为绝对路径
    let absolutePath = filePathOrRelative;
    if (filePathOrRelative && !path.isAbsolute(filePathOrRelative)) {
        absolutePath = path.join(getDataDir(), filePathOrRelative);
    }
    if (!fs.existsSync(absolutePath)) {
        console.error('File not found:', absolutePath);
        return;
    }
    const { shell } = require('electron');
    shell.openPath(absolutePath);
}

/**
 * 将附件数据（可能是数组或字符串）标准化为数组，用于兼容旧数据
 * @param {string|string[]} raw - 数据库读出的原始值
 * @returns {string[]}
 */
function normalizeAttachments(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            return [raw];
        } catch (e) {
            return [raw];
        }
    }
    return [];
}

/**
 * 将附件数组序列化为数据库存储格式（JSON 字符串）
 * @param {string[]} attachments - 附件路径数组
 * @returns {string}
 */
function serializeAttachments(attachments) {
    if (!attachments || !attachments.length) return '';
    return JSON.stringify(attachments);
}

/**
 * 根据季度数字返回季度字符串（Q1, Q2, Q3, Q4）
 * @param {number} quarter 
 * @returns {string}
 */
function quarterToString(quarter) {
    return `Q${quarter}`;
}

/**
 * 根据日期计算季度（1-4）
 * @param {string} dateStr YYYY-MM-DD
 * @returns {number}
 */
function getQuarterFromDate(dateStr) {
    const month = new Date(dateStr).getMonth() + 1;
    return Math.ceil(month / 3);
}

/**
 * 将数字四舍五入到指定小数位数（默认4位）
 * @param {number} num - 原始数字
 * @param {number} decimals - 小数位数，默认4
 * @returns {number}
 */
function roundTo(num, decimals = 4) {
    if (isNaN(num)) return 0;
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
}

/**
 * 通过创建隐藏的文件 input 来选择文件
 * @param {boolean} multi 是否多选
 * @returns {Promise<string|string[]>} 文件路径或路径数组
 */
function selectFileViaInput(multi = false) {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        if (multi) input.multiple = true;
        input.onchange = (e) => {
            const files = Array.from(input.files);
            if (files.length === 0) {
                resolve(multi ? [] : null);
                return;
            }
            const paths = files.map(f => f.path); // 注意：需要 nodeIntegration 才能获取 path
            if (multi) resolve(paths);
            else resolve(paths[0]);
            input.remove();
        };
        input.click();
    });
}

/**
 * 上传多个文件并返回保存后的路径数组
 * @param {string} subFolder - 附件子目录（如 'receipts', 'payments'）
 * @param {string} filePrefix - 文件名前缀（如单据编号）
 * @returns {Promise<string[]>} 保存后的绝对路径数组
 */
async function uploadMultipleFiles(subFolder, filePrefix) {
    const filePaths = await selectFileViaInput(true);  // 多选
    if (!filePaths || !filePaths.length) return [];
    const savedPaths = [];
    for (const filePath of filePaths) {
        const newFileName = `${filePrefix}_${basename(filePath)}`;
        const savedPath = await copyFileToDir(filePath, subFolder, newFileName);
        savedPaths.push(savedPath);
    }
    return savedPaths;
}

/**
 * 显示附件链接列表（用于界面展示）
 * @param {HTMLElement} container - 用于显示链接的 DOM 元素（如 span）
 * @param {string[]} filePaths - 文件路径数组
 */
function displayAttachmentLinks(container, filePaths,) {
    container.innerHTML = '';
    if (!filePaths || !filePaths.length) return;
    filePaths.forEach((p, index) => {
        const div = document.createElement('div');
        div.style.marginBottom = '4px';
        // 文件名链接
        const link = document.createElement('a');
        link.href = '#';
        link.innerText = basename(p);
        link.style.cursor = 'pointer';
        link.style.textDecoration = 'underline';
        link.onclick = (e) => {
            e.preventDefault();
            openFile(p);
        };
        div.appendChild(link);
        // 删除按钮
        const delBtn = document.createElement('button');
        delBtn.innerText = '✗';
        delBtn.style.marginLeft = '8px';
        delBtn.style.cursor = 'pointer';
        delBtn.style.border = 'none';
        delBtn.style.background = 'transparent';
        delBtn.style.color = 'red';
        delBtn.onclick = async () => {
            // 从数组中移除该路径
            filePaths.splice(index, 1);
            div.remove();
            // 注意：这里只移除记录，不删除磁盘文件。若需要物理删除文件，可调用 fs.unlink 但需谨慎。
        };
        div.appendChild(delBtn);
        container.appendChild(div);
    });
}

/**
 * 显示非阻塞消息对话框（替代 alert）
 * @param {string} message 消息内容
 * @param {string} type 类型: 'info', 'error', 'warning' (可选，默认 info)
 */
function showAlert(message, type = 'info') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-dialog');
        const msgElem = document.getElementById('dialog-message');
        const okBtn = document.getElementById('dialog-ok');
        const yesBtn = document.getElementById('dialog-yes');
        const noBtn = document.getElementById('dialog-no');

        // 隐藏所有按钮，只显示 OK
        okBtn.style.display = 'inline-block';
        yesBtn.style.display = 'none';
        noBtn.style.display = 'none';

        msgElem.innerText = message;
        dialog.style.display = 'flex';

        const onOk = () => {
            dialog.style.display = 'none';
            okBtn.removeEventListener('click', onOk);
            resolve();
        };
        okBtn.addEventListener('click', onOk);
    });
}

/**
 * 显示非阻塞确认对话框（替代 confirm）
 * @param {string} message 确认消息
 * @returns {Promise<boolean>} true 表示用户点击“是”，false 表示“否”
 */
function showConfirm(message) {
    return new Promise((resolve) => {
        const dialog = document.getElementById('custom-dialog');
        const msgElem = document.getElementById('dialog-message');
        const okBtn = document.getElementById('dialog-ok');
        const yesBtn = document.getElementById('dialog-yes');
        const noBtn = document.getElementById('dialog-no');

        // 隐藏 OK，显示 Yes/No
        okBtn.style.display = 'none';
        yesBtn.style.display = 'inline-block';
        noBtn.style.display = 'inline-block';

        msgElem.innerText = message;
        dialog.style.display = 'flex';

        const onYes = () => {
            dialog.style.display = 'none';
            cleanup();
            resolve(true);
        };
        const onNo = () => {
            dialog.style.display = 'none';
            cleanup();
            resolve(false);
        };
        function cleanup() {
            yesBtn.removeEventListener('click', onYes);
            noBtn.removeEventListener('click', onNo);
        }
        yesBtn.addEventListener('click', onYes);
        noBtn.addEventListener('click', onNo);
    });
}

/**
 * 获取文件名（兼容跨平台路径）
 * @param {string} filePath 完整路径
 * @returns {string}
 */
function basename(filePath) {
    return filePath.split(/[\\/]/).pop();
}

function isYabandpayConfigured() {
    const setting = window.configs?.yabandpaySetting;
    return setting && setting.user && setting.secretKey;
}

/**
 * 生成指定长度的随机字符串（字母+数字）
 * @param {number} length - 长度，默认16
 * @returns {string}
 */
function generateNonce(length = 16) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function signYabandpayParams(params, secretKey) {
    const sortedKeys = Object.keys(params).sort();
    const str = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    return crypto.createHmac('sha256', secretKey).update(str).digest('hex');
}

/**
 * 发起 YabandPay API 请求
 * @param {Object} params - 业务参数（不含 user, sign 等）
 * @param {string} method - 请求方法，默认 POST
 * @returns {Promise<Object>} 返回 API 响应 JSON
 */
async function yabandpayRequest(params) {
    const yabandpaySetting = window.configs?.yabandpaySetting || {};
    const requestParams = {
        ...params,
        time: Date.now(),
        user: yabandpaySetting.user,
    };
    const sign = signYabandpayParams(requestParams, yabandpaySetting.secretKey);
    const { user, method, time, ...data } = requestParams;
    const response = await fetch(yabandpaySetting.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user,
            sign,
            method,
            time,
            data,
        })
    });
    const result = await response.json();
    if (result.code !== '200') {
        throw new Error(`YabandPay API error: ${result.message} (code ${result.code})`);
    }
    return result;
}

/**
 * 批量查询交易
 * @param {string} start_time - YYYY-MM-DD
 * @param {string} end_time - YYYY-MM-DD
 */
async function yabandpayBatchQuery(start_time, end_time) {
    const params = {
        end_time,
        method: 'v3.BatchQuery',
        start_time,
    };
    return yabandpayRequest(params);
}

/**
 * 获取交易明细 (YabandPay finance transactions)
 * @param {number} start_time - 开始时间戳（秒）
 * @param {number} end_time - 结束时间戳（秒）
 * @returns {Promise<Object>} 返回 API 响应，其中 data.tradebill 为交易明细数组
 */
async function yabandpayGetTradebill(start_time, end_time) {
    const params = {
        method: 'v3.GetTradebill',
        command: 'getTradebillInfo',
        start_time,
        end_time,
        nonce_string: generateNonce(),
    };
    return yabandpayRequest(params);
}

/**
 * 订单查询
 * @param {string} trade_id
 */
async function yabandpayQueryOrder(trade_id) {
    const params = {
        method: 'v3.QueryOrder',
        trade_id,
    };
    return yabandpayRequest(params);
}

/**
 * 二维码支付
 * @param {string} order_id
 * @param {string} amount
 * @param {string} currency
 * @param {string} description
 * @param {string} pay_method
 * @param {string} sub_pay_method
 * @param {string} redirect_url
 * @param {string} notify_url
 * @param {string} timeout
 */
async function yabandpayQRcodePayment(order_id, amount, currency, description, pay_method, sub_pay_method, redirect_url, notify_url, timeout) {
    const params = {
        method: 'v3.QRcodePayment',
        order_id,
        amount,
        currency,
        description,
        pay_method,
        sub_pay_method,
        redirect_url,
        notify_url,
        timeout,
    };
    return yabandpayRequest(params);
}

/**
 * 获取账户余额
 * @param {string} currency - 货币，默认 EUR
 * @returns {Promise<Object>} 包含 available, deposit, usable 等字段
 */
async function yabandpayGetBalance(currency = 'EUR') {
    const params = {
        method: 'v3.MerchantBalance',
        command: 'getBalance',
        currency,
        nonce_string: generateNonce(),
    };
    return yabandpayRequest(params);
}

/**
 * 提现申请
 * @param {number} amount - 提现金额
 * @param {string} reference - 备注（可选）
 * @param {string} currency - 货币，默认 EUR
 * @returns {Promise<Object>}
 */
async function yabandpayWithdraw(amount, notify_url, reference = '', currency = 'EUR') {
    const params = {
        method: 'v3.MerchantBalance',
        command: 'payout',
        amount: amount.toString(),
        currency,
        reference,
        notify_url,
        nonce_string: generateNonce(),
    };
    return yabandpayRequest(params);
}

/**
 * 解析 YabandPay batchquery 返回的 CSV 字符串
 * CSV 格式：第一行是标题，后续每行是数据，中间可能夹杂空行（只有逗号的行）
 * @param {string} csvString
 * @returns {Array<Object>} 解析后的交易对象数组，每个对象包含 trade_id, amount, state 等
 */
function parseYabandpayBatchCSV(csvString) {
    const lines = csvString.split(/\r?\n/);
    if (lines.length < 2) return [];

    // 第一行是标题，按逗号分割并去除首尾空格和引号
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const dataRows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // 跳过空行
        // 处理可能包含逗号的字段（但 CSV 中字段基本没有逗号，简单分割即可）
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (values.length < headers.length) continue; // 不完整行跳过
        const obj = {};
        headers.forEach((header, idx) => {
            obj[header] = values[idx] || '';
        });
        dataRows.push(obj);
    }
    return dataRows;
}

/**
 * Mock 数据：模拟 batchquery 返回的 CSV 示例（从你提供的示例中截取）
 */
function mockYabandpayBatchQuery() {
    const mockCSV = `"","Trade Id","Merchant","Store","Cashier Email","Cashier","Payment Method","Method","Order Id","Total Amount","Currency","Settlement Amount","Settlement Currency","Exchange Rate","State","Pay Time","Transaction Id","Fund Flow Status"
"1","83c6c0d6-090d-99ec-32bd-01f2f3b0614e","Yaband Telecom B.V.","YabandPay","info@yabandmedia.com","YabandPay Test","online","Alipay","MASTER20260519095512013107","1","CNY","0.12","EUR","7.9608","paid","19-05-2026 09:57:10","2026051922001446221429513115",""
"2","d4134305-e28b-d9eb-a102-a76611c8be80","Yaband Telecom B.V.","YabandPay","info@yabandmedia.com","YabandPay Test","online","Alipay","MASTER20260519102150013135","1","CNY","0.12","EUR","7.9608","paid","19-05-2026 10:22:12","2026051922001446221423349102",""
"3","4cc48890-1a75-07c7-3575-6b1a0df7f414","Yaband Telecom B.V.","YabandPay","info@yabandmedia.com","YabandPay Test","online","WeChat Pay","2cc4abc6-3ad7-48d3-bffc-13148a81b0d8","0.01","EUR","0.01","EUR","1","paid","22-05-2026 02:42:32","4200003083202605226241767383",""
"4","19558b37-6dc7-30b9-2918-e9716fcee081","Yaband Telecom B.V.","YabandPay","info@yabandmedia.com","YabandPay Test","online","Credit Card","260522084737","0.1","EUR","0.1","EUR","1","paid","22-05-2026 14:52:49","XZZ68132e0b38e3eDA7VMG4IJO7HJBW5",""
"5","01f573e2-610c-b6b4-f763-73d35a1e9575","Yaband Telecom B.V.","YabandPay","info@yabandmedia.com","YabandPay Test","online","UnionPay Wap","260522085438","0.1","EUR","0.1","EUR","1","paid","22-05-2026 14:55:19","762605221455169477698",""
"6","e35601d5-0003-f3b9-b234-bbf934d7ea8e","Yaband Telecom B.V.","YabandPay","info@yabandmedia.com","YabandPay Test","online","UnionPay Wap","260522092212","0.1","EUR","0.1","EUR","1","paid","22-05-2026 15:22:56","272605221522538724918",""
"7","1a418adb-a5df-add0-9dea-9688972764bc","Yaband Telecom B.V.","YabandPay","info@yabandmedia.com","YabandPay Test","online","UnionPay Wap","260522092640","0.1","EUR","0.1","EUR","1","paid","22-05-2026 15:31:26","512605221531240072658",""
"8","72a2143e-2bd6-a00f-915a-638d0e346876","Yaband Telecom B.V.","YabandPay","info@yabandmedia.com","YabandPay Test","online","UnionPay Wap","260522094612","0.1","EUR","0.1","EUR","1","paid","22-05-2026 15:46:44","642605221546418445358",""`;
    return parseYabandpayBatchCSV(mockCSV);
}

function applyConditionFn(fnName) {
    if (typeof utils[fnName] === 'function') {
        return utils[fnName]();
    }
    return false;
}

function renderNavItems(item) {
    const showIfCondition = item.getAttribute('data-show-if');
    if (showIfCondition) item.style.display = applyConditionFn(showIfCondition) ? '' : 'none';
}

// 挂载到全局（供渲染进程使用）
if (typeof window !== 'undefined') {
    window.utils = {
        getDataDir,
        getAttachmentsDir,
        saveConfigs,
        loadConfigs,
        calcGrossFromNet,
        calcNetFromGross,
        calcTax,
        getAmountsFromNet,
        getAmountsFromGross,
        generateTempId,
        formatDate,
        formatDateToDE,
        formatTimestamp,
        todayStr,
        getFileName,
        copyFileToDir,
        openFile,
        normalizeAttachments,
        serializeAttachments,
        quarterToString,
        getQuarterFromDate, 
        roundTo,
        selectFile: selectFileViaInput,
        uploadMultipleFiles,
        displayAttachmentLinks,
        showAlert,
        showConfirm,
        basename,
        signYabandpayParams,
        yabandpayRequest,
        yabandpayBatchQuery,
        yabandpayGetTradebill,
        yabandpayQueryOrder,
        yabandpayQRcodePayment,
        yabandpayGetBalance,
        yabandpayWithdraw,
        parseYabandpayBatchCSV,
        mockYabandpayBatchQuery,
        renderNavItems,
    };
}

module.exports = {
    getDataDir,
    getAttachmentsDir,
    saveConfigs,
    loadConfigs,
    calcGrossFromNet,
    calcNetFromGross,
    calcTax,
    getAmountsFromNet,
    getAmountsFromGross,
    generateTempId,
    formatDate,
    formatDateToDE,
    formatTimestamp,
    todayStr,
    getFileName,
    copyFileToDir,
    openFile,
    normalizeAttachments,
    serializeAttachments,
    quarterToString,
    getQuarterFromDate, 
    roundTo,
    selectFile: selectFileViaInput,
    uploadMultipleFiles,
    displayAttachmentLinks,
    showAlert,
    showConfirm,
    basename,
    isYabandpayConfigured,
    signYabandpayParams,
    yabandpayRequest,
    yabandpayBatchQuery,
    yabandpayGetTradebill,
    yabandpayQueryOrder,
    yabandpayQRcodePayment,
    yabandpayGetBalance,
    yabandpayWithdraw,
    parseYabandpayBatchCSV,
    mockYabandpayBatchQuery,
    renderNavItems,
};
