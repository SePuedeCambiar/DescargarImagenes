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
    filtersContainer: document.querySelector('.filters'), // Contenedor para checkboxes dinámicos
};

// ==========================================
// 🛠️ FUNCIONES DE APOYO (UI)
// ==========================================
function updateStatus(msg, type = 'info') {
    dom.statusText.innerText = msg;
    dom.statusText.style.color = type === 'error' ? 'var(--danger)' : 'var(--success)';
}

// Buscamos los checks en el momento exacto del click, ya que son dinámicos
function getSelectedSources() {
    const checks = document.querySelectorAll('.source-check');
    return Array.from(checks)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
}

// 🎨 Dibuja los checkboxes basándose en las fuentes disponibles en el backend
function renderSourceFilters() {
    // Guardamos la referencia al control de página para no borrarlo
    const pageControl = dom.filtersContainer.querySelector('.page-control');
    
    // Limpiamos el contenedor de filtros
    dom.filtersContainer.innerHTML = '';

    // Creamos un checkbox por cada fuente disponible en el estado
    state.availableSources.forEach(source => {
        const label = document.createElement('label');
        label.innerHTML = `
            <input type="checkbox" class="source-check" value="${source.id}" checked> 
            ${source.name}
        `;
        dom.filtersContainer.appendChild(label);
    });

    // Volvemos a añadir el control de página al final
    if (pageControl) {
        dom.filtersContainer.appendChild(pageControl);
    }
}

// ==========================================
// 🚀 MANEJADORES DE EVENTOS (ORQUESTACIÓN)
// ==========================================

// 1. Acción de Búsqueda
dom.btnSearch.addEventListener('click', async () => {
    const tag = dom.inputTag.value;
    const page = parseInt(dom.inputPage.value);
    const sources = getSelectedSources();

    if (!tag) return alert("Escribe un nombre o tag");

    updateStatus("🔍 Buscando imágenes...");
    dom.btnSearch.disabled = true;

    try {
        const posts = await ApiService.search(tag, sources, page);
        
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

// 2. Acción: Seleccionar Carpeta de Descarga
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

// 3. Acción: Descargar Página Actual
dom.btnDownloadPage.addEventListener('click', async () => {
    if (state.posts.length === 0) return alert("No hay imágenes");

    updateStatus("📦 Descargando página completa...");
    
    const res = await ApiService.downloadPage({ 
        posts: state.posts, 
        dir: state.downloadPath 
    });
    
    updateStatus(`✅ Completado: ${res.downloaded} bajadas.`);
});

// 4. Acción: Descarga Masiva hasta Página X
dom.btnDownloadUntil.addEventListener('click', async () => {
    const tag = state.tagName;
    const startPage = state.currentPage;
    const endPage = parseInt(dom.inputUntilPage.value);
    const sources = state.selectedSources;

    if (!tag) return alert("Primero realiza una búsqueda");
    if (endPage < startPage) return alert("La página final debe ser mayor que la actual");

    updateStatus(`🚀 Iniciando descarga masiva hasta la pág ${endPage}...`);
    
    try {
        const res = await ApiService.downloadUntil({ 
            tag, 
            sources, 
            startPage, 
            endPage, 
            dir: state.downloadPath 
        });
        updateStatus(`✅ Masivo terminado: ${res.downloaded} bajadas, ${res.skipped} repetidas.`);
    } catch (e) {
        updateStatus("❌ Error en la descarga masiva", 'error');
    }
});

// 5. Acción: Limpiar Logs
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
        // 1. Carga dinámica de fuentes desde el Backend
        const sources = await ApiService.getSources();
        state.setAvailableSources(sources);
        renderSourceFilters();
        
        // 2. Configuración de ruta inicial
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
