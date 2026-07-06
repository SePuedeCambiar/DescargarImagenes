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
    btnSelectFolder: document.getElementById('btnSelectFolder'), // Nuevo
    currentPathText: document.getElementById('currentPathText'), // Nuevo
    statusText: document.getElementById('statusText'),
    inputTag: document.getElementById('tagName'),
    inputPage: document.getElementById('pageNumber'),
    inputUntilPage: document.getElementById('untilPage'),
    sourceChecks: document.querySelectorAll('.source-check'),
};

// ==========================================
// 🛠️ FUNCIONES DE APOYO (UI)
// ==========================================
function updateStatus(msg, type = 'info') {
    dom.statusText.innerText = msg;
    dom.statusText.style.color = type === 'error' ? 'var(--danger)' : 'var(--success)';
}

function getSelectedSources() {
    return Array.from(dom.sourceChecks)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
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
    
    // ✅ CORRECTO: Pasamos un objeto con posts y dir
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
        // PASAMOS LA RUTA DESDE EL STATE
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
function init() {
    console.log("🌸 Waifu Grabber UI Initialized");
    
    // Seteamos la ruta inicial en el texto de la UI
    if (dom.currentPathText) {
        dom.currentPathText.innerText = state.downloadPath;
    }
    
    updateStatus("Listo para buscar");
}

init();
