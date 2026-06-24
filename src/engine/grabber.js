import 'dotenv/config';
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

class LogManager {
    constructor(filePath) {
        this.filePath = filePath;
        this.hashes = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, "utf8");
                return new Set(JSON.parse(data));
            }
        } catch (e) { console.error("[Logs] Error:", e.message); }
        return new Set();
    }
    saveHash(hash) {
        this.hashes.add(hash);
        fs.writeFileSync(this.filePath, JSON.stringify([...this.hashes], null, 2));
    }
    hasHash(hash) { return this.hashes.has(hash); }
    clear() {
        this.hashes.clear();
        fs.writeFileSync(this.filePath, "[]");
    }
}

class BrowserManager {
    static instance = null;
    static async getInstance() {
        if (!this.instance) {
            this.instance = await puppeteer.launch({
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
                headless: 'new',
                userDataDir: path.join(process.cwd(), 'session_boorus'),
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
            });
        }
        return this.instance;
    }
}

export default class WaifuGrabberEngine {
    constructor() {
        this.logManager = new LogManager(process.env.LOG_FILE || 'hashes_log.json');
        this.sources = {
            rule34: { name: 'rule34', pidMult: 42, domain: 'rule34.xxx' },
            danbooru: { name: 'danbooru', pidMult: 20, domain: 'danbooru.donmai.us' },
            gelbooru: { name: 'gelbooru', pidMult: 42, domain: 'gelbooru.com' }
        };
    }

    async fetchPosts(tagName, selectedSources, page) {
        console.log(`\n--- [SISTEMA] Iniciando búsqueda: ${tagName} ---`);
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

                const webUrl = srcKey === 'danbooru'
                    ? `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(tagName)}&page=${page}`
                    : `https://${src.domain}/index.php?page=post&s=list&tags=${encodeURIComponent(tagName)}&pid=${(page-1)*src.pidMult}`;

                const apiUrl = srcKey === 'danbooru'
                    ? `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagName)}&page=${page}&limit=42`
                    : `https://${src.domain}/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagName)}&pid=${(page-1)*src.pidMult}&limit=42`;

                await pageObj.goto(webUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await pageObj.waitForFunction(() => !document.body.innerText.includes('Just a moment'), { timeout: 10000 }).catch(() => {});

                // INTENTO 1: API JSON
                let posts = [];
                try {
                    const data = await pageObj.evaluate(async (url) => {
                        const res = await fetch(url);
                        return await res.json();
                    }, apiUrl);
                    if (data) posts = Array.isArray(data) ? data : (data.post || []);
                } catch (e) { posts = []; }

                // INTENTO 2: PLAN B - Scraping Agresivo de Miniaturas
                if (posts.length === 0) {
                    posts = await pageObj.evaluate((sourceName) => {
                        let selector = sourceName === 'gelbooru' ? '.thumbnail-preview' : (sourceName === 'rule34' ? '.thumb' : '.post-preview');
                        const elements = Array.from(document.querySelectorAll(selector));
                        
                        return elements.map(el => {
                            const a = el.querySelector('a');
                            const img = el.querySelector('img');
                            if (!a) return null;

                            const match = a.href.match(/id=(\d+)/) || a.href.match(/\/posts\/(\d+)/);
                            return {
                                id: match ? match[1] : null,
                                url: a.href,
                                thumb: img ? img.src : null
                            };
                        }).filter(p => p && p.id);
                    }, srcKey);
                }

                const formatted = posts.map(p => {
                    // PRIORIDAD: thumbnail extraída -> preview_url -> sample_url -> vacío
                    let previewUrl = p.thumb || p.preview_file_url || p.preview_url || p.sample_url || '';
                    if (previewUrl.startsWith('//')) previewUrl = `https:${previewUrl}`;
                    
                    return {
                        id: p.id,
                        source: srcKey,
                        url: p.file_url || p.large_file_url || p.url,
                        preview: previewUrl,
                        isDirect: !!p.file_url
                    };
                });

                console.log(`[${srcKey}] Encontrados ${formatted.length} posts.`);
                allPosts = allPosts.concat(formatted);
            } catch (e) { console.error(`[${srcKey}] Error: ${e.message}`); }
            finally { await pageObj.close(); }
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
                finalUrl = await page.evaluate((sourceName) => {
                    const i = document.querySelector('#image');
                    if (i && i.src) return i.src;
                    const l = document.querySelector('a[href*="/images/"]');
                    return l ? l.href : null;
                }, post.source);
            } catch (e) { console.error(`[DL Error] ${e.message}`); }
            finally { await page.close(); }
        }

        if (!finalUrl) return { success: false, message: "No real image found" };

        return new Promise((resolve) => {
            const referers = { rule34: 'https://rule34.xxx/', danbooru: 'https://danbooru.donmai.us/', gelbooru: 'https://gelbooru.com/' };
            const ref = referers[post.source] || 'https://google.com';
            const tempPath = path.join(downloadDir, `temp_${Date.now()}.tmp`);

            const args = [
                '-s', '-L', '-o', tempPath,
                '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                '-H', `Referer: ${ref}`,
                '-H', 'Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                '-H', 'Sec-Fetch-Dest: image',
                '-H', 'Sec-Fetch-Mode: no-cors',
                '-H', 'Sec-Fetch-Site: cross-site',
                '--connect-timeout', '15',
                '--max-time', '60',
                finalUrl
            ];

            const proc = spawn('curl', args);
            proc.on('close', (code) => {
                if (code !== 0 || !fs.existsSync(tempPath)) {
                    resolve({ success: false, message: `Curl error ${code}` });
                    return;
                }
                const buffer = fs.readFileSync(tempPath);
                const hash = crypto.createHash('sha256').update(buffer).digest('hex');
                if (this.logManager.hasHash(hash)) {
                    fs.unlinkSync(tempPath);
                    resolve({ success: false, message: "Duplicate" });
                    return;
                }
                const cleanUrl = finalUrl.split('?')[0];
                const ext = path.extname(cleanUrl) || '.jpg';
                const fileName = `${post.source}_${post.id}${ext}`;
                const fullPath = path.join(downloadDir, fileName);
                fs.renameSync(tempPath, fullPath);
                this.logManager.saveHash(hash);
                resolve({ success: true, filePath: fullPath });
            });
            proc.on('error', (err) => resolve({ success: false, message: err.message }));
        });
    }

    clearLogs() {
        this.logManager.clear();
        return { success: true };
    }
}