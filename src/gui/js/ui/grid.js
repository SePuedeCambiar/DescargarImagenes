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

        // 🚀 CAMBIO: Añadimos 'index' al forEach para saber qué posición tiene la imagen
        posts.forEach((post, index) => {
            const card = this.createCard(post, index);
            grid.appendChild(card);
        });

        document.getElementById('globalControls').classList.remove('hidden');
    },

    createCard(post, index) { // 🚀 Recibe el índice
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

        // 🖼️ EVENTO: Abrir Lightbox al hacer clic en la imagen
        const img = card.querySelector('img');
        img.addEventListener('click', () => {
            // Llamamos a la función que definimos en main.js
            if (window.openLightbox) {
                window.openLightbox(index);
            } else {
                console.error("La función openLightbox no está definida en window");
            }
        });

        // Evento de descarga
        card.querySelector('.btn-dl-small').addEventListener('click', async (e) => {
            e.stopPropagation(); // Evita que al descargar también se abra el lightbox
            await this.handleDownload(post);
        });

        return card;
    },

    async handleDownload(post) {
        const status = document.getElementById('statusText');
        status.innerText = `📥 Descargando ${post.id}...`;
        
        try {
            const res = await ApiService.downloadSingle({ 
                post: post, 
                dir: state.downloadPath 
            });
            
            status.innerText = res.success ? `✅ Guardado: ${post.id}` : `❌ ${res.message}`;
        } catch (e) {
            console.error(e);
            status.innerText = `❌ Error crítico en descarga`;
        }
    }
};
