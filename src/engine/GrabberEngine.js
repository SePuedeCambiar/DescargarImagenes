import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process'; 
import BrowserManager from './core/BrowserManager.js';
import LogManager from './core/LogManager.js';
import HashService from './services/HashService.js';
import DownloadService from './services/DownloadService.js';
import Rule34Source from './sources/Rule34Source.js';
import DanbooruSource from './sources/DanbooruSource.js';
import GelbooruSource from './sources/GelbooruSource.js';
import SafebooruSource from './sources/SafebooruSource.js';


export default class WaifuGrabberEngine {
    constructor() {
        this.logManager = new LogManager();
        // Registramos las fuentes disponibles
        this.sources = {
        rule34: new Rule34Source({ name: 'rule34', domain: 'rule34.xxx', pidMult: 42 }),
        danbooru: new DanbooruSource({ name: 'danbooru', domain: 'danbooru.donmai.us', pidMult: 20 }),
        gelbooru: new GelbooruSource({ name: 'gelbooru', domain: 'gelbooru.com', pidMult: 42 }),
        safebooru: new SafebooruSource({ name: 'safebooru', domain: 'safebooru.org', pidMult: 42 }), // <--- AÑADE ESTA LÍNEA
        };

    }

    // ==========================================
    // 🛠️ MÉTODO PARA UI DINÁMICA (PASO 1)
    // ==========================================
    getAvailableSources() {
        // Convierte el objeto de fuentes en una lista simplificada para el frontend
        return Object.entries(this.sources).map(([id, source]) => ({
            id: id,
            name: source.name.charAt(0).toUpperCase() + source.name.slice(1)
        }));
    }

    // ==========================================
    // 🚀 LÓGICA DE BÚSQUEDA
    // ==========================================
    async fetchPosts(tagName, selectedSources, page) {
        const browser = await BrowserManager.getInstance();
        let allPosts = [];

        for (const key of selectedSources) {
            const source = this.sources[key];
            if (source) {
                const posts = await source.fetchPosts(page, tagName, browser);
                allPosts.push(...posts);
            }
        }
        return allPosts;
    }

    // ==========================================
    // 📥 LÓGICA DE DESCARGA (MÉTODO ROBUSTO)
    // ==========================================
    async downloadImage(post, downloadDir) {
        // 1. CONVERTIMOS la ruta a ABSOLUTA para que curl no se pierda
        const absoluteDir = path.resolve(downloadDir);
        
        if (!fs.existsSync(absoluteDir)) {
            fs.mkdirSync(absoluteDir, { recursive: true });
        }

        const source = this.sources[post.source];
        const browser = await BrowserManager.getInstance();
        
        // 2. Resolver URL real
        const finalUrl = await source.resolveImageUrl(post.url, browser);
        if (!finalUrl) return { success: false, message: "No real image found" };

        // 3. Crear ruta temporal ABSOLUTA
        const tempPath = path.join(absoluteDir, `temp_${Date.now()}.tmp`);

        return new Promise((resolve) => {
            const referers = { 
                rule34: 'https://rule34.xxx/', 
                danbooru: 'https://danbooru.donmai.us/', 
                gelbooru: 'https://gelbooru.com/' 
            };
            const ref = referers[post.source] || 'https://google.com';
            
            // Argumentos EXACTOS del método original
            const args = ['-s', '-L', '-o', tempPath, '-H', `Referer: ${ref}`, finalUrl];
            
            const proc = spawn('curl', args);

            proc.on('close', async (code) => {
                if (code !== 0 || !fs.existsSync(tempPath)) {
                    console.error(`[SISTEMA] Curl falló con código ${code} en ruta ${tempPath}`);
                    resolve({ success: false, message: `Curl error ${code}` });
                    return;
                }

                try {
                    // Lógica de hashes
                    const buffer = fs.readFileSync(tempPath);
                    const exactHash = await HashService.calculateExactHash(buffer);
                    const visualHash = await HashService.calculateVisualHash(buffer);

                    if (this.logManager.isDuplicate(exactHash, visualHash)) {
                        fs.unlinkSync(tempPath);
                        resolve({ success: false, message: "Duplicate" });
                        return;
                    }

                    // Renombrado final
                    const cleanUrl = finalUrl.split('?')[0];
                    const ext = path.extname(cleanUrl) || '.jpg';
                    const fileName = `${post.source}_${post.id}${ext}`;
                    const fullPath = path.join(absoluteDir, fileName);
                    
                    fs.renameSync(tempPath, fullPath);
                    this.logManager.save(exactHash, visualHash);
                    
                    resolve({ success: true, filePath: fullPath });
                } catch (e) {
                    console.error(`[SISTEMA] Error procesando archivo: ${e.message}`);
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    resolve({ success: false, message: e.message });
                }
            });
        });
    }
}
