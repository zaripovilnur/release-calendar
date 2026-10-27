import {
  MGEN, KEY_PRE, KEY_SUPPORT, esc, capitalize, pluralProducts, pluralDirections, storage, store,
  loadState, gaStage, stageOf, selectedYear, monthName, rangeName, materialsText, ICON, openNav, collapsedNav,
  navClosed, toggleNav, bottomNav, searchBox, chipSelect, addProductButton, editProductButton, loginModal,
  wireLogin, focusLogin, renderKeepingFocus,
} from './common.js';
import { openProductModal } from './modal-product.js';
import { openMaterialModal } from './modal-material.js';

const root = document.getElementById('app');
let state = null;
let year = null;
let search = '';
let showLogin = false;

const SORTS = [{ value: 'ga', label: 'по дате GA' }, { value: 'name', label: 'по названию' }];
const dirsOff = () => storage('productsDirsOff', []);

function sidebar() {
  const off = dirsOff();
  const dirs = state.directions.map((d) => {
    const n = state.products.filter((p) => p.directionId === d.id).length;
    return `
        <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; min-height: 32px; cursor: pointer;"><input type="checkbox" data-role="dir-filter" data-id="${d.id}"${off.includes(d.id) ? '' : ' checked'} style="width: 16px; height: 16px; accent-color: #0000FF; flex: none; margin: 0;"><span style="flex: 1; min-width: 0; line-height: 1.3;">${esc(d.name)}</span><span style="font-size: 13px; color: #5C5C73;">${n}</span></label>`;
  }).join('');
  const loginBtn = state.isAdmin ? '' : `
          <button type="button" data-action="open-login" aria-label="Режим администратора: добавить или изменить продукты" style="width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: #5C5C73; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.pencil}</button>`;
  return `
    <div style="display: flex; flex-direction: column; gap: 8px; padding: 0 8px;">
      <div style="display: flex; align-items: center; min-height: 32px;">
        <span style="font-size: 13px; font-weight: 500; color: #5C5C73; margin-right: auto;">Направления</span>${loginBtn}
      </div>${dirs}
    </div>
    <div style="display: flex; flex-direction: column; gap: 8px; padding: 0 8px;">
      <span style="font-size: 13px; font-weight: 500; color: #5C5C73; min-height: 32px; display: flex; align-items: center;">Материалы</span>
      <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; min-height: 32px; cursor: pointer;"><input type="checkbox" data-role="no-materials"${storage('productsNoMaterials', false) ? ' checked' : ''} style="width: 16px; height: 16px; accent-color: #0000FF; flex: none; margin: 0;">Только без материалов</label>
    </div>`;
}

function sortProducts(list) {
  const by = storage('productsSort', 'ga');
  return list.sort((a, b) => {
    if (by === 'name') return a.name.localeCompare(b.name, 'ru');
    const ga = gaStage(state, a), gb = gaStage(state, b);
    const ka = ga ? ga.from : '9999-99', kb = gb ? gb.from : '9999-99';
    return ka < kb ? -1 : ka > kb ? 1 : a.id - b.id;
  });
}

const GREY = '<span style="color: #5C5C73;">нет этапа</span>';

function rows() {
  const off = dirsOff();
  const noMat = storage('productsNoMaterials', false);
  const q = search.trim().toLowerCase();
  const admin = state.isAdmin;
  let html = '';
  for (const d of state.directions) {
    if (off.includes(d.id)) continue;
    const items = sortProducts(state.products.filter((p) => p.directionId === d.id
      && (!q || p.name.toLowerCase().includes(q)) && (!noMat || !(p.links + p.files))));
    if (!items.length && !(admin && !q && !noMat)) continue;
    html += `
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px 24px; min-height: 48px; box-sizing: border-box; background: #F2F2FE; border-bottom: 1px solid #E0E0F5;"><span style="font-size: 15px; font-weight: 500;">${esc(d.name)}</span><span style="font-size: 13px; color: #44445C; margin-right: auto;">${pluralProducts(items.length)}</span>${admin ? `
              <button type="button" data-action="new-product" data-direction="${d.id}" style="display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 8px; border: 0; border-radius: 6px; background: transparent; color: #0000FF; font: inherit; font-size: 13px; cursor: pointer;">${ICON.plus14}Продукт в направление</button>` : ''}
            </div>`;
    for (const p of items) {
      const pre = stageOf(state, p, KEY_PRE);
      const ga = gaStage(state, p);
      const sup = stageOf(state, p, KEY_SUPPORT);
      const mat = materialsText(p.links, p.files);
      html += `
            <div style="display: grid; grid-template-columns: minmax(0, 2.2fr) 1.4fr 1fr 1.3fr 1.4fr; gap: 16px; align-items: center; padding: 14px 24px; border-bottom: 1px solid #F2F2FE; font-size: 14px; min-height: 56px; box-sizing: border-box;">
              <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
                <a href="/products/${p.id}" style="font-size: 16px; font-weight: 300; line-height: 1.25; color: #000000; text-decoration: none; margin-right: auto;">${esc(p.name)}</a>${admin ? editProductButton(p.id) : ''}
              </div>
              ${pre ? `<span style="color: #0000FF;">${esc(rangeName(pre, year))}</span>` : GREY}
              ${ga ? `<span style="justify-self: start; font-size: 13px; padding: 5px 10px; border-radius: 4px; background: #0000FF; color: #FFFFFF;">${esc(capitalize(monthName(ga.from, year)))}</span>` : GREY}
              ${sup ? `<span style="color: #44445C;">с ${esc(monthName(sup.from, year, MGEN))}</span>` : GREY}
              ${mat ? `<a href="/products/${p.id}" style="color: #000000; text-decoration: none;">${mat}</a>` : `<button type="button" data-action="add-material" data-id="${p.id}" style="display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; background: transparent; font: inherit; color: #0000FF; font-weight: 500; cursor: pointer;">${ICON.plus14}Добавить</button>`}
            </div>`;
    }
  }
  return html;
}

