import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url'; 
import BrowserManager from './core/BrowserManager.js';
import LogManager from './core/LogManager.js';
import HashService from './services/HashService.js';
import DownloadService from './services/DownloadService.js';

export default class WaifuGrabberEngine {
    constructor() {
        this.logManager = new LogManager();
        this.sources = {}; 
    }

    // ==========================================
    // 🛠️ CARGA AUTOMÁTICA DE FUENTES (SISTEMA DE PLUGINS)
    // ==========================================
    async initialize() {
        const sourcesDir = path.join(process.cwd(), 'src', 'engine', 'sources');
        
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

        // 1. Tag principal (Personaje/Obra)
        if (tagName) queryParts.push(tagName);

        // 2. Añadir categorías activas (ej: highres, absurdres)
        if (Array.isArray(categories)) {
            queryParts.push(...categories);
        }

        // 3. Añadir la denylist con el signo menos (ej: -blur, -lowres)
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

    // ==========================================
    // 🛠️ MÉTODO PARA UI DINÁMICA
    // ==========================================
    getAvailableSources() {
        return Object.entries(this.sources).map(([id, source]) => ({
            id: id,
            name: source.name.charAt(0).toUpperCase() + source.name.slice(1)
        }));
    }

    // ==========================================
    // 🚀 LÓGICA DE BÚSQUEDA (ACTUALIZADA PARA MÓDULO B)
    // ==========================================
    async fetchPosts(tagName, selectedSources, page, categories = [], denylist = '') {
        const browser = await BrowserManager.getInstance();
        let allPosts = [];

        // Construimos la consulta final una sola vez para todas las fuentes
        const finalQuery = this.buildFinalQuery(tagName, categories, denylist);
        console.log(`[Engine] Ejecutando búsqueda con query: ${finalQuery}`);

        for (const key of selectedSources) {
            const source = this.sources[key];
            if (source) {
                // Ahora pasamos finalQuery en lugar de tagName
                const posts = await source.fetchPosts(page, finalQuery, browser);
                allPosts.push(...posts);
            }
        }
        return allPosts;
    }

    // ==========================================
    // 📥 LÓGICA de DESCARGA (Sigue igual)
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

        return new Promise((resolve) => {
            const referers = { 
                rule34: 'https://rule34.xxx/', 
                danbooru: 'https://danbooru.donmai.us/', 
                gelbooru: 'https://gelbooru.com/',
                safebooru: 'https://safebooru.org/'
            };
            const ref = referers[post.source] || 'https://google.com';
            const args = ['-s', '-L', '-o', tempPath, '-H', `Referer: ${ref}`, finalUrl];
            
            const proc = spawn('curl', args);

            proc.on('close', async (code) => {
                if (code !== 0 || !fs.existsSync(tempPath)) {
                    resolve({ success: false, message: `Curl error ${code}` });
                    return;
                }

                try {
                    const buffer = fs.readFileSync(tempPath);
                    const exactHash = await HashService.calculateExactHash(buffer);
                    const visualHash = await HashService.calculateVisualHash(buffer);

                    if (this.logManager.isDuplicate(exactHash, visualHash)) {
                        fs.unlinkSync(tempPath);
                        resolve({ success: false, message: "Duplicate" });
                        return;
                    }

                    const cleanUrl = finalUrl.split('?')[0];
                    const ext = path.extname(cleanUrl) || '.jpg';
                    const fileName = `${post.source}_${post.id}${ext}`;
                    const fullPath = path.join(absoluteDir, fileName);
                    
                    fs.renameSync(tempPath, fullPath);
                    this.logManager.save(exactHash, visualHash);
                    
                    resolve({ success: true, filePath: fullPath });
                } catch (e) {
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    resolve({ success: false, message: e.message });
                }
            });
        });
    }

    clearLogs() {
        this.logManager.clear();
        return { success: true };
    }
}
