import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('https://gi11es.github.io/guide-perols-montpellier/', { waitUntil: 'networkidle' });
// click one of the dots: just trigger the place:select event via JS
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const ev = new CustomEvent('place:select', { detail: { slug: 'pont-du-gard', name: 'Pont du Gard', category: 'nature' }});
  window.dispatchEvent(ev);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/sidebar.png', fullPage: false });
console.log('saved /tmp/sidebar.png');
await browser.close();
