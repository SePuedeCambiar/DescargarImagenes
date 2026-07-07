// src/gui/js/state.js

export const state = {
    // 📊 Datos Generales
    posts: [],
    tagName: '',
    currentPage: 1,
    selectedSources: [],
    availableSources: [], 
    downloadPath: './downloads',
    isDownloading: false,

    // 🛠️ Filtros Avanzados (Módulo B)
    denylist: '',        // Ejemplo: "blur, lowres, watermark"
    categories: [],      // Ejemplo: ["highres", "absurdres"]

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

    setAvailableSources(sources) {
        console.log(`[State] Cargando ${sources.length} fuentes disponibles.`);
        this.availableSources = sources;
    },

    // --- MÉTODOS DEL MÓDULO B ---

    // Guarda la lista de tags prohibidos
    setDenylist(list) {
        console.log(`[State] Denylist actualizada: ${list}`);
        this.denylist = list;
    },

    // Activa o desactiva una categoría (Toggle)
    toggleCategory(category) {
        if (this.categories.includes(category)) {
            // Si ya existe, la quitamos
            this.categories = this.categories.filter(cat => cat !== category);
            console.log(`[State] Categoría desactivada: ${category}`);
        } else {
            // Si no existe, la añadimos
            this.categories.push(category);
            console.log(`[State] Categoría activada: ${category}`);
        }
    }
};
