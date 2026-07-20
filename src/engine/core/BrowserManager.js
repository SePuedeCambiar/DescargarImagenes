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
            try {
                this.instance = await this.launchBrowser();
            } catch (e) {
                console.error(`[BrowserManager] Primer intento fallido: ${e.message}`);
                
                // 🚀 ACCIÓN NUCLEAR: Si falla, borramos TODO el perfil y reintentamos
                await this.clearFullSession();
                
                console.log(`[BrowserManager] Reintentando con sesión limpia...`);
                this.instance = await this.launchBrowser();
            }
        }
        return this.instance;
    }

    static async launchBrowser() {
        let browserRoot = app.isPackaged 
            ? path.join(process.resourcesPath, 'puppeteer-browser') 
            : path.join(process.cwd(), '.cache', 'puppeteer');
        
        const executablePath = this.findChromeBinary(browserRoot);
        const userDataDir = path.join(app.getPath('userData'), 'session_boorus');

        // Borrar lock preventivamente
        const lockFile = path.join(userDataDir, 'SingletonLock');
        if (fs.existsSync(lockFile)) {
            try { fs.unlinkSync(lockFile); } catch (e) {}
        }

        return await puppeteer.launch({
            executablePath: executablePath,
            headless: 'new',
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-gpu',              // 🚀 Crítico para Linux/AppImage
                '--disable-software-rasterizer', // 🚀 Evita crashes de renderizado
                '--no-first-run',
                '--no-zygote',
            ],
        });
    }

    static async clearFullSession() {
        const userDataDir = path.join(app.getPath('userData'), 'session_boorus');
        if (fs.existsSync(userDataDir)) {
            try {
                fs.rmSync(userDataDir, { recursive: true, force: true });
                console.log(`[BrowserManager] 🗑️ Carpeta de sesión eliminada por completo`);
            } catch (e) {
                console.error(`[BrowserManager] Error borrando sesión: ${e.message}`);
            }
        }
    }

    static async close() {
        if (this.instance) {
            try {
                await this.instance.close();
            } catch (e) {}
            this.instance = null;
        }
    }
}

export default BrowserManager;