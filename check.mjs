import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
const failedRequests = [];
page.on('pageerror', (err) => errors.push(`PAGE ERROR: ${err.message}`));
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`); });
page.on('requestfailed', (req) => failedRequests.push(`${req.failure()?.errorText} ${req.url()}`));
page.on('response', (resp) => {
  if (resp.status() >= 400) failedRequests.push(`HTTP ${resp.status()} ${resp.url()}`);
});
await page.goto('https://gi11es.github.io/guide-perols-montpellier/', { waitUntil: 'networkidle', timeout: 30000 }).catch(e => errors.push(`GOTO: ${e.message}`));
await page.waitForTimeout(3000);
console.log('=== ERRORS ===');
errors.forEach(e => console.log(e));
console.log('=== FAILED REQUESTS ===');
failedRequests.slice(0, 20).forEach(r => console.log(r));
await browser.close();
