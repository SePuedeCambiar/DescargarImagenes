import fs from "fs";
import path from "path";
import { app } from 'electron';

class LogManager {
    constructor() {
        const logPath = process.env.LOG_FILE || path.join(app.getPath('userData'), 'hashes_log.json');
        this.filePath = logPath;
        this.logs = this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                const data = fs.readFileSync(this.filePath, "utf8");
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) return { exact: parsed, visual: [] };
                return parsed;
            }
        } catch (e) { console.error("[Logs] Error:", e.message); }
        return { exact: [], visual: [] };
    }

    save(exactHash, visualHash) {
        this.logs.exact.push(exactHash);
        if (visualHash) this.logs.visual.push(visualHash);
        fs.writeFileSync(this.filePath, JSON.stringify(this.logs, null, 2));
    }

    isDuplicate(exactHash, visualHash) {
        if (this.logs.exact.includes(exactHash)) return true;
        if (visualHash && this.logs.visual.includes(visualHash)) return true;
        return false;
    }

    clear() {
        this.logs = { exact: [], visual: [] };
        fs.writeFileSync(this.filePath, JSON.stringify(this.logs, null, 2));
    }
}

export default LogManager;
