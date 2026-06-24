import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import WaifuGrabberEngine from './src/engine/grabber.js';

// CORRECCIÓN: Definición correcta de rutas para modo ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const engine = new WaifuGrabberEngine();

// =============================================================================
// 🛡️ INTERCEPTOR DE HEADERS (Sustituye la función que faltaba)
// =============================================================================
function setupHeaderInterceptor() {
    console.log("[MAIN] 🛡️ Interceptor Activo. Monitoreando tráfico de imágenes...");
    
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const url = details.url;
        
        // Detectamos si la URL pertenece a alguna de nuestras fuentes
        const isBooru = url.includes('donmai.us') || 
                        url.includes('rule34') || 
                        url.includes('gelbooru') || 
                        url.includes('wimg');

        if (isBooru) {
            console.log(`[RED-LOG] 📡 Interceptando: ${url}`);
            
            // Forzamos el Referer dinámico según el dominio
            let referer = 'https://google.com/';
            if (url.includes('donmai')) referer = 'https://danbooru.donmai.us/';
            else if (url.includes('rule34')) referer = 'https://rule34.xxx/';
            else if (url.includes('gelbooru')) referer = 'https://gelbooru.com/';
            
            details.requestHeaders['Referer'] = referer;
            details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
            
            console.log(`[RED-LOG] ✅ Headers aplicados. Referer: ${referer}`);
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
            webSecurity: false // PERMITE cargar imágenes de dominios externos
        }
    });

    // ABRE LA CONSOLA AUTOMÁTICAMENTE para que veas los errores de red
    win.webContents.openDevTools(); 

    win.loadFile('src/ui/index.html');
}

// =============================================================================
// 🔌 MANEJADORES DE COMUNICACIÓN (IPC)
// =============================================================================

ipcMain.handle('search-images', async (event, args) => {
    try {
        console.log(`[MAIN] Buscando: ${args.tag}`);
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
// 🚀 CICLO DE VIDA DE LA APP
// =============================================================================
app.whenReady().then(() => {
    // PRIMERO: Configuramos el bypass de red
    setupHeaderInterceptor();
    // SEGUNDO: Creamos la interfaz
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});