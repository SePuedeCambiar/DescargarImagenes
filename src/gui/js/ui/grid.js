import { state } from '../state.js';
import { ApiService } from '../api.js';

export const GridUI = {
    render(posts) {
        const grid = document.getElementById('resultsGrid');
        grid.innerHTML = ''; // Limpia todo
        
        if (posts.length === 0) {
            grid.innerHTML = '<div class="placeholder-text">No se encontraron imágenes...</div>';
            return;
        }

        // Cargamos el primer bloque (20 imágenes)
        this.appendPosts(); 
        document.getElementById('globalControls').classList.remove('hidden');
    },

    appendPosts() {
        const grid = document.getElementById('resultsGrid');
        const chunkSize = 20;
        
        // Eliminamos el botón "Cargar más" anterior si existe antes de añadir nuevas
        const existingBtn = document.getElementById('btnLoadMore');
        if (existingBtn) existingBtn.remove();

        const start = state.displayedCount;
        const end = Math.min(start + chunkSize, state.posts.length);
        
        const fragment = document.createDocumentFragment();
        
        for (let i = start; i < end; i++) {
            const card = this.createCard(state.posts[i], i);
            fragment.appendChild(card);
        }
        
        grid.appendChild(fragment);
        state.displayedCount = end;
        
        // Si aún quedan imágenes por mostrar, añadimos el botón al final
        if (state.displayedCount < state.posts.length) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'btnLoadMore';
            loadMoreBtn.className = 'btn-load-more';
            loadMoreBtn.innerText = `Cargar más (${state.posts.length - state.displayedCount} restantes)`;
            loadMoreBtn.onclick = () => this.appendPosts();
            grid.appendChild(loadMoreBtn);
        }
    },

    createCard(post, index) {
        const card = document.createElement('div');
        card.className = 'image-card';
        
        card.innerHTML = `
            <img src="${post.preview}" 
                 loading="lazy" 
                 onerror="this.src='https://via.placeholder.com/200x200?text=Error+403'"
                 style="cursor: pointer;"> 
            <div class="card-info">
                <span class="source-badge">${post.source}</span>
                <button class="btn-dl-small">Descargar</button>
            </div>
        `;

        const img = card.querySelector('img');
        img.addEventListener('click', () => {
            if (window.openLightbox) {
                window.openLightbox(index);
            }
        });

        card.querySelector('.btn-dl-small').addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.handleDownload(post);
        });

        return card;
    },

    async handleDownload(post) {
        const status = document.getElementById('statusText');
        status.innerText = `📥 Descargando ${post.id}...`;
        
        try {
            const res = await ApiService.downloadSingle({ post: post, dir: state.downloadPath });
            status.innerText = res.success ? `✅ Guardado: ${post.id}` : `❌ ${res.message}`;
        } catch (e) {
            console.error(e);
            status.innerText = `❌ Error crítico en descarga`;
        }
    }
};
