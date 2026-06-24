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
            rule34: { name: 'rule34', pidMult: 42 },
            danbooru: { name: 'danbooru', pidMult: 20 },
            gelbooru: { name: 'gelbooru', pidMult: 42 }
        };
    }

    // FUNCIÓN CRÍTICA: Extrae la URL real de la imagen desde la página del post
    async extractRealImageUrl(post) {
        if (post.url.includes('cdn.donmai.us') || post.url.includes('wimg.rule34') || post.url.includes('img.gelbooru')) {
            return post.url;
        }

        const browser = await BrowserManager.getInstance();
        const page = await browser.newPage();
        try {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            await page.goto(post.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            
            return await page.evaluate((sourceName) => {
                if (sourceName === 'rule34') {
                    const v = document.querySelector('video source');
                    if (v && v.src) return v.src;
                    const i = document.querySelector('#image');
                    return i ? i.src : null;
                }
                if (sourceName === 'danbooru') {
                    const l = document.querySelector('#post-option-view-original a');
                    return l ? l.href : null;
                }
                if (sourceName === 'gelbooru') {
                    const i = document.querySelector('#image');
                    return i ? i.src : null;
                }
                return null;
            }, post.source);
        } catch (e) {
            console.error(`[Extract Error] ${e.message}`);
            return null;
        } finally {
            await page.close();
        }
    }

    async fetchPosts(tagName, selectedSources, page) {
        console.log(`[GRABBER] 🚀 Motor activado. Buscando: ${tagName} en ${selectedSources.join(', ')}`);
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
                    : `https://${srcKey === 'rule34' ? 'rule34.xxx' : 'gelbooru.com'}/index.php?page=post&s=list&tags=${encodeURIComponent(tagName)}&pid=${(page-1)*src.pidMult}`;

                const apiUrl = srcKey === 'danbooru'
                    ? `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagName)}&page=${page}&limit=42`
                    : `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(tagName)}&pid=${(page-1)*src.pidMult}&limit=42`;

                await pageObj.goto(webUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await pageObj.waitForFunction(() => !document.body.innerText.includes('Just a moment'), { timeout: 15000 }).catch(() => {});

                const data = await pageObj.evaluate(async (url) => {
                    try {
                        const res = await fetch(url);
                        return await res.json();
                    } catch (e) { return null; }
                }, apiUrl);

                let posts = [];
                if (data) {
                    posts = Array.isArray(data) ? data : (data.post || []);
                } else {
                    posts = await pageObj.evaluate((sourceName) => {
                        let selector = sourceName === 'gelbooru' ? 'article.thumbnail-preview a, .thumbnail-preview a' : (sourceName === 'rule34' ? '.thumb a, article a' : '.post-preview a');
                        const links = Array.from(document.querySelectorAll(selector));
                        return links.map(a => {
                            const match = a.href.match(/\/posts\/(\d+)/) || a.href.match(/id=(\d+)/) || a.href.match(/&id=(\d+)/);
                            return { url: a.href, id: match ? match[1] : null };
                        }).filter(p => p.id !== null);
                    }, srcKey);
                }

                const formatted = posts.map(p => {
                // Obtenemos la URL de la miniatura original
                let previewUrl = p.preview_file_url || p.preview_url || p.sample_url || '';
                if (previewUrl.startsWith('//')) previewUrl = `https:${previewUrl}`;
    
                // YA NO USAMOS WESERV. Enviamos la URL directa.
                return {
                    id: p.id,
                    source: srcKey,
                    url: p.file_url || p.large_file_url || p.preview_url || p.url,
                    preview: previewUrl, // <--- URL DIRECTA
                    isDirect: !!p.file_url
                    };
            });
                allPosts = allPosts.concat(formatted);
            } catch (e) { console.error(`[${srcKey}] Error: ${e.message}`); }
            finally { await pageObj.close(); }
        }
        return allPosts;
    }

    async downloadImage(post, downloadDir) {
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

        // PASO CRÍTICO: Si la URL es de una página, extraer la URL de la imagen real
        let finalUrl = post.url;
        if (!post.isDirect || finalUrl.includes('index.php?page=post')) {
            console.log(`[DL] Extrayendo URL real de la página: ${finalUrl}`);
            const realUrl = await this.extractRealImageUrl(post);
            if (!realUrl) return { success: false, message: "No se encontró la imagen real en la página" };
            finalUrl = realUrl;
        }

        return new Promise((resolve) => {
            const referers = { rule34: 'https://rule34.xxx/', danbooru: 'https://danbooru.donmai.us/', gelbooru: 'https://gelbooru.com/' };
            const ref = referers[post.source] || 'https://google.com';
            const tempPath = path.join(downloadDir, `temp_${Date.now()}.tmp`);

            const args = [
                '-s', '-L', '-o', tempPath,
                '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                '-H', `Referer: ${ref}`,
                '-H', 'Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                '-H', 'Accept-Language: en-US,en;q=0.9',
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