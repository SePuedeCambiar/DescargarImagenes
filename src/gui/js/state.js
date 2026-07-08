// src/gui/js/state.js

export const state = {
    // 📊 Datos Generales (Volátiles)
    posts: [],
    tagName: '',
    currentPage: 1,
    availableSources: [], 
    isDownloading: false,
    displayedCount: 0,      // Controla cuántas imágenes se han dibujado en el grid

    // 🚀 NUEVO: Memoria de la última búsqueda
    // Esto permite que el "Cargar más" sepa qué filtros usar para la página siguiente
    lastSearchParams: {
        tag: '',
        sources: [],
        categories: [],
        denylist: ''
    },

    // ⚙️ Configuración Persistente (Se guardan en config.json)
    selectedSources: [],
    downloadPath: './downloads',
    apiKey: '',
    denylist: '',
    categories: [],

    // =========================================================================
    // 💾 MÉTODOS DE PERSISTENCIA
    // =========================================================================

    loadConfig(config) {
        console.log("[State] Hidratando estado desde configuración persistente...");
        this.downloadPath = config.downloadPath || this.downloadPath;
        this.apiKey = config.apiKey || '';
        this.denylist = config.denylist || '';
        this.categories = config.categories || [];
        this.selectedSources = config.selectedSources || [];
    },

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
        this.displayedCount = 0; // Resetear el contador al recibir nuevos resultados
    },

    // Método para incrementar el contador de lo que ya se ve en pantalla
    addDisplayedCount(amount) {
        this.displayedCount += amount;
    },

    updateSearch(tag, page, sources) {
        console.log(`[State] Actualizando búsqueda: ${tag} | Pág: ${page}`);
        this.tagName = tag;
        this.currentPage = page;
        this.selectedSources = sources;

        // 🚀 ACTUALIZACIÓN CRÍTICA: Guardamos los parámetros actuales
        // Así, cuando GridUI pida la página siguiente, usará estos datos
        this.lastSearchParams = {
            tag: tag,
            sources: sources,
            categories: this.categories,
            denylist: this.denylist
        };
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
