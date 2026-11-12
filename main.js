// 主进程：创建窗口，处理锁文件，暴露API
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { version } = require('./package.json');

const lockFileName = 'instance.lock';
let mainWindow = null;
let lockFileFd = null;

const appRoot = getAppRoot();
const dataDir = path.join(appRoot, 'data');
const lockFilePath = path.join(dataDir, lockFileName);

// 解析应用执行的绝对路径
function getAppRoot() {
    // Windows 便携版特殊处理
    if (process.env.PORTABLE_EXECUTABLE_DIR) {
        return process.env.PORTABLE_EXECUTABLE_DIR;
    }
    const execPath = process.argv[0];
    if (process.platform === 'darwin') {
        // macOS: 从 .../MyApp.app/Contents/MacOS/MyApp 回溯到 .../MyApp.app 的父目录
        const appDir = path.dirname(path.dirname(path.dirname(execPath)));
        // 注意：如果 appDir 以 .app 结尾，则再取父目录，确保得到 .app 所在文件夹
        if (appDir.endsWith('.app')) {
            return path.dirname(appDir);
        }
        return appDir;
    }
    // Windows / Linux: 直接返回可执行文件所在目录
    return path.dirname(execPath);
}

// 确保数据目录存在
function ensureDataDir() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// 获取锁文件年龄（毫秒）
function getLockFileAge() {
    try {
        const stats = fs.statSync(lockFilePath);
        return Date.now() - stats.mtimeMs;
    } catch (err) {
        return Infinity;
    }
}

// 尝试获取锁（独占创建）
function tryAcquireLock() {
    try {
        const fd = fs.openSync(lockFilePath, 'wx');
        fs.writeSync(fd, `${os.hostname()}_${Date.now()}`);
        fs.closeSync(fd);
        console.log('Lock acquired successfully');
        return true;
    } catch (err) {
        if (err.code === 'EEXIST') {
            console.log('Lock file exists');
            return false;
        }
        console.error('Unexpected lock error:', err);
        return false;
    }
}

// 强制删除锁文件（危险，仅在确认无其他实例时调用）
function forceReleaseLock() {
    try {
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
            console.log('Lock file forcibly removed');
        }
    } catch (err) {
        console.error('Failed to remove lock file:', err);
    }
}

// 正常释放锁
function releaseLock() {
    if (lockFileFd) {
        try {
            fs.closeSync(lockFileFd);
        } catch(e) {}
        lockFileFd = null;
    }
    try {
        if (fs.existsSync(lockFilePath)) {
            fs.unlinkSync(lockFilePath);
            console.log('Lock released');
        }
    } catch (err) {
        console.error('Failed to release lock:', err);
    }
}

// 创建主窗口
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        show: false, // 先隐藏，等 ready-to-show 再显示
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            additionalArguments: [`--app-version=${version}`, `--data-dir=${appRoot}`]
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        console.log('Window shown');
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        // 窗口关闭时释放锁（正常情况下 app 会退出，但以防万一）
        releaseLock();
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error(`Failed to load index.html: ${errorCode} - ${errorDescription}`);
        dialog.showErrorBox('Load Error', `Failed to load the main page: ${errorDescription}\nPlease check the installation.`);
        app.quit();
    });

    // 开发时打开 DevTools（可选）
    // mainWindow.webContents.openDevTools();
}

// 应用启动
app.whenReady().then(() => {
    ensureDataDir();

    // 尝试获取锁
    if (tryAcquireLock()) {
        createWindow();
    } else {
        const age = getLockFileAge();
        if (age > 5 * 60 * 1000) {
            // 锁文件超时（超过5分钟），询问是否强制接管
            const result = dialog.showMessageBoxSync({
                type: 'question',
                buttons: ['Yes, take over', 'No, exit'],
                defaultId: 0,
                title: 'Another instance may be stuck',
                message: 'The system lock file is older than 5 minutes.\nAnother instance may have crashed.\nDo you want to take over?'
            });
            if (result === 0) {
                forceReleaseLock();
                if (tryAcquireLock()) {
                    createWindow();
                } else {
                    dialog.showErrorBox('Error', 'Cannot acquire lock even after cleanup. Please check file permissions.');
                    app.quit();
                }
            } else {
                app.quit();
            }
        } else {
            // 锁文件未超时，提示用户
            dialog.showErrorBox(
                'System in Use',
                'The accounting system is already running on this computer or another computer sharing the same data folder.\n\nPlease close the other instance first, or manually delete the "data/instance.lock" file if you are sure no other instance is active.'
            );
            app.quit();
        }
    }
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// 应用退出前释放锁
app.on('will-quit', () => {
    releaseLock();
});

// 处理另存为对话框（保持不变）
ipcMain.handle('save-file-dialog', async (event, options) => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, options);
        return result.filePath;
    } catch (err) {
        console.error(err);
        throw err;
    }
});

ipcMain.handle('generate-invoice-pdf', async (event, html, saveDir, fileName) => {
    const pdfWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    });
    try {
        // 加载 HTML 内容
        await pdfWindow.loadURL(`data:text/html,${encodeURIComponent(html)}`);
        // 等待渲染
        await new Promise(r => setTimeout(r, 500)); 
        // 生成 PDF
        const pdfData = await pdfWindow.webContents.printToPDF({
            printBackground: true,
            pageSize: 'A4',
        });
        // 写入文件
        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }
        const savePath = path.join(saveDir, fileName);
        // 使用异步写入避免阻塞，但也可以保留同步（数据量小）
        // fs.writeFileSync(savePath, pdfData);
        await fs.promises.writeFile(savePath, pdfData);
        return savePath;
    } catch (error) {
        console.error('PDF generation error:', error);
        throw error; // 将错误抛回给渲染进程
    } finally {
        pdfWindow.close(); // 确保窗口关闭
    }
});