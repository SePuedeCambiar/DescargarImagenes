import BaseSource from './BaseSource.js';

export default class DanbooruSource extends BaseSource {
    async getPostCounts(tagName) {
        try {
            const url = `https://danbooru.donmai.us/counts/posts.json?tags=${encodeURIComponent(tagName)}`;
            const res = await fetch(url);
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
        // Danbooru suele dar la URL directa en el JSON, pero si no:
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
