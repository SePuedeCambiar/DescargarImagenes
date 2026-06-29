import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import WaifuGrabberEngine from './src/engine/grabber.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const engine = new WaifuGrabberEngine();
let mainWindow; // <--- Variable global para poder enviar mensajes al frontend

// =============================================================================
// 🛡️ INTERCEPTOR DE HEADERS
// =============================================================================
function setupHeaderInterceptor() {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const url = details.url;
        const isBooru = url.includes('donmai.us') || url.includes('rule34') || url.includes('gelbooru') || url.includes('wimg');

        if (isBooru) {
            let referer = 'https://google.com/';
            if (url.includes('donmai')) referer = 'https://danbooru.donmai.us/';
            else if (url.includes('rule34')) referer = 'https://rule34.xxx/';
            else if (url.includes('gelbooru')) referer = 'https://gelbooru.com/';
            
            details.requestHeaders['Referer'] = referer;
            details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
        }
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({ // <--- Asignamos a la variable global
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false 
        }
    });

    mainWindow.loadFile('src/ui/index.html');
}

// =============================================================================
// 🔌 MANEJADORES DE COMUNICACIÓN (IPC)
// =============================================================================

// Búsqueda simple (Para la galería/preview)
ipcMain.handle('search-images', async (event, args) => {
    try {
        // Seguimos usando fetchPosts para que la galería no se sature con miles de imágenes
        return await engine.fetchPosts(args.tag, args.sources, args.page);
    } catch (error) {
        console.error(`[MAIN] Error en búsqueda:`, error);
        throw error;
    }
});

// NUEVO: Búsqueda masiva (Para obtener TODO y enviarlo al frontend)
ipcMain.handle('search-all-images', async (event, args) => {
    try {
        return await engine.fetchAllPages(args.tag, args.sources, (progress) => {
            // Enviamos el progreso al frontend en tiempo real
            if (mainWindow) {
                mainWindow.webContents.send('search-progress', progress);
            }
        });
    } catch (error) {
        console.error(`[MAIN] Error en búsqueda masiva:`, error);
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

// ACTUALIZADO: Descarga masiva con notificación de progreso
ipcMain.handle('download-until-page', async (event, { tag, sources, startPage, endPage, dir }) => {
    let results = { downloaded: 0, skipped: 0, currentPage: 0 };
    
    try {
        for (let p = startPage; p <= endPage; p++) {
            results.currentPage = p;
            
            // Notificamos al frontend que estamos procesando esta página
            if (mainWindow) {
                mainWindow.webContents.send('download-progress', { 
                    currentPage: p, 
                    endPage: endPage 
                });
            }

            const posts = await engine.fetchPosts(tag, sources, p);
            for (const post of posts) {
                const res = await engine.downloadImage(post, dir);
                res.success ? results.downloaded++ : results.skipped++;
            }
        }
        return results;
    } catch (error) {
        console.error(`[MAIN] Error en descarga masiva:`, error);
        return { success: false, message: error.message };
    }
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
// 🚀 CICLO DE VIDA DE LA APP
// =============================================================================
app.whenReady().then(() => {
    setupHeaderInterceptor();
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