function render() {
  const dirsUsed = new Set(state.products.map((p) => p.directionId)).size;
  const nav = navClosed() ? collapsedNav('products') : openNav('products', sidebar(), state.isAdmin);
  const html = `<div class="has-bottom-nav" style="font-family: 'TT Norms Pro', Manrope, system-ui, sans-serif; color: #000000; background: #F2F2FE; display: flex; flex-wrap: wrap; min-height: 1100px; box-sizing: border-box; position: relative;">
  ${nav}

  <main style="flex: 999 1 560px; min-width: 0; padding: 24px 32px 48px; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px;">
    <header style="background: #FFFFFF; border-radius: 12px; padding: 28px 32px; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 20px;">
      <div style="display: flex; flex-direction: column; gap: 10px; margin-right: auto;">
        <h1 style="margin: 0; font-size: 36px; font-weight: 400; line-height: 1;">Все продукты</h1>
        <span style="font-size: 15px; color: #44445C;">${pluralProducts(state.products.length)} · ${pluralDirections(dirsUsed)} · сроки на ${year} год</span>
      </div>
      ${searchBox('Поиск продукта', 'Найти продукт', search)}
      ${state.isAdmin ? addProductButton() : ''}
    </header>

    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
      ${chipSelect('sort', 'Сортировка: ' + SORTS.find((s) => s.value === storage('productsSort', 'ga')).label, SORTS, storage('productsSort', 'ga'))}
    </div>

    <section aria-label="Список продуктов" style="background: #FFFFFF; border-radius: 12px; overflow-x: auto;">
      <div style="min-width: 900px;">
        <div style="display: grid; grid-template-columns: minmax(0, 2.2fr) 1.4fr 1fr 1.3fr 1.4fr; gap: 16px; padding: 14px 24px; border-bottom: 1px solid #E0E0F5; font-size: 13px; font-weight: 500; color: #5C5C73;">
          <span>Продукт</span><span>Pre-GA</span><span>GA</span><span>Поддержка продаж</span><span>Материалы</span>
        </div>${rows()}
      </div>
    </section>
  </main>
${showLogin ? loginModal('Добавлять и изменять продукты, направления и статусы могут только администраторы', '-p') : ''}
  ${bottomNav('products')}
</div>`;
  renderKeepingFocus(root, html);
}

async function reload() {
  state = await loadState();
  year = selectedYear(state);
  if (!SORTS.some((s) => s.value === storage('productsSort', 'ga'))) store('productsSort', 'ga');
  render();
}

root.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  switch (t.dataset.action) {
    case 'toggle-nav': toggleNav(); render(); break;
    case 'new-product': openProductModal(state, { year, directionId: t.dataset.direction ? Number(t.dataset.direction) : null, onSaved: reload }); break;
    case 'edit-product': openProductModal(state, { year, productId: Number(t.dataset.id), onSaved: reload }); break;
    case 'add-material': openMaterialModal(state, { productId: Number(t.dataset.id), tab: 'link', onSaved: reload }); break;
    default: break;
  }
});

root.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.role === 'dir-filter') {
    const id = Number(t.dataset.id);
    const off = dirsOff();
    store('productsDirsOff', off.includes(id) ? off.filter((x) => x !== id) : [...off, id]);
    render();
  } else if (t.dataset.role === 'no-materials') {
    store('productsNoMaterials', t.checked);
    render();
  } else if (t.dataset.role === 'sort') {
    store('productsSort', t.value);
    render();
  }
});

root.addEventListener('input', (e) => {
  if (e.target.dataset.role === 'search') {
    search = e.target.value;
    render();
  }
});

wireLogin(root, {
  openLogin() { showLogin = true; render(); focusLogin(root); },
  closeLogin() { showLogin = false; render(); },
  reload,
});

reload();
