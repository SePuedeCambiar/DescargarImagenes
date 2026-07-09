import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url'; 
import { app } from 'electron'; // <--- CRÍTICO: Importar app para rutas en producción
import BrowserManager from './core/BrowserManager.js';
import LogManager from './core/LogManager.js';
import HashService from './services/HashService.js';
import DownloadService from './services/DownloadService.js';

export default class WaifuGrabberEngine {
    constructor() {
        // Ruta de logs: Priorizamos userData de Electron para evitar problemas de permisos en Linux/AppImage
        const logPath = process.env.LOG_FILE || path.join(app.getPath('userData'), 'hashes_log.json');
        this.logManager = new LogManager(logPath);
        this.sources = {}; 
    }

    // ==========================================
    // 🛠️ CARGA AUTOMÁTICA DE FUENTES (SISTEMA DE PLUGINS)
    // ==========================================
    async initialize() {
        // 🚨 CORRECCIÓN: Usamos app.getAppPath() en lugar de process.cwd()
        // Esto asegura que encuentre la carpeta 'src' dentro del archivo app.asar del AppImage
        const sourcesDir = path.join(app.getAppPath(), 'src', 'engine', 'sources');
        
        if (!fs.existsSync(sourcesDir)) {
            console.error(`[Engine] No se encontró la carpeta de fuentes en: ${sourcesDir}`);
            return;
        }

        const files = fs.readdirSync(sourcesDir);

        for (const file of files) {
            if (file.endsWith('Source.js') && file !== 'BaseSource.js') {
                try {
                    const filePath = path.join(sourcesDir, file);
                    const fileUrl = pathToFileURL(filePath).href;
                    const SourceModule = await import(fileUrl);
                    const SourceClass = SourceModule.default;
                    
                    const config = SourceClass.config;
                    if (!config) {
                        console.error(`[Engine] ⚠️ La fuente ${file} no tiene un objeto 'static config'. Saltando...`);
                        continue;
                    }

                    const sourceId = config.name;
                    this.sources[sourceId] = new SourceClass(config);
                    console.log(`[Engine] ✅ Fuente cargada automáticamente: ${sourceId}`);
                } catch (e) {
                    console.error(`[Engine] ❌ Error crítico cargando fuente ${file}:`, e);
                }
            }
        }
    }

    // ==========================================
    // 🛠️ CONSTRUCTOR DE CONSULTAS (MÓDULO B)
    // ==========================================
    buildFinalQuery(tagName, categories = [], denylist = '') {
        let queryParts = [];
        if (tagName) queryParts.push(tagName);
        if (Array.isArray(categories)) {
            queryParts.push(...categories);
        }
        if (denylist && typeof denylist === 'string') {
            const blacklistedTags = denylist
                .split(',')
                .map(t => t.trim())
                .filter(t => t !== '')
                .map(t => `-${t}`);
            queryParts.push(...blacklistedTags);
        }
        return queryParts.join(' ');
    }

    getAvailableSources() {
        return Object.entries(this.sources).map(([id, source]) => ({
            id: id,
            name: source.name.charAt(0).toUpperCase() + source.name.slice(1)
        }));
    }

