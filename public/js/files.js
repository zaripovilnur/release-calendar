import {
  esc, storage, store, loadState, api, shortDate, linkTag, fileExt, openNav, collapsedNav, navClosed, toggleNav,
  bottomNav, searchBox, chipSelect, ICON, renderKeepingFocus,
} from './common.js';
import { openMaterialModal } from './modal-material.js';

const root = document.getElementById('app');
let state = null;
let materials = [];
let search = '';
let tab = 'all';
let direction = '';
let product = '';
let order = 'new';

const ICON_OPEN = 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5';
const ICON_DOWN = 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14';
const catsOff = () => storage('filesCatsOff', []);

function sidebar() {
  const off = catsOff();
  const cats = state.categories.map((c) => {
    const n = materials.filter((m) => m.category === c).length;
    return `
        <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; min-height: 32px; cursor: pointer;"><input type="checkbox" data-role="cat-filter" data-cat="${esc(c)}"${off.includes(c) ? '' : ' checked'} style="width: 16px; height: 16px; accent-color: #0000FF; flex: none; margin: 0;"><span style="flex: 1; min-width: 0; line-height: 1.3;">${esc(c)}</span><span style="font-size: 13px; color: #5C5C73;">${n}</span></label>`;
  }).join('');
  return `
    <div style="display: flex; flex-direction: column; gap: 8px; padding: 0 8px;">
      <span style="font-size: 13px; font-weight: 500; color: #5C5C73; min-height: 32px; display: flex; align-items: center;">Тип материала</span>${cats}
    </div>`;
}

// Всё, кроме вкладки: категории, поиск, направление, продукт
function filtered() {
  const off = catsOff();
  const q = search.trim().toLowerCase();
  const list = materials.filter((m) => !off.includes(m.category)
    && (!q || m.title.toLowerCase().includes(q))
    && (!direction || m.directionId === Number(direction))
    && (!product || m.productId === Number(product)));
  return order === 'old' ? list.slice().reverse() : list;
}

function row(m) {
  const isFile = m.kind === 'file';
  const badge = isFile ? fileExt(m.title) : linkTag(m.url);
  const note = isFile ? `${m.note ? m.note + ' · ' : ''}версия ${m.version}` : 'Ссылка';
  const action = isFile ? 'Скачать файл' : 'Открыть ссылку';
  return `
          <div style="display: grid; grid-template-columns: 48px minmax(0, 2.4fr) 1fr 1.4fr 1.1fr 48px; gap: 16px; align-items: center; padding: 12px 24px; border-bottom: 1px solid #F2F2FE;">
            <span style="width: 44px; height: 44px; border-radius: 6px; background: #F2F2FE; color: #0000FF; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center;">${esc(badge)}</span>
            <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0;"><span style="font-size: 15px;">${esc(m.title)}</span><span style="font-size: 12px; color: #5C5C73;">${esc(note)}</span></div>
            <span style="font-size: 14px; color: #44445C;">${esc(m.category)}</span>
            <a href="/products/${m.productId}" style="font-size: 16px; font-weight: 300; line-height: 1.25; color: #0000FF; text-decoration: none;">${esc(m.productName)}</a>
            <span style="font-size: 13px; color: #5C5C73;">${shortDate(m.date)} · ${esc(m.author)}</span>
            <button type="button" data-action="${isFile ? 'download' : 'open-link'}" data-id="${m.id}" aria-label="${action}" style="width: 40px; height: 40px; border: 1px solid #E0E0F5; border-radius: 6px; background: #FFFFFF; color: #000000; display: flex; align-items: center; justify-content: center; cursor: pointer;"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${isFile ? ICON_DOWN : ICON_OPEN}"></path></svg></button>
          </div>`;
}

