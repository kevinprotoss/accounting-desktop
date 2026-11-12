# AccountingSystem

面向个体户（sole proprietor）的本地会计系统，基于 Electron + better-sqlite3 构建。所有业务数据存储在本地 `data/` 目录，不依赖云端服务。

## 项目用途

用于管理进货、销售、库存、支出、公司车辆、客户、税务报表等日常会计事务，并生成发票 PDF。界面支持中德双语。适合单机使用，也支持将数据目录放在共享位置供多台电脑访问（通过 `instance.lock` 防止并发写入）。

## 核心功能

- **进货入库**：录入供应商进货单，维护商品与成本
- **销售出库**：录入销售单，生成发票，导出 PDF
- **库存查询**：按商品查看当前库存与流转
- **YabandPay 集成**：拉取/同步 YabandPay 交易记录，与销售单关联
- **其他支出**：记录非进货类支出
- **公司车辆**：管理公司车辆相关费用
- **客户管理**：维护客户信息，含 VAT ID、联系方式
- **公司信息**：公司名称、地址、税号、IBAN/BIC、YabandPay API 配置
- **税务报表**：按期间汇总净额、增值税、总额
- **审计追溯**：查看关键操作的变更记录

## 技术架构

### 进程模型

- **主进程（`main.js`）**
  - 解析应用根目录 `appRoot`：Windows 便携版读 `PORTABLE_EXECUTABLE_DIR`，macOS 从 `.app/Contents/MacOS/` 回溯到 `.app` 所在目录，Linux 取可执行文件所在目录
  - 数据目录固定为 `appRoot/data`
  - 通过 `data/instance.lock` 实现单实例锁：独占创建锁文件，写入 `hostname_timestamp`；若锁文件存在且超过 5 分钟，弹窗询问是否强制接管；未超时则提示已有实例在运行
  - 创建 1400×900 主窗口，加载 `index.html`
  - 通过 IPC 暴露两个能力：
    - `save-file-dialog`：调用系统“另存为”对话框
    - `generate-invoice-pdf`：在隐藏窗口中加载 HTML，调用 `printToPDF` 生成 A4 PDF 并写入指定目录
  - 窗口配置为 `nodeIntegration: true`、`contextIsolation: false`，渲染进程可直接使用 Node.js API

- **渲染进程（`renderer.js`）**
  - 依次加载 `database.js`、`i18n.js`、`utils.js`
  - 动态加载 `views/` 下所有视图模块
  - 视图通过全局对象 `window.utils`、`window.db`、`window.configs` 访问数据库和配置

### 数据存储

所有运行时数据位于 `data/`（相对应用可执行文件）：

| 文件 | 内容 |
|------|------|
| `data/system.db` | SQLite 数据库，含全部业务数据 |
| `data/company-info.json` | 公司名称、地址、Steuernummer、USt-IdNr.、IBAN、BIC |
| `data/yabandpay-setting.json` | YabandPay 用户名、`secretKey`、API 地址 |
| `data/instance.lock` | 单实例锁，含主机名与时间戳 |

数据库主要表（`database.js` 中定义）：

- `company_info`：公司信息，含 `ust_idnr`、`tax_number`、`iban`、`bic`
- `customers`：客户，含 `ust_idnr`、`email`、`phone`
- `goods_receipts` / `goods_issues`：进货与销售单据
- `payment_orders`：付款/收款指令
- 以及库存、支出、车辆、审计等相关表

`utils.js` 中 `loadConfigs()` 从 `data/company-info.json` 和 `data/yabandpay-setting.json` 读取配置到 `window.configs`，供各视图使用。

## 目录结构

