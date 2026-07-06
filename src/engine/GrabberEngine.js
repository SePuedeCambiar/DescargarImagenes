import fs from 'fs';
import path from 'path';

import BrowserManager from './core/BrowserManager.js';
import LogManager from './core/LogManager.js';
import HashService from './services/HashService.js';
import DownloadService from './services/DownloadService.js';
import Rule34Source from './sources/Rule34Source.js';
import DanbooruSource from './sources/DanbooruSource.js';
import GelbooruSource from './sources/GelbooruSource.js';

export default class WaifuGrabberEngine {
    constructor() {
        this.logManager = new LogManager();
        // Registramos las fuentes disponibles
        this.sources = {
            rule34: new Rule34Source({ name: 'rule34', domain: 'rule34.xxx', pidMult: 42 }),
            danbooru: new DanbooruSource({ name: 'danbooru', domain: 'danbooru.donmai.us', pidMult: 20 }),
            gelbooru: new GelbooruSource({ name: 'gelbooru', domain: 'gelbooru.com', pidMult: 42 }),
        };
    }

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

    async downloadImage(post, downloadDir) {
        const source = this.sources[post.source];
        const browser = await BrowserManager.getInstance();
        
        // 1. Resolver URL real
        const finalUrl = await source.resolveImageUrl(post.url, browser);
        
        // 2. Descarga temporal
        const tempPath = path.join(downloadDir, `temp_${Date.now()}.tmp`);
        await DownloadService.download(finalUrl, source.domain, tempPath);
        
        // 3. Verificación de duplicados
        const buffer = fs.readFileSync(tempPath);
        const eHash = await HashService.calculateExactHash(buffer);
        const vHash = await HashService.calculateVisualHash(buffer);

        if (this.logManager.isDuplicate(eHash, vHash)) {
            fs.unlinkSync(tempPath);
            return { success: false, message: "Duplicate" };
        }

        // 4. Guardado final
        // ... lógica de renombrado ...
        this.logManager.save(eHash, vHash);
        return { success: true };
    }
}