function render() {
  const base = filtered();
  const nLinks = base.filter((m) => m.kind === 'link').length;
  const tabs = [['all', `Все · ${base.length}`], ['link', `Ссылки · ${nLinks}`], ['file', `Файлы · ${base.length - nLinks}`]].map(([key, label]) => {
    const on = key === tab;
    return `
          <button type="button" data-action="tab" data-tab="${key}" aria-pressed="${on}" style="height: 34px; padding: 0 14px; border: 0; border-radius: 6px; font: inherit; font-size: 13px; cursor: pointer; ${on ? 'background: #FFFFFF; color: #0000FF; font-weight: 500;' : 'background: transparent; color: #000000;'}">${label}</button>`;
  }).join('');
  const items = base.filter((m) => tab === 'all' || m.kind === tab);

  const dirOptions = [{ value: '', label: 'все' }, ...state.directions.map((d) => ({ value: d.id, label: d.name }))];
  const prodOptions = [{ value: '', label: 'все' }, ...state.products.filter((p) => !direction || p.directionId === Number(direction)).map((p) => ({ value: p.id, label: p.name }))];
  const label = (opts, v) => (opts.find((o) => String(o.value) === String(v)) || opts[0]).label;
  const orders = [{ value: 'new', label: 'Сначала новые' }, { value: 'old', label: 'Сначала старые' }];

  const nav = navClosed() ? collapsedNav('files') : openNav('files', sidebar(), false);
  const html = `<div class="has-bottom-nav" style="font-family: 'TT Norms Pro', Manrope, system-ui, sans-serif; color: #000000; background: #F2F2FE; display: flex; flex-wrap: wrap; min-height: 1100px; box-sizing: border-box;">
  ${nav}

  <main style="flex: 999 1 560px; min-width: 0; padding: 24px 32px 48px; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px;">
    <header style="background: #FFFFFF; border-radius: 12px; padding: 28px 32px; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 20px;">
      <div style="display: flex; flex-direction: column; gap: 10px; margin-right: auto;">
        <h1 style="margin: 0; font-size: 36px; font-weight: 400; line-height: 1;">Файлы и ссылки</h1>
        <span style="font-size: 15px; color: #44445C;">Все материалы по продуктам в одном месте</span>
      </div>
      ${searchBox('Поиск материала', 'Название файла или ссылки', search, 300)}
      <button type="button" data-action="add-material" style="display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border: 0; border-radius: 8px; background: #0000FF; color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer;">${ICON.plus18}Добавить материал</button>
    </header>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
      <div role="group" aria-label="Вид материалов" style="display: flex; background: #E0E0F5; border-radius: 8px; padding: 4px; gap: 2px;">${tabs}
      </div>
      ${chipSelect('direction', 'Направление: ' + label(dirOptions, direction), dirOptions, direction)}
      ${chipSelect('product', 'Продукт: ' + label(prodOptions, product), prodOptions, product)}
      ${chipSelect('order', label(orders, order), orders, order, ' margin-left: auto;')}
    </div>

    <section aria-label="Материалы" style="background: #FFFFFF; border-radius: 12px; overflow-x: auto;">
      <div style="min-width: 900px;">
        <div style="display: grid; grid-template-columns: 48px minmax(0, 2.4fr) 1fr 1.4fr 1.1fr 48px; gap: 16px; padding: 14px 24px; border-bottom: 1px solid #E0E0F5; font-size: 13px; font-weight: 500; color: #5C5C73;">
          <span></span><span>Название</span><span>Тип</span><span>Продукт</span><span>Добавлено</span><span></span>
        </div>${items.map(row).join('')}
      </div>
    </section>
  </main>
  ${bottomNav('files')}
</div>`;
  renderKeepingFocus(root, html);
}

async function reload() {
  [state, materials] = await Promise.all([loadState(), api('/api/materials')]);
  render();
}

root.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const id = Number(t.dataset.id);
  switch (t.dataset.action) {
    case 'toggle-nav': toggleNav(); render(); break;
    case 'tab': tab = t.dataset.tab; render(); break;
    case 'add-material': openMaterialModal(state, { productId: product ? Number(product) : null, onSaved: reload }); break;
    case 'download': window.location.href = `/api/files/${id}`; break;
    case 'open-link': {
      const m = materials.find((x) => x.id === id);
      if (m) window.open(m.url, '_blank', 'noopener');
      break;
    }
    default: break;
  }
});

root.addEventListener('change', (e) => {
  const t = e.target;
  const role = t.dataset.role;
  if (role === 'cat-filter') {
    const c = t.dataset.cat;
    const off = catsOff();
    store('filesCatsOff', off.includes(c) ? off.filter((x) => x !== c) : [...off, c]);
  } else if (role === 'direction') {
    direction = t.value;
    if (product && !state.products.some((p) => p.id === Number(product) && (!direction || p.directionId === Number(direction)))) product = '';
  } else if (role === 'product') product = t.value;
  else if (role === 'order') order = t.value;
  else return;
  render();
});

root.addEventListener('input', (e) => {
  if (e.target.dataset.role === 'search') {
    search = e.target.value;
    render();
  }
});

reload();
