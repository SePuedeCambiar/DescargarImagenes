// src/gui/js/api.js
export const ApiService = {
    async search(tag, sources, page) {
        return await window.api.searchImages({ tag, sources, page });
    },
   async downloadSingle({ post, dir }) {
        return await window.api.downloadSingle({ post, dir });
    },
    async downloadPage({ posts, dir }) {
        return await window.api.downloadPage({ posts, dir });
    },
    async downloadUntil({ tag, sources, startPage, endPage, dir }) {
        return await window.api.downloadUntilPage({ 
            tag, sources, startPage, endPage, dir 
        });
    },
    async selectFolder() {
        return await window.api.selectFolder();
    },
};