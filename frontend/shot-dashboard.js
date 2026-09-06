// One-off: desktop-size screenshot of /dashboard as livetest
const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="password"]', { timeout: 30000 });
  for (let attempt = 0; attempt < 3 && !page.url().includes('/dashboard') && !page.url().includes('/home') && !page.url().includes('/profile-setup'); attempt++) {
    const email = await page.$('input[type="email"]') || (await page.$$('input:not([type="password"]):not([type="checkbox"])'))[0];
    await email.fill('livetest@guildos.local');
    await page.fill('input[type="password"]', 'LiveTest123!');
    await page.click('button:has-text("Continue"):not(:has-text("Google"))');
    await page.waitForTimeout(5000);
  }
  console.log('after login:', page.url());
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Recent Events', { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(3000);
  // Dismiss product tour if present
  const skip = await page.$('[aria-label="Product tour"] button:has-text("Skip")');
  if (skip) { await skip.click(); await page.waitForTimeout(600); }
  const section = await page.evaluateHandle(() => {
    const h = [...document.querySelectorAll('h2')].find((e) => /Recent Events|Upcoming Events/.test(e.textContent || ''));
    return h ? h.closest('section') : null;
  });
  const el = section.asElement();
  if (el) {
    const box = await el.boundingBox();
    await page.evaluate((y) => window.scrollTo(0, y - 80), box.y);
    await page.waitForTimeout(500);
    const card = await page.$('article');
    if (card) { const b = await card.boundingBox(); if (b) await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); }
    await page.waitForTimeout(400);
    await el.screenshot({ path: '.tmp-desktop-events.png' });
  }
  await page.screenshot({ path: '.tmp-desktop-full.png', fullPage: true });
  await browser.close();
  console.log('done');
})();
