import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

puppeteer.use(StealthPlugin());

class BrowserManager {
    static instance = null;

    // Mantenemos tu función de búsqueda de binario tal cual
    static findChromeBinary(dir) {
        if (!fs.existsSync(dir)) return null;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                const found = BrowserManager.findChromeBinary(fullPath);
                if (found) return found;
            } else if (file === 'chrome') return fullPath;
        }
        return null;
    }

    static async getInstance() {
        if (!this.instance) {
            let browserRoot = app.isPackaged 
                ? path.join(process.resourcesPath, 'puppeteer-browser') 
                : path.join(process.cwd(), '.cache', 'puppeteer');
            
            const executablePath = this.findChromeBinary(browserRoot);
            
            this.instance = await puppeteer.launch({
                executablePath: executablePath,
                headless: 'new',
                userDataDir: path.join(app.getPath('userData'), 'session_boorus'),
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-dev-shm-usage', 
                    '--disable-blink-features=AutomationControlled'
                ]
            });
        }
        return this.instance;
    }

    static async close() {
        if (this.instance) {
            await this.instance.close();
            this.instance = null;
        }
    }
}

export default BrowserManager;
