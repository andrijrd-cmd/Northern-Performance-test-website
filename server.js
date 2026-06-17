const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.json': 'application/json',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

async function generateBannerJpg() {
  const puppeteer = require('puppeteer');

  // file:// avoids any server round-trip
  const bannerPath = path.resolve(ROOT, 'retractable-banner.html');
  const fileUrl    = 'file:///' + bannerPath.replace(/\\/g, '/');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  // deviceScaleFactor 6.667 → 596px logical × 6.667 = 3970px physical
  // = 100 DPI at 39.7" (33.7" content + 3" bleed each side)
  await page.setViewport({ width: 596, height: 9000, deviceScaleFactor: 6.667 });

  await page.goto(fileUrl, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#qrcode canvas');

  // Screenshot just the .banner element — excludes body background and buttons
  const bannerEl = await page.$('.banner');
  const jpg = await bannerEl.screenshot({ type: 'jpeg', quality: 95 });

  await browser.close();
  return jpg;
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/download-banner') {
    console.log('  Generating banner JPG (this takes ~15 seconds)...');
    generateBannerJpg()
      .then((jpg) => {
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': 'attachment; filename="northern-performance-banner.jpg"',
          'Content-Length': jpg.length,
        });
        res.end(jpg);
        console.log('  Banner JPG sent successfully.');
      })
      .catch((err) => {
        console.error('  JPG generation failed:', err.message);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('JPG generation failed: ' + err.message);
      });
    return;
  }

  const filePath = path.join(ROOT, urlPath === '/' ? '/index.html' : urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`404 — Not found: ${urlPath}`);
      return;
    }
    const ext  = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`\n  Northern Performance — local server running`);
  console.log(`  ─────────────────────────────────────────`);
  console.log(`  http://localhost:${PORT}/`);
  console.log(`  http://localhost:${PORT}/retractable-banner.html`);
  console.log(`  http://localhost:${PORT}/business-card.html`);
  console.log(`  http://localhost:${PORT}/facebook-post.html`);
  console.log(`  http://localhost:${PORT}/instagram-launch.html`);
  console.log(`\n  Press Ctrl+C to stop.\n`);
});
