import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import WaifuGrabberEngine from './src/engine/GrabberEngine.js';
import BrowserManager from './src/engine/core/BrowserManager.js'; // Importante para el cierre
import configService from './src/engine/ConfigService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const engine = new WaifuGrabberEngine();
let mainWindow;

// =============================================================================
// 🛡️ INTERCEPTOR DE HEADERS (Evita bloqueos de Boorus)
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
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false 
        }
    });

    mainWindow.loadFile('src/gui/index.html');
}

// =============================================================================
// 🔌 MANEJADORES DE COMUNICACIÓN (IPC)
// =============================================================================

// 1. Gestión de Fuentes y Tags
ipcMain.handle('get-sources', async () => {
    try {
        return engine.getAvailableSources();
    } catch (error) {
        console.error(`[MAIN] Error obteniendo fuentes:`, error);
        return [];
    }
});

ipcMain.handle('get-tag-suggestions', async (event, params) => {
    try {
        return await engine.suggestTags(params);
    } catch (error) {
        console.error(`[MAIN] Error en sugerencias:`, error);
        return [];
    }
});

// 🚀 NUEVO: Resolución de URL para el Lightbox/Slideshow
ipcMain.handle('resolve-image-url', async (event, { post }) => {
    try {
        const source = engine.sources[post.source];
        if (!source) return null;
        
        // Obtenemos la instancia del navegador y resolvemos la URL real de la imagen
        const browser = await BrowserManager.getInstance();
        const realUrl = await source.resolveImageUrl(post.url, browser);
        
        return realUrl;
    } catch (error) {
        console.error(`[MAIN] Error resolviendo URL de imagen:`, error);
        return null;
    }
});

// 2. Búsqueda
ipcMain.handle('search-images', async (event, args) => {
    try {
        return await engine.fetchPosts(args); 
    } catch (error) {
        console.error(`[MAIN] Error en búsqueda:`, error);
        throw error;
    }
});

ipcMain.handle('search-all-images', async (event, args) => {
    try {
        return await engine.fetchAllPages(args, (progress) => {
            if (mainWindow) {
                mainWindow.webContents.send('search-progress', progress);
            }
        });
    } catch (error) {
        console.error(`[MAIN] Error en búsqueda masiva:`, error);
        throw error;
    }
});

// 3. Descargas
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

ipcMain.handle('download-until-page', async (event, args) => {
    const { tag, sources, startPage, endPage, dir, categories, denylist } = args;
    let results = { downloaded: 0, skipped: 0, currentPage: 0 };
    
    try {
        for (let p = startPage; p <= endPage; p++) {
            results.currentPage = p;
            if (mainWindow) {
                mainWindow.webContents.send('download-progress', { 
                    currentPage: p, 
                    endPage: endPage 
                });
            }

            const posts = await engine.fetchPosts({
                tag, 
                sources, 
                page: p, 
                categories: categories || [], 
                denylist: denylist || ''
            });
            
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

// 4. Utilidades y Diálogos
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

// 5. Gestión de Configuración Persistente
ipcMain.handle('get-config', async () => {
    try {
        return configService.load();
    } catch (error) {
        console.error("[MAIN] Error cargando configuración:", error);
        return {};
    }
});

ipcMain.handle('save-config', async (event, config) => {
    try {
        return configService.save(config);
    } catch (error) {
        console.error("[MAIN] Error guardando configuración:", error);
        return { success: false, error };
    }
});

// =============================================================================
// 🚀 CICLO DE VIDA DE LA APP
// =============================================================================

app.whenReady().then(async () => {
    try {
        await engine.initialize(); 
        console.log("✅ Motor inicializado y fuentes cargadas dinámicamente.");
        
        setupHeaderInterceptor();
        createWindow();
    } catch (error) {
        console.error("❌ Error crítico durante la inicialización de la app:", error);
    }
});

app.on('window-all-closed', async () => {
    if (process.platform !== 'darwin') {
        // 🚀 LIMPIEZA CRÍTICA: Cerramos el navegador para evitar el SingletonLock
        try {
            await BrowserManager.close();
            console.log("[MAIN] Navegador cerrado correctamente.");
        } catch (e) {
            console.error("[MAIN] Error cerrando navegador:", e);
        }
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});