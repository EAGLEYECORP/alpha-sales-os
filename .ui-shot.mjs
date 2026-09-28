import { chromium } from 'playwright-core';
const SHOT = '/tmp/claude-0/-home-user-alpha-sales-os/9cfc295a-795b-5c2f-a713-8c86a08b7f95/scratchpad';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const overflows = [];
async function grab(path, name){
  await page.goto('http://127.0.0.1:3216'+path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  // détecte tout élément qui déborde horizontalement de son parent viewport
  const ov = await page.evaluate(() => {
    const bad=[];
    const vw = document.documentElement.clientWidth;
    document.querySelectorAll('*').forEach(el=>{
      const r = el.getBoundingClientRect();
      if (r.width>0 && r.right > vw+2){ bad.push({tag:el.tagName, cls:(el.className||'').toString().slice(0,60), right:Math.round(r.right), txt:(el.textContent||'').trim().slice(0,40)}); }
    });
    // dé-doublonne par cls
    const seen=new Set(); return bad.filter(b=>{const k=b.cls+b.right; if(seen.has(k))return false; seen.add(k); return true;}).slice(0,8);
  });
  if (ov.length) overflows.push({path, ov});
  await page.screenshot({ path: SHOT+'/ui-'+name+'.png', fullPage: true });
}
await page.goto('http://127.0.0.1:3216', { waitUntil:'networkidle' });
await page.evaluate(()=>{ localStorage.setItem('alpha_tour_done','x'); localStorage.setItem('alpha_deepdive_coached','x'); });
await page.locator('button:has-text("Explorer la démo")').click().catch(()=>{});
await grab('/', 'dashboard');
await grab('/pipeline', 'pipeline');
await grab('/prospects/p-bouchon', 'fiche');
await grab('/milestones', 'milestones');
await grab('/kpis', 'kpis');
await grab('/campaigns', 'campaigns');
await grab('/offre', 'offre');
await grab('/agent', 'agent');
await grab('/settings', 'settings');
console.log(JSON.stringify(overflows, null, 1));
await browser.close();
