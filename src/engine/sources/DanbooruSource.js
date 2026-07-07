import BaseSource from './BaseSource.js';
import fs from 'fs';
import path from 'path';

export default class DanbooruSource extends BaseSource {
    // 🚨 CONFIGURACIÓN AUTOMÁTICA
    static config = { 
        name: 'danbooru', 
        domain: 'danbooru.donmai.us', 
        pidMult: 42 
    };

    static COMMON_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    };

    // 🔍 AUTOCOMPLETADO: Implementación corregida y blindada
    async getSuggestedTags(prefix, browser) {
        const page = await browser.newPage();
        try {
            // Usamos 'name_start' para que el datalist de HTML muestre las sugerencias
            const url = `https://danbooru.donmai.us/tags.json?search[name_start]=${encodeURIComponent(prefix)}`;
            
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
            
            const content = await page.evaluate(() => document.body.innerText);
            
            try {
                const data = JSON.parse(content);
                if (Array.isArray(data)) {
                    return data.slice(0, 10).map(tag => tag.name);
                }
            } catch (e) {
                console.error(`[Autocomplete] Error parseando JSON: ${e.message}`);
            }
            return [];
        } catch (e) {
            console.error(`[Autocomplete] Error de red en Danbooru: ${e.message}`);
            return [];
        } finally {
            await page.close();
        }
    }

    // 📊 CONTEO DE POSTS: Corregido la URL y el parámetro
    async getPostCounts(tagName) {
        try {
            // URL CORRECTA para conteo, usando tagName
            const url = `https://danbooru.donmai.us/counts/posts.json?tags=${encodeURIComponent(tagName)}`;
            
            const res = await fetch(url, { headers: DanbooruSource.COMMON_HEADERS });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            const total = data.counts?.posts || 0;
            return { total, maxPage: Math.ceil(total / 42) };
        } catch (e) {
            console.error(`[Counter] Error en danbooru: ${e.message}`);
            return { total: 0, maxPage: 1 };
        }
    }

    async fetchPosts(page, tagName, browser) {
        const pageObj = await browser.newPage();
        try {
            await pageObj.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            const apiUrl = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tagName)}&page=${page}&limit=42`;
            
            const apiData = await pageObj.evaluate(async (url) => {
                try {
                    const res = await fetch(url);
                    return await res.json();
                } catch (e) { return null; }
            }, apiUrl);

            if (apiData && Array.isArray(apiData)) {
                return apiData.map(p => ({
                    id: p.id,
                    source: 'danbooru',
                    url: p.file_url || p.large_file_url || p.url,
                    preview: p.preview_file_url || p.preview_url,
                    isDirect: !!p.file_url
                }));
            }
            return [];
        } finally {
            await pageObj.close();
        }
    }

    async resolveImageUrl(postUrl, browser) {
        const page = await browser.newPage();
        try {
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
            return await page.evaluate(() => {
                const i = document.querySelector('#image');
                if (i && i.src) return i.src;
                return null;
            });
        } finally {
            await page.close();
        }
    }
}
