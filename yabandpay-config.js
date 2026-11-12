// yabandpay-config.js
const path = require('path');
const fs = require('fs');

const defaultConfig = { 
    user: '', 
    secretKey: '', 
    apiUrl: 'https://mapi.yabandpay.com/Payments',
    redirectUrl: 'about blank',
    notifyUrl: 'about blank'
};

/**
 * 获取配置
 * @param {string} configFilePath - 配置文件绝对路径
 * @returns {Object}
 */
function getYabandpayConfig(configFilePath) {
    if (!fs.existsSync(configFilePath)) {
        return defaultConfig;
    }
    try {
        const content = fs.readFileSync(configFilePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        return defaultConfig;
    }
}

/**
 * 保存配置
 * @param {Object} config - { user, secretKey, apiUrl }
 * @param {string} configFilePath - 配置文件绝对路径
 */
function setYabandpayConfig(config, configFilePath) {
    const dir = path.dirname(configFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2));
}

/**
 * 检查配置是否存在
 * @param {string} configFilePath
 */
function hasYabandpayConfig(configFilePath) {
    return fs.existsSync(configFilePath);
}

module.exports = { getYabandpayConfig, setYabandpayConfig, hasYabandpayConfig };