    // ==========================================
    // 🚀 LÓGICA DE BÚSQUEDA
    // ==========================================
    async fetchPosts(params) {
        const { tag, sources: selectedSources, page, categories = [], denylist = '' } = params;
        const browser = await BrowserManager.getInstance();
        let allPosts = [];

        const finalQuery = this.buildFinalQuery(tag, categories, denylist);
        console.log(`[Engine] Ejecutando búsqueda con query: ${finalQuery}`);

        if (!selectedSources || !Array.isArray(selectedSources)) {
            console.error("[Engine] Error: selectedSources no es un array válido.");
            return [];
        }

        for (const key of selectedSources) {
            const source = this.sources[key];
            if (!source) continue;

            const pageObj = await browser.newPage();
            try {
                await pageObj.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
                await pageObj.setRequestInterception(true);
                pageObj.on('request', (req) => {
                    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) req.abort();
                    else req.continue();
                });

                if (key === 'danbooru') {
                    const apiUrl = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(finalQuery)}&page=${page}&limit=42`;
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
                    }
                } else {
                    const webUrl = `https://${source.domain}/index.php?page=post&s=list&tags=${encodeURIComponent(finalQuery)}&pid=${(page-1)*source.pidMult}`;
                    await pageObj.goto(webUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    const posts = await this.scrapeHTML(pageObj, key);
                    allPosts = allPosts.concat(posts);
                }
            } catch (e) { 
                console.error(`[${key}] Error: ${e.message}`); 
            } finally { 
                await pageObj.close(); 
            }
        }
        return allPosts;
    }

    async scrapeHTML(pageObj, srcKey) {
        return await pageObj.evaluate((sourceName) => {
            const selectors = ['.thumbnail-preview', '.thumb', '.post-preview', '.image-card', 'div[class*="thumb"]'];
            let elements = [];
            for (const selector of selectors) {
                const found = Array.from(document.querySelectorAll(selector));
                if (found.length > 0) { elements = found; break; }
            }
            return elements.map(el => {
                const a = el.querySelector('a');
                const img = el.querySelector('img');
                if (!a) return null;
                const match = a.href.match(/id=(\d+)/) || a.href.match(/\/posts\/(\d+)/);
                return { id: match ? match[1] : null, source: sourceName, url: a.href, preview: img ? img.src : null, isDirect: false };
            }).filter(p => p && p.id);
        }, srcKey);
    }

    async suggestTags(prefix) {
        const source = this.sources['danbooru'];
        if (!source) return [];
        const browser = await BrowserManager.getInstance(); 
        return await source.getSuggestedTags(prefix, browser);
    }

    // ==========================================
    // 📥 LÓGICA DE DESCARGA
    // ==========================================
    async downloadImage(post, downloadDir) {
        const absoluteDir = path.resolve(downloadDir);
        if (!fs.existsSync(absoluteDir)) fs.mkdirSync(absoluteDir, { recursive: true });

        const source = this.sources[post.source];
        if (!source) return { success: false, message: "Fuente no soportada" };

        const browser = await BrowserManager.getInstance();
        const finalUrl = await source.resolveImageUrl(post.url, browser);
        if (!finalUrl) return { success: false, message: "No real image found" };

        const tempPath = path.join(absoluteDir, `temp_${Date.now()}.tmp`);

        try {
            const referers = { 
                rule34: 'https://rule34.xxx/', 
                danbooru: 'https://danbooru.donmai.us/', 
                gelbooru: 'https://gelbooru.com/',
                safebooru: 'https://safebooru.org/'
            };
            const ref = referers[post.source] || 'https://google.com';

            // 🚀 CORRECCIÓN: Usamos el servicio especializado DownloadService
            // Ya no hacemos spawn('curl') aquí, lo hacemos en la clase DownloadService.js
            await DownloadService.download(finalUrl, ref, tempPath);

            const buffer = fs.readFileSync(tempPath);
            const exactHash = await HashService.calculateExactHash(buffer);
            const visualHash = await HashService.calculateVisualHash(buffer);

            if (this.logManager.isDuplicate(exactHash, visualHash)) {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                return { success: false, message: "Duplicate" };
            }

            const cleanUrl = finalUrl.split('?')[0];
            const ext = path.extname(cleanUrl) || '.jpg';
            const fileName = `${post.source}_${post.id}${ext}`;
            const fullPath = path.join(absoluteDir, fileName);
            
            fs.renameSync(tempPath, fullPath);
            this.logManager.save(exactHash, visualHash);
            
            return { success: true, filePath: fullPath };
        } catch (e) {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            return { success: false, message: e.message };
        }
    }

    clearLogs() {
        this.logManager.clear();
        return { success: true };
    }
}
