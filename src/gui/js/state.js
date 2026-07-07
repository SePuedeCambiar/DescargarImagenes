// src/gui/js/state.js

export const state = {
    // 📊 Datos
    posts: [],
    tagName: '',
    currentPage: 1,
    selectedSources: [],
    availableSources: [], // <--- NUEVO: Aquí guardamos la lista de fuentes que vienen del backend
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
    },

    // NUEVO: Método para guardar las fuentes disponibles detectadas por el Engine
    setAvailableSources(sources) {
        console.log(`[State] Cargando ${sources.length} fuentes disponibles.`);
        this.availableSources = sources;
    }
};