```text
.
├── main.js                 # Electron 主进程：窗口、单实例锁、PDF IPC
├── renderer.js             # 渲染进程入口，加载数据库、i18n、工具与视图
├── database.js             # better-sqlite3 初始化与表结构
├── i18n.js                 # 中德双语文本资源
├── utils.js                # 配置读写、金额计算等工具函数
├── index.html              # 主页面骨架
├── views/                  # 各功能视图模块
│   ├── receipt-list.js         # 进货列表
│   ├── receipt-form.js         # 进货表单
│   ├── issue-list.js           # 销售列表
│   ├── issue-form.js           # 销售表单
│   ├── yabandpay-list.js       # YabandPay 交易列表
│   ├── yabandpay-form.js       # YabandPay 表单
│   ├── yabandpay-remote-sync.js# YabandPay 远程同步
│   ├── stock.js                # 库存查询
│   ├── expenses.js             # 其他支出
│   ├── cars.js                 # 公司车辆
│   ├── customers.js            # 客户管理
│   ├── company.js              # 公司信息与 YabandPay 配置
│   ├── tax.js                  # 税务报表
│   └── audit.js                # 审计追溯
├── scripts/
│   ├── build.sh            # Linux / macOS 打包脚本
│   └── build.ps1           # Windows PowerShell 打包脚本
├── data/                   # 运行时生成，不提交到 Git
└── dist/                   # 打包产物，不提交到 Git
```

## 开发运行

要求 Node 18.x（推荐 18.16.0）。

```bash
nvm use
npm install
npm start
```

`npm install` 会通过 `postinstall` 调用 `electron-rebuild`，为 Electron 重新编译 `better-sqlite3`。**不要**用 `node main.js` 直接运行，否则会因原生模块 ABI 不匹配报错。

## 打包

打包在 Docker 容器中完成，不依赖宿主机系统环境。使用镜像 `electronuserland/builder:18-wine`，内含 Node 18、Wine、build-essential，可同时产出 Windows 与 macOS 安装包。

### 前提

- 安装 Docker Desktop（Windows / macOS）或 Docker Engine（Linux）
- 能拉取 `electronuserland/builder:18-wine`

### Windows（PowerShell）

在项目根目录执行：

```powershell
.\scripts\build.ps1
```

如果 PowerShell 阻止脚本执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

### Linux / macOS

在项目根目录执行：

```bash
chmod +x scripts/build.sh
./scripts/build.sh
```

### 手动命令

不使用脚本时，在项目根目录执行：

```bash
docker run --rm -v "${PWD}:/project" -w /project electronuserland/builder:18-wine sh -c "npm install && npm run pack"
```

PowerShell 中续行用反引号 `` ` ``，路径用 `"${PWD}:/project"`。

### 产物

构建完成后，`dist/` 目录包含：

| 文件 | 平台 | 架构 |
|------|------|------|
| `AccountingSystem-v1.3.1-win-x64.exe` | Windows portable | x64 |
| `AccountingSystem-v1.3.1-mac-x64.zip` | macOS | x64 (Intel) |
| `AccountingSystem-v1.3.1-mac-arm64.zip` | macOS | arm64 (Apple Silicon) |

### 说明

- macOS 包为未签名 zip，在 macOS 上首次打开需右键“打开”或在系统设置中允许。
- 打包过程中 `npm install` 会在项目根目录生成 `node_modules/`，已加入 `.gitignore`。
- 清理产物：删除 `dist/` 目录。
- 如需保留 Electron 下载缓存加速重复打包，可在 `docker run` 中追加：
  ```bash
  -v "$HOME/.cache/electron:/home/electron/.cache/electron" \
  -v "$HOME/.cache/electron-builder:/home/electron/.cache/electron-builder"
  ```
  Windows 下对应 `$env:USERPROFILE\.cache\electron` 和 `$env:USERPROFILE\.cache\electron-builder`。

## 安全提示

`data/` 目录包含 SQLite 数据库、公司税号、IBAN、YabandPay API 密钥、客户信息等敏感数据，已在 `.gitignore` 中排除。**不要**将其提交到 Git，也不要将包含 `data/` 的构建目录分享给他人。

主窗口使用 `nodeIntegration: true` 与 `contextIsolation: false`，便于本地开发与文件操作，但不适合加载不受信任的远程内容。如未来需要加载外部页面，应改为 `preload` + `contextBridge`。

## License

MIT