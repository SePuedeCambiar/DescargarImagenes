import crypto from "crypto";
import { Jimp } from 'jimp';

export default class HashService {
    static async calculateExactHash(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    static async calculateVisualHash(buffer) {
        try {
            const image = await Jimp.read(buffer);
            image.resize({ w: 9, h: 8 });
            // ... (aquí va tu lógica de dHash actual)
            return hash;
        } catch (e) {
            return null;
        }
    }
}
