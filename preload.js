const { contextBridge, ipcRenderer } = require('electron');

// Exponemos una API segura llamada 'api' al mundo del frontend (window.api)
contextBridge.exposeInMainWorld('api', {
    
    // 🔍 BUSQUEDA
    // Envía la petición de búsqueda y espera la lista de posts
    searchImages: (data) => ipcRenderer.invoke('search-images', data),

    // 📥 DESCARGAS
    // Descarga una sola imagen
    downloadSingle: (data) => ipcRenderer.invoke('download-single', data),

    // Descarga todas las imágenes de la página actual
    downloadPage: (data) => ipcRenderer.invoke('download-page', data),

    // Descarga masiva desde la página actual hasta la página X
    downloadUntilPage: (data) => ipcRenderer.invoke('download-until-page', data),

    // 🧹 MANTENIMIENTO
    // Borra el historial de hashes para permitir repetir descargas
    clearLogs: () => ipcRenderer.invoke('clear-logs'),

    // 📁 SISTEMA
    // Abre el diálogo de carpetas del sistema operativo
    selectFolder: () => ipcRenderer.invoke('dialog:openDirectory'),

    // 🛠️ DIAGNÓSTICO (LOGS)
    // Envía un mensaje desde la interfaz a la terminal de Node.js
    sendLog: (msg) => ipcRenderer.send('ui-log', msg)
});