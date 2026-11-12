// 数据库模块：初始化表、提供CRUD操作
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const utils = require('./utils.js');

const dataDir = utils.getDataDir();
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'system.db');
const db = new Database(dbPath);

// 启用外键约束和WAL模式
db.pragma('foreign_keys = ON');

// 日志记录函数（写入logbook表）
function logChange(tableName, recordId, action, oldValues, newValues) {
    const stmt = db.prepare(`
        INSERT INTO logbook (table_name, record_id, action, old_values, new_values)
        VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(tableName, recordId, action, JSON.stringify(oldValues), JSON.stringify(newValues));
}

// 创建所有表
db.exec(`
    -- 公司信息表（仅一行）
    CREATE TABLE IF NOT EXISTS company_info (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT,
        street TEXT,
        postcode TEXT,
        city TEXT,
        ust_idnr TEXT,
        tax_number TEXT,
        bank_name TEXT,
        iban TEXT,
        bic TEXT
    );

    -- 客户表
    CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        street TEXT,
        postcode TEXT,
        city TEXT,
        country TEXT,
        ust_idnr TEXT,
        email TEXT,
        phone TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 入库单主表
    CREATE TABLE IF NOT EXISTS goods_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        supplier TEXT,
        supplier_invoice TEXT,
        remarks TEXT,
        attachment_path TEXT,   -- String or JSON array
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 入库单明细
    CREATE TABLE IF NOT EXISTS goods_receipt_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        net_unit_price REAL NOT NULL,
        tax_rate INTEGER DEFAULT 19,
        FOREIGN KEY(receipt_id) REFERENCES goods_receipts(id) ON DELETE CASCADE
    );

    -- 销售单主表
    CREATE TABLE IF NOT EXISTS goods_issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        customer_id INTEGER,
        customer_name TEXT,
        customer_address TEXT,
        customer_vat_id TEXT,
        invoice_number TEXT UNIQUE,
        is_export BOOLEAN DEFAULT 0,
        carrier TEXT,
        tracking_number TEXT,
        shipping_date TEXT,
        export_customs_number TEXT,
        export_customs_date TEXT,
        export_location TEXT,
        export_attachment_path TEXT,     -- String or JSON array
        payment_attachment_paths TEXT,   -- JSON array
        bank_reference TEXT,
        payment_received_date TEXT,
        status TEXT DEFAULT 'open',
        remarks TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

    -- 销售单明细 (关联库存批次)
    CREATE TABLE IF NOT EXISTS goods_issue_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL,
        receipt_item_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        selling_net_price REAL NOT NULL,
        tax_rate INTEGER DEFAULT 19,
        FOREIGN KEY(issue_id) REFERENCES goods_issues(id) ON DELETE CASCADE,
        FOREIGN KEY(receipt_item_id) REFERENCES goods_receipt_items(id)
    );

    -- 支付订单主表
    CREATE TABLE IF NOT EXISTS payment_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id TEXT UNIQUE NOT NULL,           -- 商户订单号（如 PO-20250525-xxx)
        trade_id TEXT,                           -- YabandPay 交易号（创建支付后获得）
        amount REAL NOT NULL,                    -- 订单金额（欧元）
        currency TEXT DEFAULT 'EUR',             -- 货币
        description TEXT,                        -- 订单描述
        qrcode_url TEXT,                         -- 二维码链接（仅创建时返回）
        status TEXT DEFAULT 'pending',           -- 本地状态: pending, paid, failed, refunded
        pay_time TEXT,                           -- 支付成功时间（从 YabandPay 查询后更新）
        source TEXT DEFAULT 'local',             -- 用于区分订单来源: local, remote
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 支付订单与出货单关联表
    CREATE TABLE IF NOT EXISTS payment_order_issues (
        payment_order_id INTEGER NOT NULL,
        issue_id INTEGER NOT NULL UNIQUE,       -- 唯一约束保证一个单只能关联一次
        PRIMARY KEY (payment_order_id, issue_id),
        FOREIGN KEY (payment_order_id) REFERENCES payment_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (issue_id) REFERENCES goods_issues(id) ON DELETE CASCADE
    );

    -- 发票表
    CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        issue_id INTEGER NOT NULL,
        pdf_path TEXT,
        net_total REAL,
        tax_total REAL,
        gross_total REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(issue_id) REFERENCES goods_issues(id)
    );

    -- 其他支出表
    CREATE TABLE IF NOT EXISTS other_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        category TEXT,
        description TEXT,
        net_amount REAL,
        tax_rate INTEGER DEFAULT 19,
        input_tax REAL,
        is_output_tax BOOLEAN DEFAULT 0,
        attachment_path TEXT,   -- String or JSON array
        supplier_invoice TEXT,
        remarks TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- 公司车表
    CREATE TABLE IF NOT EXISTS company_cars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_plate TEXT UNIQUE NOT NULL,
        gross_list_price REAL NOT NULL,
        acquisition_date TEXT,
        active BOOLEAN DEFAULT 1
    );

    -- 日志表
    CREATE TABLE IF NOT EXISTS logbook (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT,
        record_id INTEGER,
        action TEXT,
        old_values TEXT,
        new_values TEXT,
        user TEXT DEFAULT 'system',
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );
`);

// 创建库存视图
db.exec(`
    CREATE VIEW IF NOT EXISTS current_stock AS
    SELECT 
        ri.id AS receipt_item_id,
        ri.product_name,
        ri.net_unit_price AS purchase_price,
        ri.tax_rate,
        ri.quantity AS received_qty,
        COALESCE(SUM(gi.quantity), 0) AS issued_qty,
        (ri.quantity - COALESCE(SUM(gi.quantity), 0)) AS remaining_qty,
        gr.date AS receipt_date,
        gr.supplier,
        gr.supplier_invoice
    FROM goods_receipt_items ri
    JOIN goods_receipts gr ON ri.receipt_id = gr.id
    LEFT JOIN goods_issue_items gi ON ri.id = gi.receipt_item_id
    GROUP BY ri.id
    HAVING remaining_qty > 0
`);

module.exports = { db, logChange };