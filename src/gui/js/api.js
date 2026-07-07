// src/gui/js/api.js
export const ApiService = {
    // 🚀 CORRECCIÓN: Ahora acepta un objeto 'params' en lugar de argumentos sueltos
    async search(params) {
        // Pasamos el objeto tal cual llega desde el main.js (GUI)
        return await window.api.searchImages(params);
    },

    async downloadSingle({ post, dir }) {
        return await window.api.downloadSingle({ post, dir });
    },

    async downloadPage({ posts, dir }) {
        return await window.api.downloadPage({ posts, dir });
    },

    async downloadUntil(params) {
        // Pasamos el objeto params completo (incluye tag, sources, startPage, endPage, dir, etc.)
        return await window.api.downloadUntilPage(params);
    },

    async selectFolder() {
        return await window.api.selectFolder();
    },

    async getSources() {
        return await window.api.getSources();
    },

    async getSuggestions(params) {
    return await window.api.getSuggestions(params);
    },

};
