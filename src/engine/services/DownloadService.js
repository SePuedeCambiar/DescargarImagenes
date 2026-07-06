import { spawn } from "child_process";
import fs from "fs";
import path from "path";

export default class DownloadService {
    static async download(url, referer, tempPath) {
        return new Promise((resolve, reject) => {
            const args = ['-s', '-L', '-o', tempPath, '-H', `Referer: ${referer}`, url];
            const proc = spawn('curl', args);
            proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Curl ${code}`)));
        });
    }
}
