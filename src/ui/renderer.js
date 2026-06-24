let currentPosts = [];

// Elementos DOM
const btnSearch = document.getElementById('btnSearch');
const btnDownloadPage = document.getElementById('btnDownloadPage');
const btnDownloadUntil = document.getElementById('btnDownloadUntil');
const btnClearLogs = document.getElementById('btnClearLogs');
const resultsGrid = document.getElementById('resultsGrid');
const statusText = document.getElementById('statusText');
const globalControls = document.getElementById('globalControls');

// Función para enviar logs a la terminal de Node.js
function logToTerminal(msg) {
    console.log(msg); 
    if (window.api && window.api.sendLog) {
        window.api.sendLog(msg);
    }
}

function renderGrid(posts) {
    logToTerminal(`Rendiendo grid con ${posts.length} imágenes...`);
    resultsGrid.innerHTML = ''; 
    currentPosts = posts;

    if (posts.length === 0) {
        resultsGrid.innerHTML = '<div class="placeholder-text">No se encontraron imágenes...</div>';
        return;
    }

    posts.forEach((post, index) => {
        const card = document.createElement('div');
        card.className = 'image-card';
        
        const img = document.createElement('img');
        
        // TRUCO MAESTRO: Usamos la URL directa pero SIN referer
        // Esto salta el bloqueo de la mayoría de las Boorus
        img.src = post.preview; 
        img.loading = 'lazy';
        img.referrerPolicy = 'no-referrer'; // <--- ESTO ES LO QUE SOLUCIONA EL BLOQUEO
        
        img.onload = () => {
            // Imagen cargada con éxito
        };

        img.onerror = () => {
            // IMPORTANTE: Desactivamos el onerror para evitar el parpadeo/bucle infinito
            img.onerror = null; 
            logToTerminal(`❌ Error final cargando imagen ${index}: ${post.preview}`);
            img.src = 'https://via.placeholder.com/200x200?text=No+Preview';
        };

        const info = document.createElement('div');
        info.className = 'card-info';
        info.innerHTML = `
            <span class="source-badge">${post.source}</span>
            <button class="btn-dl-small" onclick="downloadOne('${post.id}', '${post.source}', '${post.url}')">Descargar</button>
        `;

        card.appendChild(img);
        card.appendChild(info);
        resultsGrid.appendChild(card);
    });

    globalControls.classList.remove('hidden');
}


async function downloadOne(post) {
    statusText.innerText = `📥 Descargando ${post.id}...`;
    logToTerminal(`Iniciando descarga de ${post.id}...`);
    const res = await window.api.downloadSingle({ post, dir: './downloads' });
    statusText.innerText = res.success ? `✅ Guardado: ${post.id}` : `❌ ${res.message}`;
    logToTerminal(`Resultado descarga ${post.id}: ${res.success ? 'Éxito' : 'Fallo - ' + res.message}`);
}

btnSearch.addEventListener('click', async () => {
    const tag = document.getElementById('tagName').value;
    const page = parseInt(document.getElementById('pageNumber').value);
    const selectedSources = Array.from(document.querySelectorAll('.source-check:checked')).map(cb => cb.value);

    if (!tag) return alert("Escribe un nombre");

    logToTerminal(`[UI] Buscando: ${tag} | Pág: ${page} | Fuentes: ${selectedSources}`);
    statusText.innerText = "🔍 Buscando imágenes...";
    btnSearch.disabled = true;

    try {
        const posts = await window.api.searchImages({ tag, sources: selectedSources, page });
        logToTerminal(`[UI] Respuesta recibida: ${posts?.length} posts.`);
        renderGrid(posts);
        statusText.innerText = posts && posts.length > 0 
            ? `✅ Se encontraron ${posts.length} imágenes.` 
            : "😢 No se encontraron imágenes.";
    } catch (e) {
        logToTerminal(`[UI] Error crítico: ${e.message}`);
        statusText.innerText = "❌ Error en el sistema.";
    } finally {
        btnSearch.disabled = false;
    }
});

btnDownloadPage.addEventListener('click', async () => {
    if (currentPosts.length === 0) return;
    statusText.innerText = "📦 Descargando página completa...";
    const res = await window.api.downloadPage({ posts: currentPosts, dir: './downloads' });
    statusText.innerText = `✅ Completado: ${res.downloaded} bajadas, ${res.skipped} repetidas.`;
});

btnDownloadUntil.addEventListener('click', async () => {
    const tag = document.getElementById('tagName').value;
    const startPage = parseInt(document.getElementById('pageNumber').value);
    const endPage = parseInt(document.getElementById('untilPage').value);
    const selectedSources = Array.from(document.querySelectorAll('.source-check:checked')).map(cb => cb.value);

    if (endPage < startPage) return alert("La página final debe ser mayor que la actual");

    statusText.innerText = `🚀 Iniciando descarga masiva hasta la pág ${endPage}...`;
    const res = await window.api.downloadUntilPage({ 
        tag, sources: selectedSources, startPage, endPage, dir: './downloads' 
    });
    statusText.innerText = `✅ Masivo terminado: ${res.downloaded} bajadas, ${res.skipped} repetidas.`;
});

btnClearLogs.addEventListener('click', async () => {
    if (confirm("¿Estás seguro de borrar el historial de hashes?")) {
        await window.api.clearLogs();
        alert("Logs limpiados");
    }
});