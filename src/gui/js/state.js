// src/gui/js/state.js

export const state = {
    // 📊 Datos
    posts: [],
    tagName: '',
    currentPage: 1,
    selectedSources: [],
    downloadPath: './downloads',
    isDownloading: false,

    // ⚙️ Métodos para modificar los datos
    setPosts(newPosts) {
        console.log(`[State] Actualizando posts. Cantidad: ${newPosts.length}`);
        this.posts = newPosts;
    },

    updateSearch(tag, page, sources) {
        console.log(`[State] Actualizando búsqueda: ${tag} | Pág: ${page}`);
        this.tagName = tag;
        this.currentPage = page;
        this.selectedSources = sources;
    },

    setDownloadPath(newPath) {
        console.log(`[State] Nueva ruta de descarga: ${newPath}`);
        this.downloadPath = newPath;
    }
};
