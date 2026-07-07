import { state } from './state.js';
import { ApiService } from './api.js';
import { GridUI } from './ui/grid.js';

// ==========================================
// 🖼️ ELEMENTOS DEL DOM
// ==========================================
const dom = {
    btnSearch: document.getElementById('btnSearch'),
    btnDownloadPage: document.getElementById('btnDownloadPage'),
    btnDownloadUntil: document.getElementById('btnDownloadUntil'),
    btnClearLogs: document.getElementById('btnClearLogs'),
    btnSelectFolder: document.getElementById('btnSelectFolder'),
    currentPathText: document.getElementById('currentPathText'),
    statusText: document.getElementById('statusText'),
    inputTag: document.getElementById('tagName'),
    inputPage: document.getElementById('pageNumber'),
    inputUntilPage: document.getElementById('untilPage'),
    filtersContainer: document.querySelector('.filters'),
    
    // Referencias a los filtros avanzados
    denylistInput: document.getElementById('denylistInput'),
    categoryToggles: document.getElementById('categoryToggles'),
    
    // 🚀 Referencias para Autocompletado y API
    tagSuggestions: document.getElementById('tagSuggestions'),
    apiKey: document.getElementById('apiKey'), // <--- AÑADIDO: Input de la API Key
};

// ==========================================
// 🛠️ FUNCIONES DE APOYO (UI)
// ==========================================
function updateStatus(msg, type = 'info') {
    dom.statusText.innerText = msg;
    dom.statusText.style.color = type === 'error' ? 'var(--danger)' : 'var(--success)';
}

function getSelectedSources() {
    const checks = document.querySelectorAll('.source-check');
    return Array.from(checks)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
}

function renderSourceFilters() {
    const pageControl = dom.filtersContainer.querySelector('.page-control');
    dom.filtersContainer.innerHTML = '';
    state.availableSources.forEach(source => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="source-check" value="${source.id}" checked> ${source.name}`;
        dom.filtersContainer.appendChild(label);
    });
    if (pageControl) dom.filtersContainer.appendChild(pageControl);
}

const SUGGESTED_CATEGORIES = ['highres', 'absurdres', 'official_art', 'cinematic', 'wallpaper'];

function renderCategories() {
    if (!dom.categoryToggles) return;
    dom.categoryToggles.innerHTML = '';

    SUGGESTED_CATEGORIES.forEach(cat => {
        const chip = document.createElement('div');
        chip.className = `chip ${state.categories.includes(cat) ? 'active' : ''}`;
        chip.innerText = cat;
        
        chip.onclick = () => {
            state.toggleCategory(cat);
            renderCategories();
        };
        dom.categoryToggles.appendChild(chip);
    });
}

// ==========================================
// 🚀 MANEJADORES DE EVENTOS (ORQUESTACIÓN)
// ==========================================

// --- 💡 Lógica de Autocompletado (Debounce) ---
let debounceTimer; 

dom.inputTag.addEventListener('input', async () => {
    const prefix = dom.inputTag.value.trim();
    
    clearTimeout(debounceTimer);
    
    if (prefix.length < 3) {
        dom.tagSuggestions.innerHTML = '';
        return;
    }

    debounceTimer = setTimeout(async () => {
        try {
            // 🚀 CORRECCIÓN: Enviamos un objeto con el prefijo y la API Key
            const suggestions = await ApiService.getSuggestions({ 
                prefix: prefix,
                apiKey: dom.apiKey ? dom.apiKey.value : '' 
            });
            
            console.log("🚀 Sugerencias recibidas en la UI:", suggestions);
            
            dom.tagSuggestions.innerHTML = '';
            if (suggestions && suggestions.length > 0) {
                suggestions.forEach(tag => {
                    const option = document.createElement('option');
                    option.value = tag;
                    dom.tagSuggestions.appendChild(option);
                });
            }
        } catch (e) {
            console.error("Error en autocompletado:", e);
        }
    }, 300);
});

// --- Búsqueda ---
dom.btnSearch.addEventListener('click', async () => {
    const tag = dom.inputTag.value;
    const page = parseInt(dom.inputPage.value);
    const sources = getSelectedSources();

    if (!tag) return alert("Escribe un nombre o tag");

    state.setDenylist(dom.denylistInput.value);

    updateStatus("🔍 Buscando imágenes...");
    dom.btnSearch.disabled = true;

    try {
        const posts = await ApiService.search({ 
            tag: tag, 
            sources: sources, 
            page: page, 
            categories: state.categories, 
            denylist: state.denylist 
        });
        
        state.setPosts(posts);
        state.updateSearch(tag, page, sources);
        GridUI.render(posts);
        
        updateStatus(posts.length > 0 
            ? `✅ Se encontraron ${posts.length} imágenes.` 
            : "😢 No se encontraron imágenes.");
            
    } catch (e) {
        console.error(e);
        updateStatus("❌ Error en la búsqueda", 'error');
    } finally {
        dom.btnSearch.disabled = false;
    }
});

dom.btnSelectFolder.addEventListener('click', async () => {
    try {
        const newPath = await ApiService.selectFolder();
        if (newPath) {
            state.setDownloadPath(newPath);
            dom.currentPathText.innerText = newPath;
            updateStatus(`✅ Ruta cambiada a: ${newPath}`);
        }
    } catch (e) {
        updateStatus("❌ Error al seleccionar carpeta", 'error');
    }
});

dom.btnDownloadPage.addEventListener('click', async () => {
    if (state.posts.length === 0) return alert("No hay imágenes");
    updateStatus("📦 Descargando página completa...");
    const res = await ApiService.downloadPage({ 
        posts: state.posts, 
        dir: state.downloadPath 
    });
    updateStatus(`✅ Completado: ${res.downloaded} bajadas.`);
});

dom.btnDownloadUntil.addEventListener('click', async () => {
    const tag = state.tagName;
    const startPage = state.currentPage;
    const endPage = parseInt(dom.inputUntilPage.value);
    const sources = state.selectedSources;

    if (!tag) return alert("Primero realiza una búsqueda");
    if (endPage < startPage) return alert("La página final debe ser mayor que la actual");

    updateStatus(`🚀 Iniciando descarga masiva...`);
    
    try {
        const res = await ApiService.downloadUntil({ 
            tag, 
            sources, 
            startPage, 
            endPage, 
            dir: state.downloadPath,
            categories: state.categories,
            denylist: state.denylist
        });
        updateStatus(`✅ Masivo terminado: ${res.downloaded} bajadas.`);
    } catch (e) {
        console.error("Error en la descarga masiva:", e);
        updateStatus("❌ Error en la descarga masiva", 'error');
    }
});

dom.btnClearLogs.addEventListener('click', async () => {
    if (!confirm("¿Estás seguro de borrar el historial de hashes?")) return;
    try {
        await ApiService.clearLogs();
        alert("Historial de hashes limpiado correctamente");
    } catch (e) {
        alert("Error al limpiar logs");
    }
});

// ==========================================
// 🏁 INICIALIZACIÓN
// ==========================================
async function init() {
    console.log("🌸 Waifu Grabber UI Initializing...");
    try {
        const sources = await ApiService.getSources();
        state.setAvailableSources(sources);
        renderSourceFilters();
        renderCategories();
        
        if (dom.currentPathText) {
            dom.currentPathText.innerText = state.downloadPath;
        }
        updateStatus("Listo para buscar");
    } catch (e) {
        console.error("Error en init:", e);
        updateStatus("❌ Error al iniciar la aplicación", 'error');
    }
}

init();
