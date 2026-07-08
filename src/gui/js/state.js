// src/gui/js/state.js

export const state = {
    // 📊 Datos Generales (Volátiles - No se guardan en config.json)
    posts: [],
    tagName: '',
    currentPage: 1,
    availableSources: [], 
    isDownloading: false,

    // ⚙️ Configuración Persistente (Se guardan en config.json)
    selectedSources: [],
    downloadPath: './downloads',
    apiKey: '',             // <--- AÑADIDO: Para persistir la API Key de Danbooru
    denylist: '',           // Ejemplo: "blur, lowres, watermark"
    categories: [],         // Ejemplo: ["highres", "absurdres"]

    // =========================================================================
    // 💾 MÉTODOS DE PERSISTENCIA
    // =========================================================================

    /**
     * Carga los datos desde el objeto de configuración recibido del Backend
     * @param {Object} config 
     */
    loadConfig(config) {
        console.log("[State] Hidratando estado desde configuración persistente...");
        this.downloadPath = config.downloadPath || this.downloadPath;
        this.apiKey = config.apiKey || '';
        this.denylist = config.denylist || '';
        this.categories = config.categories || [];
        this.selectedSources = config.selectedSources || [];
    },

    /**
     * Devuelve un objeto limpio con solo los datos que deben persistirse en disco
     */
    getConfig() {
        return {
            downloadPath: this.downloadPath,
            apiKey: this.apiKey,
            denylist: this.denylist,
            categories: this.categories,
            selectedSources: this.selectedSources
        };
    },

    // =========================================================================
    // ⚙️ MÉTODOS DE ACTUALIZACIÓN (Setters)
    // =========================================================================

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

    setAvailableSources(sources) {
        console.log(`[State] Cargando ${sources.length} fuentes disponibles.`);
        this.availableSources = sources;
    },

    // --- MÉTODOS DE FILTROS (MÓDULO B) ---

    setDenylist(list) {
        console.log(`[State] Denylist actualizada: ${list}`);
        this.denylist = list;
    },

    toggleCategory(category) {
        if (this.categories.includes(category)) {
            this.categories = this.categories.filter(cat => cat !== category);
            console.log(`[State] Categoría desactivada: ${category}`);
        } else {
            this.categories.push(category);
            console.log(`[State] Categoría activada: ${category}`);
        }
    }
};
