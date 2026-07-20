// src/gui/js/api.js
export const ApiService = {
    // 🚀 Búsqueda
    async search(params) {
        return await window.api.searchImages(params);
    },

    // 🖼️ RESOLUCIÓN DE URLS (NUEVO)
    // Este método permite obtener el link directo a la imagen 
    // cuando la URL del post es una página HTML (Safebooru, Gelbooru, etc.)
    async resolveUrl({ post }) {
        return await window.api.resolveImageUrl({ post });
    },

    // 📥 Descargas
    async downloadSingle({ post, dir }) {
        return await window.api.downloadSingle({ post, dir });
    },

    async downloadPage({ posts, dir }) {
        return await window.api.downloadPage({ posts, dir });
    },

    async downloadUntil(params) {
        return await window.api.downloadUntilPage(params);
    },

    // 📁 Sistema y Fuentes
    async selectFolder() {
        return await window.api.selectFolder();
    },

    async getSources() {
        return await window.api.getSources();
    },

    async getSuggestions(params) {
        return await window.api.getSuggestions(params);
    },

    async clearLogs() {
        return await window.api.clearLogs();
    },

    // ⚙️ CONFIGURACIÓN PERSISTENTE
    async getConfig() {
        return await window.api.getConfig();
    },

    async saveConfig(config) {
        return await window.api.saveConfig(config);
    },
};