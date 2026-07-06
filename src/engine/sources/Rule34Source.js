import BaseSource from './BaseSource.js';

export default class Rule34Source extends BaseSource {
    async getPostCounts(tagName, browser) {
        const page = await browser.newPage();
        try {
            const url = `https://${this.domain}/index.php?page=post&s=list&tags=${encodeURIComponent(tagName)}`;
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
            const total = await page.evaluate(() => {
                const text = document.body.innerText;
                const match = text.match(/([\d,]+)\s+posts?\s+found/i);
                return match ? parseInt(match[1].replace(/,/g, '')) : 0;
            });
            return { total, maxPage: Math.ceil(total / this.pidMult) };
        } catch (e) {
            console.error(`[Counter] Error en rule34: ${e.message}`);
            return { total: 0, maxPage: 1 };
        } finally {
            await page.close();
        }
    }

    async fetchPosts(page, tagName, browser) {
        const pageObj = await browser.newPage();
        try {
            await pageObj.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
            const url = `https://${this.domain}/index.php?page=post&s=list&tags=${encodeURIComponent(tagName)}&pid=${(page - 1) * this.pidMult}`;
            await pageObj.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            
            return await pageObj.evaluate((sourceName) => {
                const selector = '.thumb';
                const elements = Array.from(document.querySelectorAll(selector));
                return elements.map(el => {
                    const a = el.querySelector('a');
                    const img = el.querySelector('img');
                    if (!a) return null;
                    const match = a.href.match(/id=(\d+)/);
                    return { 
                        id: match ? match[1] : null, 
                        source: sourceName, 
                        url: a.href, 
                        preview: img ? img.src : null, 
                        isDirect: false 
                    };
                }).filter(p => p && p.id);
            }, this.name);
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
                const l = document.querySelector('a[href*="/images/"]');
                if (l && l.href) return l.href;
                return null;
            });
        } finally {
            await page.close();
        }
    }
}
