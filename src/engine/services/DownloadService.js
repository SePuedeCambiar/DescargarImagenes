import fs from 'fs';
import axios from 'axios';

export default class DownloadService {
    static async download(url, referer, tempPath) {
        const writer = fs.createWriteStream(tempPath);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            headers: { 'Referer': referer }
        });

        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }
}
