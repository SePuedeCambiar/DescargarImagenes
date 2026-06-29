import 'dotenv/config';
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { app } from 'electron';
import { createRequire } from 'module';

// Configuramos Jimp usando createRequire para evitar errores de exportación en ESM
const require = createRequire(import.meta.url);
const jimpModule = require('jimp');

const Jimp = jimpModule.Jimp || jimpModule.default || jimpModule;


puppeteer.use(StealthPlugin());

// ==========================================
// 🛠️ UTILIDADES DE SISTEMA
// ==========================================

// Busca el binario de Chrome recursivamente en el AppImage o carpeta local
function findChromeBinary(dir) {
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            const found = findChromeBinary(fullPath);
            if (found) return found;
        } else if (file === 'chrome') return fullPath;
    }
    return null;
}

// Genera un Hash Perceptual (dHash) usando Jimp para detectar clones visuales
async function generateVisualHash(buffer) {
    try {
        const image = await Jimp.read(buffer);
        
        // Redimensionar a 9x8 y convertir a escala de grises para normalizar
        image.resize(9, 8).grayscale();

        let hash = "";
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const left = image.getPixelColor(x, y);
                const right = image.getPixelColor(x + 1, y);
                // Comparación de brillo entre píxeles adyacentes
                hash += left < right ? "1" : "0";
            }
        }
        return hash;
    } catch (e) {
        console.error("[VisualHash] Error procesando imagen:", e.message);
        return null;
    }
}

// ==========================================
// 📊 GESTOR DE CONTEOS (Soporte Danbooru 42+)
// ==========================================
class SourceCounter {
    static async getCounts(tagName, selectedSources) {
        const results = {};
        const browser = await BrowserManager.getInstance();

        for (const srcKey of selectedSources) {
            try {
                if (srcKey === 'danbooru') {
                    // API de Danbooru para conteo exacto
                    const url = `https://danbooru.donmai.us/counts/posts.json?tags=${encodeURIComponent(tagName)}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    const total = data.counts?.posts || 0;
                    // Usamos 42 como divisor ya que ahora pediremos 42 posts por página
                    results[srcKey] = { total, maxPage: Math.ceil(total / 42) };
                } else {
                    // Scraping rápido de la primera página para Rule34/Gelbooru
                    const page = await browser.newPage();
                    const domain = srcKey === 'rule34' ? 'rule34.xxx' : 'gelbooru.com';
                    const url = `https://${domain}/index.php?page=post&s=list&tags=${encodeURIComponent(tagName)}`;
                    
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                    const total = await page.evaluate(() => {
                        const text = document.body.innerText;
                        const match = text.match(/([\d,]+)\s+posts?\s+found/i);
                        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
                    });
                    await page.close();
                    results[srcKey] = { total, maxPage: Math.ceil(total / 42) };
                }
            } catch (e) {
                console.error(`[Counter] Error en ${srcKey}: ${e.message}`);
                results[srcKey] = { total: 0, maxPage: 1 };
            }
        }
        return results;
    }
}

// ==========================================
// 💾 GESTOR DE LOGS (Duplicados Inteligentes)
// ==========================================
class LogManager {
    constructor(filePath) {
        this.filePath = filePath;
        this.logs = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, "utf8");
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) return { exact: parsed, visual: [] };
                return parsed;
            }
        } catch (e) { console.error("[Logs] Error:", e.message); }
        return { exact: [], visual: [] };
    }
    save(exactHash, visualHash) {
        this.logs.exact.push(exactHash);
        if (visualHash) this.logs.visual.push(visualHash);
        fs.writeFileSync(this.filePath, JSON.stringify(this.logs, null, 2));
    }
    isDuplicate(exactHash, visualHash) {
        if (this.logs.exact.includes(exactHash)) return true;
        if (visualHash && this.logs.visual.includes(visualHash)) return true;
        return false;
    }
    clear() {
        this.logs = { exact: [], visual: [] };
        fs.writeFileSync(this.filePath, JSON.stringify(this.logs, null, 2));
    }
}

// ==========================================
// 🌐 GESTOR DE NAVEGADOR (Singleton)
// ==========================================
class BrowserManager {
    static instance = null;
    static async getInstance() {
        if (!this.instance) {
            let browserRoot = app.isPackaged 
                ? path.join(process.resourcesPath, 'puppeteer-browser') 
                : path.join(process.cwd(), '.cache', 'puppeteer');
            
            const executablePath = findChromeBinary(browserRoot);
            this.instance = await puppeteer.launch({
                executablePath: executablePath,
                headless: 'new',
                userDataDir: path.join(app.getPath('userData'), 'session_boorus'),
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
            });
        }
        return this.instance;
    }
}

// ==========================================
// 🚀 MOTOR PRINCIPAL (WaifuGrabberEngine)
// ==========================================
export default class WaifuGrabberEngine {
    constructor() {
        const logPath = process.env.LOG_FILE || path.join(app.getPath('userData'), 'hashes_log.json');
        this.logManager = new LogManager(logPath);
        this.sources = {
            rule34: { name: 'rule34', pidMult: 42, domain: 'rule34.xxx' },
            danbooru: { name: 'danbooru', pidMult: 20, domain: 'danbooru.donmai.us' },
            gelbooru: { name: 'gelbooru', pidMult: 42, domain: 'gelbooru.com' }
        };
    }

