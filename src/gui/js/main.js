import { state } from './state.js';
import { ApiService } from './api.js';
import { GridUI } from './ui/grid.js';

// ==========================================
// 🖼️ ELEMENTOS DEL DOM
// ==========================================
const dom = {
    btnToggleControls: document.getElementById('btnToggleControls'), // Nuevos controles colapsables
    controlsWrapper: document.getElementById('controlsWrapper'),     // Nuevos controles colapsables
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
    denylistInput: document.getElementById('denylistInput'),
    categoryToggles: document.getElementById('categoryToggles'),
    tagSuggestions: document.getElementById('tagSuggestions'),
    apiKey: document.getElementById('apiKey'), 
};

// 🖼️ Elementos del Lightbox
const lbDom = {
    container: document.getElementById('lightbox'),
    img: document.getElementById('lightboxImg'),
    close: document.getElementById('closeLightbox'),
    prev: document.getElementById('btnPrev'),
    next: document.getElementById('btnNext'),
    slideshow: document.getElementById('btnSlideshow'),
    interval: document.getElementById('slideshowInterval'),
    counter: document.getElementById('lightboxCounter')
};

// ==========================================
// ⚙️ ESTADO DEL VISOR (Lightbox)
// ==========================================
let currentImageIndex = 0;
let slideshowTimer = null;

// ==========================================
// 🛠️ FUNCIONES DE APOYO (UI)
// ==========================================
function updateStatus(msg, type = 'info') {
    dom.statusText.innerText = msg;
    dom.statusText.style.color = type === 'error' ? 'var(--danger)' : 'var(--success)';
}

async function persistSettings() {
    try {
        await ApiService.saveConfig(state.getConfig());
        console.log("[UI] Configuración guardada.");
    } catch (e) {
        console.error("Error guardando configuración:", e);
    }
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
        const isChecked = state.selectedSources.includes(source.id) || state.selectedSources.length === 0;
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" class="source-check" value="${source.id}" ${isChecked ? 'checked' : ''}> ${source.name}`;
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
        
        chip.onclick = async () => {
            state.toggleCategory(cat);
            renderCategories();
            await persistSettings();
        };
        dom.categoryToggles.appendChild(chip);
    });
}

// ==========================================
// 🖼️ LÓGICA DEL LIGHTBOX Y SLIDESHOW
// ==========================================
function openLightbox(index) {
    currentImageIndex = index;
    updateLightboxImage();
    lbDom.container.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; 
}

// Exponemos la función al window para que grid.js pueda llamarla
window.openLightbox = openLightbox; 

function updateLightboxImage() {
    const post = state.posts[currentImageIndex];
    if (!post) return;
    lbDom.img.src = post.url;
    lbDom.counter.innerText = `${currentImageIndex + 1} / ${state.posts.length}`;
}

function nextImage() {
    currentImageIndex = (currentImageIndex + 1) % state.posts.length;
    updateLightboxImage();
}

function prevImage() {
    currentImageIndex = (currentImageIndex - 1 + state.posts.length) % state.posts.length;
    updateLightboxImage();
}

function toggleSlideshow() {
    if (slideshowTimer) {
        clearInterval(slideshowTimer);
        slideshowTimer = null;
        lbDom.slideshow.innerText = "▶️ Auto";
        lbDom.slideshow.classList.replace('btn-danger', 'btn-secondary');
    } else {
        const seconds = parseInt(lbDom.interval.value) || 3;
        slideshowTimer = setInterval(nextImage, seconds * 1000);
        lbDom.slideshow.innerText = "⏹️ Stop";
        lbDom.slideshow.classList.replace('btn-secondary', 'btn-danger');
    }
}

// Eventos del Lightbox
lbDom.close.onclick = () => {
    lbDom.container.classList.add('hidden');
    if (slideshowTimer) toggleSlideshow();
    document.body.style.overflow = 'auto';
};
lbDom.next.onclick = nextImage;
lbDom.prev.onclick = prevImage;
lbDom.slideshow.onclick = toggleSlideshow;

// Teclado
window.addEventListener('keydown', (e) => {
    if (lbDom.container.classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'Escape') lbDom.close.onclick();
});

// ==========================================
// 🚀 MANEJADORES DE EVENTOS (ORQUESTACIÓN)
// ==========================================

// Alternar visibilidad de los filtros manualmente
if (dom.btnToggleControls && dom.controlsWrapper) {
    dom.btnToggleControls.addEventListener('click', () => {
        dom.controlsWrapper.classList.toggle('collapsed');
        if (dom.controlsWrapper.classList.contains('collapsed')) {
            dom.btnToggleControls.textContent = '⚙️ Mostrar Filtros';
        } else {
            dom.btnToggleControls.textContent = '⚙️ Filtros y Opciones';
        }
    });
}

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
            const suggestions = await ApiService.getSuggestions({ 
                prefix: prefix,
                apiKey: dom.apiKey ? dom.apiKey.value : state.apiKey 
            });
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
        
        // 1. Guardamos los posts en el estado
        state.setPosts(posts);
        
        // 2. Guardamos los parámetros actuales
        state.updateSearch(tag, page, sources);
        
        // 3. Renderizamos
        GridUI.render(posts); 
        
        updateStatus(posts.length > 0 
            ? `✅ Se encontraron ${posts.length} imágenes.` 
            : "😢 No se encontraron imágenes.");

        // Ocultar el panel de control tras una búsqueda exitosa para mejorar la visibilidad
        if (posts.length > 0 && dom.controlsWrapper) {
            dom.controlsWrapper.classList.add('collapsed');
            if (dom.btnToggleControls) {
                dom.btnToggleControls.textContent = '⚙️ Mostrar Filtros';
            }
        }
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
            await persistSettings();
            updateStatus(`✅ Ruta cambiada a: ${newPath}`);
        }
    } catch (e) {
        updateStatus("❌ Error al seleccionar carpeta", 'error');
    }
});

dom.apiKey.addEventListener('blur', async () => {
    state.apiKey = dom.apiKey.value;
    await persistSettings();
});

dom.denylistInput.addEventListener('blur', async () => {
    state.setDenylist(dom.denylistInput.value);
    await persistSettings();
});

dom.btnDownloadPage.addEventListener('click', async () => {
    if (state.posts.length === 0) return alert("No hay imágenes");
    updateStatus("📦 Descargando página completa...");
    const res = await ApiService.downloadPage({ posts: state.posts, dir: state.downloadPath });
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
            tag, sources, startPage, endPage, dir: state.downloadPath, categories: state.categories, denylist: state.denylist
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

async function init() {
    console.log("🌸 Waifu Grabber UI Initializing...");
    try {
        const config = await ApiService.getConfig();
        state.loadConfig(config);
        if (dom.currentPathText) dom.currentPathText.innerText = state.downloadPath;
        if (dom.denylistInput) dom.denylistInput.value = state.denylist;
        if (dom.apiKey) dom.apiKey.value = state.apiKey;
        const sources = await ApiService.getSources();
        state.setAvailableSources(sources);
        renderSourceFilters();
        renderCategories();
        updateStatus("Listo para buscar");
    } catch (e) {
        console.error("Error en init:", e);
        updateStatus("❌ Error al iniciar la aplicación", 'error');
    }
}

init();