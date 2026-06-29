const { join } = require('path');

module.exports = {
  // Esto hará que Chromium se descargue en una carpeta llamada .cache dentro de tu proyecto
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
