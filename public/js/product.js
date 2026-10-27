import {
  MSHORT, MGEN, MLOWER, KEY_PRE, KEY_SUPPORT, esc, plural, ym, today, api, isMobile, onMobileChange,
  loadState, gaStage, stageOf, selectedYear, monthName, rangeName, swatchCss, shortDate, linkTag, fileExt,
  stripExt, collapsedNav, ICON,
} from './common.js';
import { openMaterialModal } from './modal-material.js';

const root = document.getElementById('app');
const productId = Number(location.pathname.split('/').pop());
let state = null;
let product = null;
let details = null;

function countdown(ga) {
  const now = today();
  const { y, m } = ym(ga.from);
  const diff = (y - now.y) * 12 + (m - now.m);
  if (diff > 0) return 'через ' + plural(diff, 'месяц', 'месяца', 'месяцев');
  if (diff === 0) return 'в этом месяце';
  return 'вышел';
}

function initials(name) {
  return name.split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, '')).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

function contact(url) {
  const u = url.trim();
  if (/t\.me\/|telegram/i.test(u)) return { channel: 'Telegram', aria: 'Написать в Telegram', href: /^https?:\/\//i.test(u) ? u : 'https://' + u };
  if (/^mailto:/i.test(u) || u.includes('@')) return { channel: 'Почта', aria: 'Написать на почту', href: /^mailto:/i.test(u) ? u : 'mailto:' + u };
  return { channel: 'Написать', aria: 'Написать', href: u };
}

// Год, на который показываются сроки карточки: год выхода в GA, иначе выбранный
function cardYear() {
  const ga = gaStage(state, product);
  return ga ? ym(ga.from).y : selectedYear(state);
}

function strip(year, height) {
  return product.stages.map((st) => {
    const s = state.statusById[st.statusId];
    const a = ym(st.from), b = ym(st.to);
    if (!s || a.y > year || b.y < year) return '';
    const from = a.y < year ? 1 : a.m, to = b.y > year ? 12 : b.m;
    return `
            <div style="grid-column: ${from} / ${to + 1}; height: ${height}px; border-radius: 2px; ${swatchCss(s)}"></div>`;
  }).join('');
}

const pinnedLinks = () => details.materials.filter((m) => m.kind === 'link' && m.pinned);
const files = () => details.materials.filter((m) => m.kind === 'file');

// ---------- Компьютер ----------

function renderDesktop() {
  const year = cardYear();
  const dir = state.directionById[product.directionId];
  const pre = stageOf(state, product, KEY_PRE);
  const ga = gaStage(state, product);
  const sup = stageOf(state, product, KEY_SUPPORT);

  const plaques = [
    pre ? `<div style="background: #F2F2FE; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 13px; color: #44445C;">Pre-GA</span><span style="font-size: 20px;">${esc(rangeName(pre, year))}</span></div>` : '',
    ga ? `<div style="background: #0000FF; color: #FFFFFF; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 13px;">Выход в GA</span><span style="font-size: 20px;">${esc(monthName(ga.from, null))}</span><span style="font-size: 13px;">${countdown(ga)}</span></div>` : '',
    sup ? `<div style="background: #F2F2FE; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 6px;"><span style="font-size: 13px; color: #44445C;">Поддержка продаж</span><span style="font-size: 20px;">с ${esc(monthName(sup.from, year, MGEN))}</span></div>` : '',
  ].filter(Boolean).join('\n          ');

  const pins = pinnedLinks().map((m) => `
                <a href="${esc(m.url)}" target="_blank" rel="noopener" style="display: flex; flex-direction: column; gap: 10px; background: #F2F2FE; border-radius: 8px; padding: 16px; color: #000000; text-decoration: none;">
                  <div style="display: flex; align-items: center; justify-content: space-between;"><span style="font-size: 12px; font-weight: 500; color: #0000FF;">${esc(m.category)}</span>${ICON.arrowUpRight14}</div>
                  <span style="font-size: 15px;">${esc(m.title)}</span>
                  <span style="font-size: 12px; color: #5C5C73;">${esc(m.note || 'обновлено ' + shortDate(m.date))}</span>
                </a>`).join('');

  const fileRows = files().map((m) => `
                <div style="display: grid; grid-template-columns: 44px minmax(0, 1fr) auto 40px; gap: 14px; align-items: center; padding: 12px 0; border-bottom: 1px solid #F2F2FE;">
                  <span style="width: 44px; height: 44px; border-radius: 6px; background: #F2F2FE; color: #0000FF; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center;">${esc(fileExt(m.title))}</span>
                  <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0;"><span style="font-size: 15px;">${esc(m.title)}</span><span style="font-size: 12px; color: #5C5C73;">${esc((m.note ? m.note + ' · ' : '') + 'версия ' + m.version)}</span></div>
                  <span style="font-size: 13px; color: #5C5C73; white-space: nowrap;">${shortDate(m.date)} · ${esc(m.author)}</span>
                  <button type="button" data-action="download" data-id="${m.id}" aria-label="Скачать файл" style="width: 40px; height: 40px; border: 1px solid #E0E0F5; border-radius: 6px; background: #FFFFFF; color: #000000; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.download18}</button>
                </div>`).join('');

  const team = details.team.map((m) => {
    const c = contact(m.contactUrl);
    return `
                <div style="display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #F2F2FE;">
                  <span style="flex: none; width: 36px; height: 36px; border-radius: 18px; background: #E0E0F5; color: #000000; font-size: 12px; display: flex; align-items: center; justify-content: center;">${esc(initials(m.fullName))}</span>
                  <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; margin-right: auto;"><span style="font-size: 15px; line-height: 1.3;">${esc(m.fullName)}</span><span style="font-size: 13px; color: #5C5C73;">${esc(m.role)}</span></div>${m.contactUrl ? `
                  <a href="${esc(c.href)}" target="_blank" rel="noopener" aria-label="${c.aria}" style="flex: none; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 6px; background: #F2F2FE; color: #0000FF; font-size: 13px; text-decoration: none;"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4 3 11l7 2.5L12.5 21 21 4Z"></path><path d="m10 13.5 4-4"></path></svg>${c.channel}</a>` : ''}
                </div>`;
  }).join('');

  const history = details.history.map((h, i) => `
              <div style="display: flex; gap: 12px;"><span style="flex: none; width: 8px; height: 8px; margin-top: 6px; background: ${i === 0 ? '#0000FF' : '#C9C9EA'};"></span><span>${esc(h.text)}<br><span style="color: #5C5C73; font-size: 13px;">${h.reason ? esc(h.reason) + ' · ' : ''}${shortDate(h.date)}, ${esc(h.author)}</span></span></div>`).join('');

  const addButton = (action, label) => `<button type="button" data-action="${action}" style="display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px; box-sizing: content-box; border: 1px solid #8A8AC2; border-radius: 8px; background: #FFFFFF; color: #000000; font: inherit; font-size: 14px; cursor: pointer;">${ICON.plus16}${label}</button>`;

  root.innerHTML = `<div style="font-family: 'TT Norms Pro', Manrope, system-ui, sans-serif; color: #000000; background: #F2F2FE; display: flex; flex-wrap: wrap; min-height: 1300px; box-sizing: border-box;">

  ${collapsedNav('products', false)}

  <main style="flex: 999 1 560px; min-width: 0; padding: 24px 32px 48px; box-sizing: border-box;">
    <div style="max-width: 1280px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px;">

      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 14px; color: #44445C;">
        <a href="/products" style="display: inline-flex; align-items: center; gap: 6px; color: #0000FF; text-decoration: none;"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m15 6-6 6 6 6"></path></svg>Все продукты</a>
      </div>

      <header style="position: relative; overflow: hidden; background: #FFFFFF; border-radius: 12px; padding: 32px; display: flex; flex-direction: column; gap: 24px;">
        <svg aria-hidden="true" style="position: absolute; right: 0; top: 0; height: 100%; width: 520px;" viewBox="0 0 520 250" preserveAspectRatio="xMaxYMid slice">
          <defs>
            <pattern id="tri-prod" width="60" height="103.92" patternUnits="userSpaceOnUse" x="520"><path d="M0 0L60 103.92M60 0L0 103.92M0 0H60M0 51.96H60" fill="none" stroke="#0000FF" stroke-width="1"></path></pattern>
            <linearGradient id="fade-prod" x1="0" x2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="0.8" stop-color="#FFFFFF" stop-opacity="1"></stop></linearGradient>
            <mask id="mask-prod"><rect width="520" height="250" fill="url(#fade-prod)"></rect></mask>
          </defs>
          <rect width="520" height="250" fill="url(#tri-prod)" mask="url(#mask-prod)" opacity="0.5"></rect>
        </svg>
        <div style="position: relative; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px;">
          <div style="display: flex; flex-direction: column; gap: 12px; margin-right: auto;">
            <span style="font-size: 14px; color: #44445C;">${esc(dir ? dir.name : '')}</span>
            <h1 style="margin: 0; font-size: 48px; font-weight: 300; line-height: 1;">${esc(product.name)}</h1>${product.description ? `
            <span style="font-size: 15px; color: #44445C; max-width: 560px; line-height: 1.5;">${esc(product.description)}</span>` : ''}
          </div>
          <button type="button" data-action="copy-link" style="display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px; border: 1px solid #8A8AC2; border-radius: 8px; background: #FFFFFF; font: inherit; font-size: 14px; color: #000000; cursor: pointer;"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"></path><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"></path></svg>Скопировать ссылку</button>
        </div>${plaques ? `
        <div style="position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
          ${plaques}
        </div>` : ''}
        <div style="position: relative; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 2px;">${strip(year, 12)}
          </div>
          <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 2px; font-size: 12px; color: #5C5C73; text-align: center;">
            ${MSHORT.map((n) => `<span>${n}</span>`).join('')}
          </div>
        </div>
      </header>

      <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start;">
        <div style="flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 20px;">

          <section style="background: #FFFFFF; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 400; margin-right: auto;">Закреплённые ссылки</h2>
              ${addButton('add-link', 'Ссылка')}
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px;">${pins}
            </div>
          </section>

          <section style="background: #FFFFFF; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <h2 style="margin: 0; font-size: 22px; font-weight: 400; margin-right: auto;">Файлы</h2>
              ${addButton('add-file', 'Файл')}
            </div>
            <div style="display: flex; flex-direction: column;">${fileRows}
            </div>
            <div data-role="dropzone" style="border: 1.5px dashed #9999E0; border-radius: 8px; padding: 22px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;">
              <span style="font-size: 15px;">Перетащите файлы сюда</span>
              <span style="font-size: 13px; color: #5C5C73;">Файл с тем же именем станет новой версией, старая останется в истории</span>
            </div>
          </section>
        </div>

        <aside style="flex: 1 1 320px; max-width: 400px; min-width: 0; display: flex; flex-direction: column; gap: 20px;">
          <section style="background: #FFFFFF; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 14px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 400;">Команда</h2>
            <div style="display: flex; flex-direction: column;">${team}
            </div>
            <span style="font-size: 12px; color: #5C5C73; line-height: 1.4;">Команду меняет администратор в форме продукта</span>
          </section>
          <section style="background: #FFFFFF; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; gap: 14px;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 400;">История сроков</h2>
            <div style="display: flex; flex-direction: column; gap: 14px; font-size: 14px; line-height: 1.45;">${history}
            </div>
          </section>
        </aside>
      </div>
    </div>
  </main>
</div>`;
}

// ---------- Телефон ----------

function renderMobile() {
  const year = cardYear();
  const dir = state.directionById[product.directionId];
  const pre = stageOf(state, product, KEY_PRE);
  const ga = gaStage(state, product);
  const sup = stageOf(state, product, KEY_SUPPORT);
  const plaque = (label, value, blue) => blue
    ? `<div style="background: #0000FF; color: #FFFFFF; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px;"><span style="font-size: 11px;">${label}</span><span style="font-size: 14px;">${esc(value)}</span></div>`
    : `<div style="background: #F2F2FE; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 4px;"><span style="font-size: 11px; color: #44445C;">${label}</span><span style="font-size: 14px;">${esc(value)}</span></div>`;
  const plaques = [
    pre ? plaque('Pre-GA', rangeName(pre, year, MLOWER), false) : '',
    ga ? plaque('GA', monthName(ga.from, year), true) : '',
    sup ? plaque('Поддержка', 'с ' + monthName(sup.from, year, MGEN), false) : '',
  ].filter(Boolean).join('\n      ');
  const links = pinnedLinks().map((m) => `
      <a href="${esc(m.url)}" target="_blank" rel="noopener" style="background: #FFFFFF; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; color: #000000; text-decoration: none; min-height: 56px; box-sizing: border-box;">
        <span style="flex: none; width: 40px; height: 40px; border-radius: 6px; background: #F2F2FE; color: #0000FF; font-size: 10px; font-weight: 500; display: flex; align-items: center; justify-content: center;">${esc(linkTag(m.url))}</span>
        <span style="font-size: 15px; margin-right: auto;">${esc(m.title)}</span>
        ${ICON.arrowUpRight16}
      </a>`).join('');
  const fileRows = files().map((m) => `
      <div style="background: #FFFFFF; border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; gap: 12px; min-height: 56px; box-sizing: border-box;">
        <span style="flex: none; width: 40px; height: 40px; border-radius: 6px; background: #F2F2FE; color: #0000FF; font-size: 10px; font-weight: 500; display: flex; align-items: center; justify-content: center;">${esc(fileExt(m.title))}</span>
        <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0; margin-right: auto;"><span style="font-size: 15px;">${esc(stripExt(m.title))}</span><span style="font-size: 12px; color: #5C5C73;">версия ${m.version} · ${shortDate(m.date)}</span></div>
        <button type="button" data-action="download" data-id="${m.id}" aria-label="Скачать файл" style="flex: none; width: 40px; height: 40px; border: 1px solid #E0E0F5; border-radius: 6px; background: #FFFFFF; color: #000000; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.download16}</button>
      </div>`).join('');

  root.innerHTML = `<div style="width: 100%; min-height: 100vh; min-height: 100dvh; box-sizing: border-box; font-family: 'TT Norms Pro', Manrope, system-ui, sans-serif; color: #000000; background: #F2F2FE; display: flex; flex-direction: column;">
  <div style="background: #FFFFFF; padding: 52px 20px 20px; display: flex; flex-direction: column; gap: 14px;">
    <a href="/" style="align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; height: 44px; margin: -10px 0 -6px -6px; padding: 0 6px; color: #0000FF; font-size: 15px; text-decoration: none;"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m15 6-6 6 6 6"></path></svg>Календарь</a>
    <div style="display: flex; flex-direction: column; gap: 6px;">
      <span style="font-size: 13px; color: #44445C;">${esc(dir ? dir.name : '')}</span>
      <h1 style="margin: 0; font-size: 30px; font-weight: 300; line-height: 1.05;">${esc(product.name)}</h1>
    </div>${plaques ? `
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px;">
      ${plaques}
    </div>` : ''}
    <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 2px;">${strip(year, 8)}
    </div>
  </div>

  <div style="flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
    <div style="display: flex; align-items: center; padding: 0 2px;"><span style="font-size: 18px; margin-right: auto;">Ссылки</span><button type="button" data-action="add-link" aria-label="Добавить материал" style="width: 40px; height: 40px; padding: 0; border: 0; border-radius: 8px; background: #0000FF; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer;"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg></button></div>${links}
    <span style="font-size: 18px; padding: 8px 2px 0;">Файлы</span>${fileRows}
  </div>
</div>`;
}

function render() {
  if (isMobile()) renderMobile();
  else renderDesktop();
}

async function reload() {
  try {
    [state, details] = await Promise.all([loadState(), api(`/api/products/${productId}`)]);
  } catch {
    location.replace('/products');
    return;
  }
  product = state.products.find((p) => p.id === productId);
  document.title = product.name;
  render();
}

function openMaterial(tab, dropped = []) {
  openMaterialModal(state, { productId, tab, files: dropped, onSaved: reload });
}

root.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  switch (t.dataset.action) {
    case 'add-link': openMaterial('link'); break;
    case 'add-file': openMaterial('file'); break;
    case 'download': window.location.href = `/api/files/${t.dataset.id}`; break;
    case 'copy-link':
      try {
        await navigator.clipboard.writeText(location.href);
      } catch {
        const ta = document.createElement('textarea');
        ta.value = location.href;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      break;
    default: break;
  }
});

root.addEventListener('dragover', (e) => {
  if (e.target.closest('[data-role="dropzone"]')) e.preventDefault();
});
root.addEventListener('drop', (e) => {
  if (!e.target.closest('[data-role="dropzone"]')) return;
  e.preventDefault();
  if (e.dataTransfer.files.length) openMaterial('file', [...e.dataTransfer.files]);
});

onMobileChange(render);
reload();
