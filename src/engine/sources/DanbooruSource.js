import BaseSource from './BaseSource.js';

export default class DanbooruSource extends BaseSource {
    static config = { 
        name: 'danbooru', 
        domain: 'danbooru.donmai.us', 
        pidMult: 42 
    };

    // 🔍 AUTOCOMPLETADO: Usando fetch interno para evitar bloqueos
    async getSuggestedTags(prefix, browser) {
        const page = await browser.newPage();
        try {
            const url = `https://danbooru.donmai.us/tags.json?search[name_start]=${encodeURIComponent(prefix)}`;
            const data = await page.evaluate(async (targetUrl) => {
                try {
                    const response = await fetch(targetUrl);
                    if (!response.ok) return null;
                    return await response.json();
                } catch (e) { return null; }
            }, url);
            
            if (Array.isArray(data)) {
                return data.slice(0, 10).map(tag => tag.name);
            }
            return [];
        } catch (e) {
            console.error(`[Autocomplete] Error: ${e.message}`);
            return [];
        } finally {
            await page.close();
        }
    }

    // 📊 CONTEO DE POSTS
    async getPostCounts(tagName, browser) {
        const page = await browser.newPage();
        try {
            const url = `https://danbooru.donmai.us/counts/posts.json?tags=${encodeURIComponent(tagName)}`;
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
            const data = await page.evaluate(() => {
                try {
                    return JSON.parse(document.body.innerText);
                } catch(e) { return null; }
            });
            const total = data?.counts?.posts || 0;
            return { total, maxPage: Math.ceil(total / 42) };
        } catch (e) {
            return { total: 0, maxPage: 1 };
        } finally {
            await page.close();
        }
    }

    // 🚀 BÚSQUEDA de posts
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

    // 🖼️ RESOLUCIÓN de Imagen (Copia exacta de la lógica de nsfw.js)
    async resolveImageUrl(postUrl, browser) {
    if (!postUrl || typeof postUrl !== 'string') return null;

    // Si ya es un link directo a imagen, no gastamos recursos de navegador
    if (postUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return postUrl;

    const page = await browser.newPage();
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        // 1. Cargamos la página SIN bloquear recursos (para parecer humanos)
        await page.goto(postUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
        });

        // 2. ESPERA CRÍTICA: Damos tiempo a que el JS de la web renderice los links
        await new Promise(r => setTimeout(r, 2000));

        // 3. Extracción simplificada y efectiva
        const finalUrl = await page.evaluate(() => {
            // Prioridad 1: Link a la imagen original
            const l = document.querySelector('#post-option-view-original a, a.image-view-original-link');
            if (l && l.href) return l.href;
            
            // Prioridad 2: Meta tag og:image
            const og = document.querySelector('meta[property="og:image"]');
            if (og && og.content) return og.content;
            
            // Prioridad 3: Elemento imagen
            const i = document.querySelector('#image');
            if (i && i.src) return i.src;
            
            return null;
        });

        return finalUrl;
    } catch (e) {
        console.error(`[Danbooru Resolve] Error: ${e.message}`);
        return null;
    } finally {
        await page.close();
    }
}


}
