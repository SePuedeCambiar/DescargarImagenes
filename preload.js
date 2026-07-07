const { contextBridge, ipcRenderer } = require('electron');

// Exponemos la API segura al frontend
contextBridge.exposeInMainWorld('api', {
    
    // 🔍 BÚSQUEDA
    searchImages: (data) => ipcRenderer.invoke('search-images', data),

    // 📥 DESCARGAS
    downloadSingle: (data) => ipcRenderer.invoke('download-single', data),
    downloadPage: (data) => ipcRenderer.invoke('download-page', data),
    downloadUntilPage: (data) => ipcRenderer.invoke('download-until-page', data),

    // 🧹 MANTENIMIENTO
    clearLogs: () => ipcRenderer.invoke('clear-logs'),

    // 📁 SISTEMA
    selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),

    // 🛠️ DIAGNÓSTICO
    sendLog: (msg) => ipcRenderer.send('ui-log', msg),
    
    getSources: () => ipcRenderer.invoke('get-sources'),
});
