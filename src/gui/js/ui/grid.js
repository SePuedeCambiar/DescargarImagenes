// src/gui/js/ui/grid.js
import { state } from '../state.js';
import { ApiService } from '../api.js';

export const GridUI = {
    render(posts) {
        const grid = document.getElementById('resultsGrid');
        grid.innerHTML = '';
        
        if (posts.length === 0) {
            grid.innerHTML = '<div class="placeholder-text">No se encontraron imágenes...</div>';
            return;
        }

        posts.forEach(post => {
            const card = this.createCard(post);
            grid.appendChild(card);
        });

        document.getElementById('globalControls').classList.remove('hidden');
    },

    createCard(post) {
        const card = document.createElement('div');
        card.className = 'image-card';
        
        card.innerHTML = `
            <img src="${post.preview}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x200?text=Error+403'">
            <div class="card-info">
                <span class="source-badge">${post.source}</span>
                <button class="btn-dl-small">Descargar</button>
            </div>
        `;

        // Evitamos usar onclick="" en el HTML y usamos event listeners reales
        card.querySelector('.btn-dl-small').addEventListener('click', async () => {
            await this.handleDownload(post);
        });

        return card;
    },

    async handleDownload(post) {
        // Aquí llamamos a un sistema de notificaciones externo
        const status = document.getElementById('statusText');
        status.innerText = `📥 Descargando ${post.id}...`;
        
        const res = await ApiService.downloadSingle(post);
        status.innerText = res.success ? `✅ Guardado: ${post.id}` : `❌ ${res.message}`;
    }
};
