import { state } from '../state.js';
import { ApiService } from '../api.js';

export const GridUI = {
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    render(posts) {
        const grid = document.getElementById('resultsGrid');
        grid.innerHTML = '';
        state.displayedCount = 0; 
        
        if (posts.length === 0) {
            grid.innerHTML = '<div class="placeholder-text">No se encontraron imágenes...</div>';
            return;
        }

        this.appendPosts(); 
        document.getElementById('globalControls').classList.remove('hidden');
    },

    async appendPosts() {
        const grid = document.getElementById('resultsGrid');
        const chunkSize = 20; 
        const stepSize = 3;    
        
        if (state.displayedCount < state.posts.length) {
            const start = state.displayedCount;
            const end = Math.min(start + chunkSize, state.posts.length);
            
            // 🚀 IMPORTANTE: Antes de añadir imágenes, podemos quitar el botón 
            // o simplemente moverlo al final al terminar.
            
            for (let i = start; i < end; i += stepSize) {
                const fragment = document.createDocumentFragment();
                for (let j = i; j < Math.min(i + stepSize, end); j++) {
                    fragment.appendChild(this.createCard(state.posts[j], j));
                }
                grid.appendChild(fragment);
                await this.sleep(50); 
            }
            
            state.displayedCount = end;
            
            // 🚀 ESTO ES LO QUE SOLUCIONA EL PROBLEMA:
            // Después de añadir todas las imágenes del bloque, 
            // obligamos al botón a irse al final del todo.
            this.updateLoadMoreButton();
        } 
        else {
            this.setLoadingState(true);
            try {
                state.currentPage++;
                const nextPosts = await ApiService.search({
                    ...state.lastSearchParams,
                    page: state.currentPage
                });

                if (nextPosts && nextPosts.length > 0) {
                    state.posts.push(...nextPosts);
                    await this.appendPosts(); 
                } else {
                    alert("✨ Has llegado al final de los resultados.");
                    this.removeLoadMoreButton();
                }
            } catch (e) {
                console.error("Error cargando siguiente página:", e);
            } finally {
                this.setLoadingState(false);
            }
        }
    },

    setLoadingState(isLoading) {
        const btn = document.getElementById('btnLoadMore');
        if (btn) {
            btn.disabled = isLoading;
            btn.innerText = isLoading ? '⏳ Consultando Boorus...' : '📦 Cargar más imágenes';
        }
    },

    updateLoadMoreButton() {
        const grid = document.getElementById('resultsGrid');
        let loadMoreBtn = document.getElementById('btnLoadMore');

        if (!loadMoreBtn) {
            // Crear el botón si no existe
            loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'btnLoadMore';
            loadMoreBtn.className = 'btn-load-more';
            loadMoreBtn.innerText = '📦 Cargar más imágenes';
            loadMoreBtn.onclick = () => this.appendPosts();
        }

        // 🚀 EL TRUCO: 
        // Al hacer appendChild de un elemento que ya existe, 
        // el navegador lo MUEVE al final de la lista.
        grid.appendChild(loadMoreBtn);
    },

    removeLoadMoreButton() {
        const btn = document.getElementById('btnLoadMore');
        if (btn) btn.remove();
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
            if (window.openLightbox) window.openLightbox(index);
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
            const res = await ApiService.downloadSingle({ post, dir: state.downloadPath });
            status.innerText = res.success ? `✅ Guardado: ${post.id}` : `❌ ${res.message}`;
        } catch (e) {
            console.error(e);
            status.innerText = `❌ Error crítico en descarga`;
        }
    }
};
