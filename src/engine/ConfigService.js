// src/engine/ConfigService.js
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

class ConfigService {
    constructor() {
        // Guarda el archivo en la carpeta de datos de la app (AppData/Roaming/WaifuGrabber...)
        this.configPath = path.join(app.getPath('userData'), 'config.json');
        this.defaults = {
            downloadPath: './downloads',
            apiKey: '',
            denylist: '',
            categories: [],
            selectedSources: []
        };
    }

    // Leer configuración del disco
    load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                return { ...this.defaults, ...JSON.parse(data) };
            }
        } catch (error) {
            console.error("[ConfigService] Error leyendo config, usando defaults:", error);
        }
        return this.defaults;
    }

    // Guardar configuración al disco
    save(config) {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 4));
            return { success: true };
        } catch (error) {
            console.error("[ConfigService] Error guardando config:", error);
            return { success: false, error };
        }
    }
}

export default new ConfigService();
