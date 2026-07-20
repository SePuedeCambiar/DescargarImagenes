import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

puppeteer.use(StealthPlugin());

class BrowserManager {
    static instance = null;

    static findChromeBinary(dir) {
        if (!fs.existsSync(dir)) return null;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const found = BrowserManager.findChromeBinary(fullPath);
                if (found) return found;
            } else if (file === 'chrome' || file === 'chrome.exe') return fullPath;
        }
        return null;
    }

    static async getInstance() {
    if (!this.instance) {
        let browserRoot = app.isPackaged 
            ? path.join(process.resourcesPath, 'puppeteer-browser') 
            : path.join(process.cwd(), '.cache', 'puppeteer');
        
        const executablePath = this.findChromeBinary(browserRoot);
        const userDataDir = path.join(app.getPath('userData'), 'session_boorus');

        // ============================================================
        // 🛡️ ESTA ES LA PARTE CRÍTICA: BORRAR EL LOCK AUTOMÁTICAMENTE
        // ============================================================
        const lockFile = path.join(userDataDir, 'SingletonLock');
        if (fs.existsSync(lockFile)) {
            try {
                fs.unlinkSync(lockFile); 
                console.log('[BrowserManager] 🗑️ Lock antiguo removido para evitar bloqueo');
            } catch (e) {
                console.error(`[BrowserManager] ❌ No se pudo borrar el lock: ${e.message}`);
            }
        }
        // ============================================================

        this.instance = await puppeteer.launch({
            executablePath: executablePath,
            headless: 'new',
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-extensions',
            ],
        });
    }
    return this.instance;
}

    static async close() {
        if (this.instance) {
            try {
                await this.instance.close();
            } catch (e) {
                console.error(`[BrowserManager] Error al cerrar: ${e.message}`);
            } finally {
                this.instance = null;
            }
        }
    }
}

export default BrowserManager;