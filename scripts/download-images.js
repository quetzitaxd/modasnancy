const https = require('https');
const fs = require('fs').promises;
const path = require('path');

const imageMap = {
    'vest-floral-01': 'https://placehold.co/400x400/e85c8a/ffffff?text=Vestido+Floral',
    'blusa-seda-02': 'https://placehold.co/400x400/c97a7a/ffffff?text=Blusa+Seda',
    'falda-plis-03': 'https://placehold.co/400x400/b07cc9/ffffff?text=Falda+Plisada',
    'pant-jean-04': 'https://placehold.co/400x400/4169e1/ffffff?text=Jeans',
    'top-crop-05': 'https://placehold.co/400x400/ffb6c1/333333?text=Top+Crop',
    'vest-cock-06': 'https://placehold.co/400x400/d63031/ffffff?text=Vestido+Coctel',
    'blusa-boho-07': 'https://placehold.co/400x400/ff69b4/ffffff?text=Blusa+Boho',
    'falda-mini-08': 'https://placehold.co/400x400/5b7c99/ffffff?text=Minifalda',
    'pant-palaz-09': 'https://placehold.co/400x400/f5deb3/333333?text=Palazzo',
    'acc-collar-10': 'https://placehold.co/400x400/ffd700/333333?text=Collar',
    'vest-casu-11': 'https://placehold.co/400x400/f1c40f/333333?text=Vestido+Verano',
    'blusa-off-12': 'https://placehold.co/400x400/ffffff/333333?text=Blusa+Off+Shoulder'
};

async function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = require('fs').createWriteStream(dest);
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Status ${response.statusCode} for ${url}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', reject);
    });
}

async function main() {
    const baseDir = path.resolve(__dirname, '..', 'data', 'products');
    for (const [id, url] of Object.entries(imageMap)) {
        const dir = path.join(baseDir, id);
        const dest = path.join(dir, 'main.png');
        try {
            await fs.mkdir(dir, { recursive: true });
            await download(url, dest);
            console.log(`Descargado: ${id}`);
        } catch (e) {
            console.error(`Error ${id}:`, e.message);
        }
    }
    console.log('Descargas completadas');
}

main();
