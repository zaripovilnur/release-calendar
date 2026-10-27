// Визуальные тесты: каждый эталон из design/screens сравнивается с приложением в том же состоянии.
// Снимок эталона делается при каждом запуске и кладётся в tests/__screenshots__, затем с ним
// сравнивается снимок приложения. Допуск — 1 % отличающихся пикселей.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { test, expect } = require('@playwright/test');

const SCREENS = path.join(__dirname, '..', 'design', 'screens');
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const TODAY = new Date('2026-10-27T12:00:00');
const TOLERANCE = { maxDiffPixelRatio: process.env.STRICT ? 0 : 0.01 };

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

// Снимок эталона: вся страница, первый экран телефона или отдельное окно
async function shootReference(browser, file, viewport, { full = true, element = null } = {}) {
  const page = await browser.newPage({ viewport });
  await page.goto(pathToFileURL(path.join(SCREENS, file)).href);
  await settle(page);
  const shot = element ? await page.locator(element).screenshot() : await page.screenshot({ fullPage: full });
  await page.close();
  return shot;
}

function saveReference(testInfo, name, png) {
  const p = testInfo.snapshotPath(name);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, png);
}

async function appPage(browser, viewport, { admin = false } = {}) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.clock.setFixedTime(TODAY);
  if (admin) {
    const r = await page.request.post('/api/auth/login', { data: { login: 'admin', password: 'admin' } });
    expect(r.ok()).toBeTruthy();
  }
  return page;
}

async function productId(page, name) {
  const r = await page.request.get('/api/state');
  return (await r.json()).products.find((p) => p.name === name).id;
}

const CASES = [
  { ref: '01-calendar.html', url: '/' },
  { ref: '01a-calendar-login.html', url: '/', act: (p) => p.getByRole('button', { name: 'Вход для администратора' }).click() },
  { ref: '01b-calendar-admin.html', url: '/', admin: true },
  {
    // В эталоне свёрнуты «Серверы» и «Системы хранения данных»
    ref: '01c-calendar-groups-collapsed.html', url: '/',
    act: async (p) => {
      await p.getByRole('button', { name: /^Серверы/ }).click();
      await p.getByRole('button', { name: /^Системы хранения данных/ }).click();
    },
  },
  { ref: '01d-calendar-nav-collapsed.html', url: '/', act: (p) => p.getByRole('button', { name: 'Свернуть панель' }).click() },
  { ref: '02-products.html', url: '/products' },
  { ref: '02a-products-admin.html', url: '/products', admin: true },
  { ref: '03-files.html', url: '/files' },
  { ref: '03a-files-links-tab.html', url: '/files', act: (p) => p.getByRole('button', { name: /^Ссылки · / }).click() },
  { ref: '04-product.html', url: 'product' },
  {
    ref: '05-product-edit-admin.html', url: '/', admin: true, element: '[role="dialog"]',
    // Окно выше 900 px — берём высоту холста эталона, чтобы окно поместилось целиком
    viewport: { width: 1440, height: 1420 },
    act: (p, id) => p.locator(`[data-action="edit-product"][data-id="${id}"]`).click(),
  },
  {
    ref: '06-add-material.html', url: 'product', element: '[role="dialog"][aria-label="Добавить ссылку"]', name: '06-add-material-link',
    act: async (p) => {
      await p.route('**/api/link-title*', (r) => r.fulfill({ json: { title: 'Макеты и креативы' } }));
      await p.getByRole('button', { name: 'Ссылка', exact: true }).click();
      const url = p.locator('[data-role="url"]');
      await url.fill('https://www.figma.com/file/…');
      await url.dispatchEvent('change');
      await expect(p.getByText('Подставили из ссылки — можно поменять')).toBeVisible();
      await p.locator('[data-role="category"]').selectOption('Макеты');
      await url.focus();
    },
  },
  {
    ref: '06-add-material.html', url: 'product', element: '[role="dialog"][aria-label="Загрузить файл"]', name: '06-add-material-file',
    act: async (p) => {
      await p.getByRole('button', { name: 'Файл', exact: true }).click();
      await p.locator('[data-role="file-input"]').setInputFiles({ name: 'Презентация продукта.pptx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
      await expect(p.getByText('Сохраним его как версию 4')).toBeVisible();
      // Загрузка в процессе: 64 %, как в эталоне. Промежуточное состояние нельзя остановить — выставляем его
      await p.evaluate(() => {
        document.querySelector('[data-role="percent"]').textContent = '64%';
        document.querySelector('[data-role="bar"]').style.width = '64%';
      });
    },
  },
  { ref: '07-mobile-calendar.html', url: '/', phone: true },
  { ref: '07a-mobile-calendar-august.html', url: '/', phone: true, act: (p) => p.getByRole('button', { name: 'Август: 3 в GA' }).click() },
  { ref: '08-mobile-product.html', url: 'product', phone: true },
];

for (const c of CASES) {
  const name = (c.name || c.ref.replace('.html', '')) + '.png';
  test(name.replace('.png', ''), async ({ browser }, testInfo) => {
    const viewport = c.viewport || (c.phone ? PHONE : DESKTOP);
    const refOptions = { full: !c.phone, element: c.element || null };
    saveReference(testInfo, name, await shootReference(browser, c.ref, viewport, refOptions));

    const page = await appPage(browser, viewport, { admin: c.admin });
    // Все эталоны показывают TATLIN.UNIFIED G3 — у него демо-материалы
    const id = await productId(page, 'TATLIN.UNIFIED G3');
    await page.goto(c.url === 'product' ? `/products/${id}` : c.url);
    await settle(page);
    if (c.act) {
      await c.act(page, id);
      await settle(page);
    }
    const shot = c.element
      ? await page.locator(c.element).screenshot()
      : await page.screenshot({ fullPage: !c.phone });
    expect(shot).toMatchSnapshot(name, TOLERANCE);
    await page.context().close();
  });
}