    async fetchPosts(tagName, selectedSources, page) {
        const browser = await BrowserManager.getInstance();
        let allPosts = [];

        for (const srcKey of selectedSources) {
            const src = this.sources[srcKey];
            const pageObj = await browser.newPage();
            try {
                await pageObj.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                await pageObj.setRequestInterception(true);
                pageObj.on('request', (req) => {
                    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
                    else req.continue();
                });

                if (srcKey === 'danbooru') {
                    // --- ESTRATEGIA DANBOORU: Usar API JSON para obtener 42 imágenes ---
                    const apiUrl = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagName)}&page=${page}&limit=42`;
                    const apiData = await pageObj.evaluate(async (url) => {
                        try {
                            const res = await fetch(url);
                            return await res.json();
                        } catch (e) { return null; }
                    }, apiUrl);

                    if (apiData && Array.isArray(apiData)) {
                        const formatted = apiData.map(p => ({
                            id: p.id,
                            source: 'danbooru',
                            url: p.file_url || p.large_file_url || p.url,
                            preview: p.preview_file_url || p.preview_url,
                            isDirect: !!p.file_url
                        }));
                        allPosts = allPosts.concat(formatted);
                    } else {
                        const posts = await this.scrapeHTML(pageObj, srcKey);
                        allPosts = allPosts.concat(posts);
                    }
                } else {
                    // --- ESTRATEGIA RULE34 / GELBOORU ---
                    const webUrl = `https://${src.domain}/index.php?page=post&s=list&tags=${encodeURIComponent(tagName)}&pid=${(page-1)*src.pidMult}`;
                    await pageObj.goto(webUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    const posts = await this.scrapeHTML(pageObj, srcKey);
                    allPosts = allPosts.concat(posts);
                }
            } catch (e) { console.error(`[${srcKey}] Error: ${e.message}`); }
            finally { await pageObj.close(); }
        }
        return allPosts;
    }

    // Función auxiliar de scraping para HTML
    async scrapeHTML(pageObj, srcKey) {
        return await pageObj.evaluate((sourceName) => {
            let selector = sourceName === 'gelbooru' ? '.thumbnail-preview' : (sourceName === 'rule34' ? '.thumb' : '.post-preview');
            const elements = Array.from(document.querySelectorAll(selector));
            return elements.map(el => {
                const a = el.querySelector('a');
                const img = el.querySelector('img');
                if (!a) return null;
                const match = a.href.match(/id=(\d+)/) || a.href.match(/\/posts\/(\d+)/);
                return { 
                    id: match ? match[1] : null, 
                    source: sourceName, 
                    url: a.href, 
                    preview: img ? img.src : null, 
                    isDirect: false 
                };
            }).filter(p => p && p.id);
        }, srcKey);
    }

    async fetchAllPages(tagName, selectedSources, onProgress) {
        console.log(`\n--- [SISTEMA] Iniciando Búsqueda Masiva: ${tagName} ---`);
        const counts = await SourceCounter.getCounts(tagName, selectedSources);
        let totalPages = 0;
        selectedSources.forEach(src => totalPages = Math.max(totalPages, counts[src]?.maxPage || 1));

        console.log(`[SISTEMA] Total de páginas a procesar: ${totalPages}`);
        let allPosts = [];
        
        for (let p = 1; p <= totalPages; p++) {
            console.log(`[SISTEMA] Procesando página ${p}/${totalPages}...`);
            const pagePosts = await this.fetchPosts(tagName, selectedSources, p);
            allPosts = allPosts.concat(pagePosts);
            if (onProgress) onProgress({ currentPage: p, totalPages: totalPages, postsFound: allPosts.length });
        }
        return allPosts;
    }

    async downloadImage(post, downloadDir) {
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

        let finalUrl = post.url;
        if (!post.isDirect || finalUrl.includes('index.php?page=post')) {
            const browser = await BrowserManager.getInstance();
            const page = await browser.newPage();
            try {
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                await page.goto(post.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
                finalUrl = await page.evaluate(() => {
                    const i = document.querySelector('#image');
                    if (i && i.src) return i.src;
                    const l = document.querySelector('a[href*="/images/"]');
                    if (l && l.href) return l.href;
                    return null;
                });
            } catch (e) { console.error(`[DL Error] ${e.message}`); }
            finally { await page.close(); }
        }

        if (!finalUrl) return { success: false, message: "No real image found" };

        return new Promise((resolve) => {
            const referers = { rule34: 'https://rule34.xxx/', danbooru: 'https://danbooru.donmai.us/', gelbooru: 'https://gelbooru.com/' };
            const ref = referers[post.source] || 'https://google.com';
            const tempPath = path.join(downloadDir, `temp_${Date.now()}.tmp`);
            const args = ['-s', '-L', '-o', tempPath, '-H', `Referer: ${ref}`, finalUrl];
            
            const proc = spawn('curl', args);
            proc.on('close', async (code) => {
                if (code !== 0 || !fs.existsSync(tempPath)) {
                    resolve({ success: false, message: `Curl error ${code}` });
                    return;
                }

                const buffer = fs.readFileSync(tempPath);
                const exactHash = crypto.createHash('sha256').update(buffer).digest('hex');
                const visualHash = await generateVisualHash(buffer);

                if (this.logManager.isDuplicate(exactHash, visualHash)) {
                    fs.unlinkSync(tempPath);
                    console.log(`[SISTEMA] 🚫 Duplicado detectado. Saltando...`);
                    resolve({ success: false, message: "Duplicate" });
                    return;
                }

                const cleanUrl = finalUrl.split('?')[0];
                const ext = path.extname(cleanUrl) || '.jpg';
                const fileName = `${post.source}_${post.id}${ext}`;
                const fullPath = path.join(downloadDir, fileName);
                
                fs.renameSync(tempPath, fullPath);
                this.logManager.save(exactHash, visualHash);
                resolve({ success: true, filePath: fullPath });
            });
        });
    }

    clearLogs() {
        this.logManager.clear();
        return { success: true };
    }
}
