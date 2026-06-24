import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import WaifuGrabberEngine from './src/engine/grabber.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const engine = new WaifuGrabberEngine();

// =============================================================================
// 🛡️ CONFIGURACIÓN DEL INTERCEPTOR (Ahora en una función)
// =============================================================================
function setupHeaderInterceptor() {
    console.log("[MAIN] Configurando interceptor de headers avanzado...");
    
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const url = details.url;
        let referer = null;

        // Determinamos el Referer correcto según el dominio de la imagen
        if (url.includes('donmai.us')) {
            referer = 'https://danbooru.donmai.us/';
        } else if (url.includes('rule34.xxx') || url.includes('wimg.rule34')) {
            referer = 'https://rule34.xxx/';
        } else if (url.includes('gelbooru.com')) {
            referer = 'https://gelbooru.com/';
        }

        if (referer) {
            // LOG para saber que estamos interceptando una imagen
            console.log(`[INTERCEPTOR] Forzando Referer ${referer} para: ${url.substring(0, 60)}...`);
            
            details.requestHeaders['Referer'] = referer;
            details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        }

        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false // Importante para cargar imágenes externas
        }
    });

    win.loadFile('src/ui/index.html');
}

// --- Manejadores de IPC ---

ipcMain.handle('search-images', async (event, args) => {
    try {
        return await engine.fetchPosts(args.tag, args.sources, args.page);
    } catch (error) {
        console.error(`[MAIN] Error en búsqueda:`, error);
        throw error;
    }
});

ipcMain.handle('download-single', async (event, { post, dir }) => {
    try {
        return await engine.downloadImage(post, dir);
    } catch (error) {
        console.error(`[MAIN] Error en descarga:`, error);
        return { success: false, message: error.message };
    }
});

ipcMain.handle('download-page', async (event, { posts, dir }) => {
    let results = { downloaded: 0, skipped: 0 };
    for (const post of posts) {
        const res = await engine.downloadImage(post, dir);
        res.success ? results.downloaded++ : results.skipped++;
    }
    return results;
});

ipcMain.handle('download-until-page', async (event, { tag, sources, startPage, endPage, dir }) => {
    let results = { downloaded: 0, skipped: 0 };
    for (let p = startPage; p <= endPage; p++) {
        const posts = await engine.fetchPosts(tag, sources, p);
        for (const post of posts) {
            const res = await engine.downloadImage(post, dir);
            res.success ? results.downloaded++ : results.skipped++;
        }
    }
    return results;
});

ipcMain.handle('clear-logs', async () => {
    return engine.clearLogs();
});

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (canceled) return null;
    return filePaths[0];
});

// =============================================================================
// 🚀 INICIO DE LA APLICACIÓN
// =============================================================================
app.whenReady().then(() => {
    // 1. Primero configuramos la red (interceptor)
    setupHeaderInterceptor();
    // 2. Luego creamos la ventana
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});