import { spawn } from "child_process";
import fs from "fs";

export default class DownloadService {
    // Verifica los primeros bytes del archivo para saber si es realmente una imagen/video
    static validateImage(buffer) {
        if (!buffer || buffer.length < 10) return false;
        // JPEG: FF D8
        if (buffer[0] === 0xFF && buffer[1] === 0xD8) return true; 
        // PNG: 89 50 4E 47
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true; 
        // GIF: 47 49 46 38
        if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return true; 
        // WebP: RIFF .... WEBP
        if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return true; 
        }
        // MP4 / WebM
        if (buffer.length >= 12 && buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x00 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return true;
        if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) return true;
        return false;
    }

    static async download(url, referer, tempPath) {
        return new Promise((resolve, reject) => {
            // 🚨 ESTOS HEADERS SON EL SECRETO: Engañan al servidor para evitar el 403
            const args = [
                '-s', '-L', '-o', tempPath,
                '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                '-H', `Referer: ${referer}`,
                '-H', 'Accept: image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
                '-H', 'Accept-Language: en-US,en;q=0.9',
                '-H', 'Sec-Fetch-Dest: image',
                '-H', 'Sec-Fetch-Mode: no-cors',
                '-H', 'Sec-Fetch-Site: cross-site',
                '--connect-timeout', '15',
                '--max-time', '60',
                '--retry', '2',
                '--compressed',
                url
            ];

            const proc = spawn('curl', args);

            proc.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Curl error ${code}`));
                }

                if (!fs.existsSync(tempPath)) {
                    return reject(new Error("File not created by curl"));
                }

                // 🚨 VALIDACIÓN DE CONTENIDO: Evitamos guardar archivos HTML que dicen ser imágenes
                const buffer = fs.readFileSync(tempPath);
                if (!this.validateImage(buffer)) {
                    // Si el archivo empieza por <!DOCTYPE o <html, el servidor nos bloqueó
                    return reject(new Error("Server returned HTML instead of image (Blocked)"));
                }

                resolve();
            });

            proc.on('error', (err) => reject(err));
        });
    }
}
