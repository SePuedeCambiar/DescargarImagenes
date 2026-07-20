const { contextBridge, ipcRenderer } = require('electron');

// Exponemos la API segura al frontend
contextBridge.exposeInMainWorld('api', {
    
    // 🔍 BÚSQUEDA, SUGERENCIAS Y RESOLUCIÓN
    searchImages: (data) => ipcRenderer.invoke('search-images', data),
    getSuggestions: (params) => ipcRenderer.invoke('get-tag-suggestions', params),
    getSources: () => ipcRenderer.invoke('get-sources'),
    
    // 🔥 NUEVO: Resuelve la URL de un post para obtener el link directo a la imagen HD
    resolveImageUrl: (args) => ipcRenderer.invoke('resolve-image-url', args),

    // 📥 DESCARGAS
    downloadSingle: (data) => ipcRenderer.invoke('download-single', data),
    downloadPage: (data) => ipcRenderer.invoke('download-page', data),
    downloadUntilPage: (data) => ipcRenderer.invoke('download-until-page', data),

    // 🧹 MANTENIMIENTO
    clearLogs: () => ipcRenderer.invoke('clear-logs'),

    // 📁 SISTEMA
    selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),

    // ⚙️ CONFIGURACIÓN (Añadidos para la Fase 2)
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),

    // 🛠️ DIAGNÓSTICO
    sendLog: (msg) => ipcRenderer.send('ui-log', msg),
});