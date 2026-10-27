import {
  MSHORT, MNOM, MGEN, KEY_PRE, KEY_SUPPORT, esc, pluralProducts, pluralDirections, ym, today, storage, store, api,
  isMobile, onMobileChange, loadState, gaStage, stageOf, inYear, selectedYear, setYear, rangeName,
  statusCss, swatchCss, contrastText, ICON, openNav, collapsedNav, navClosed, toggleNav, bottomNav, searchBox,
  addProductButton, editProductButton, loginModal, wireLogin, focusLogin, renderKeepingFocus,
} from './common.js';
import { openProductModal } from './modal-product.js';

const root = document.getElementById('app');
let state = null;
let year = null;
let search = '';
let showLogin = false;
let mobileMonth = null;

const dirFilter = () => storage('calendarDirsOff', []);
const collapsedGroups = () => storage('calendarCollapsed', []);

// Этап, обрезанный по выбранному году: месяцы 1..12
function clip(st) {
  const a = ym(st.from), b = ym(st.to);
  if (a.y > year || b.y < year) return null;
  return { from: a.y < year ? 1 : a.m, to: b.y > year ? 12 : b.m };
}

function gaMonth(p) {
  const ga = gaStage(state, p);
  if (!ga) return null;
  const { y, m } = ym(ga.from);
  return y === year ? m : null;
}

function yearProducts() {
  return state.products.filter((p) => inYear(p, year))
    .sort((a, b) => (gaMonth(a) || 13) - (gaMonth(b) || 13) || a.id - b.id);
}

// План для карточек «Ближайшие выходы в GA»
function planText(p) {
  const pre = stageOf(state, p, KEY_PRE);
  const sup = stageOf(state, p, KEY_SUPPORT);
  const first = pre ? `Pre-GA: ${rangeName(pre, ym(pre.from).y)}` : 'Без этапа Pre-GA';
  return first + (sup ? '. После GA — поддержка продаж' : '');
}

// ---------- Телефон ----------

function renderMobile() {
  const products = yearProducts();
  const byMonth = {};
  for (const p of products) {
    const m = gaMonth(p);
    if (m) (byMonth[m] = byMonth[m] || []).push(p);
  }
  const months = Object.keys(byMonth).map(Number).sort((a, b) => a - b);
  if (!months.includes(mobileMonth)) {
    const now = today();
    const next = months.find((m) => year > now.y || (year === now.y && m >= now.m));
    mobileMonth = next != null ? next : months[0];
  }
  const chips = months.map((m) => {
    const on = m === mobileMonth;
    const n = byMonth[m].length;
    const dot = `<span style="width: 5px; height: 5px; border-radius: 1px; background: ${on ? '#0000FF' : '#FFFFFF'};"></span>`;
    return `<button type="button" data-action="pick-month" data-month="${m}" aria-pressed="${on}" aria-label="${MNOM[m - 1].charAt(0).toUpperCase() + MNOM[m - 1].slice(1)}: ${n} в GA" style="flex: 1; min-width: 0; height: 52px; border: 0; border-radius: 8px; font: inherit; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 0; cursor: pointer; ${on ? 'background: #FFFFFF; color: #0000FF; font-weight: 500;' : 'background: rgba(255,255,255,0.14); color: #FFFFFF;'}"><span style="font-size: 13px;">${MSHORT[m - 1]}</span><span style="display: flex; gap: 3px; height: 5px;">${dot.repeat(n)}</span></button>`;
  }).join('\n      ');
  const items = (byMonth[mobileMonth] || []).map((p) => {
    const pre = stageOf(state, p, KEY_PRE);
    const dir = state.directionById[p.directionId];
    const meta = `${dir ? dir.name : ''} · ${pre ? 'Pre-GA ' + rangeName(pre, ym(pre.from).y) : 'без этапа Pre-GA'}`;
    return `<a href="/products/${p.id}" style="background: #FFFFFF; border-radius: 10px; padding: 14px 16px; display: flex; align-items: center; gap: 12px; color: #000000; text-decoration: none; min-height: 64px; box-sizing: border-box;">
        <div style="display: flex; flex-direction: column; gap: 4px; min-width: 0; margin-right: auto;"><span style="font-size: 16px; font-weight: 300; line-height: 1.25;">${esc(p.name)}</span><span style="font-size: 13px; color: #5C5C73; line-height: 1.35;">${esc(meta)}</span></div>
        <svg aria-hidden="true" style="flex: none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0000FF" stroke-width="2" stroke-linecap="round"><path d="m9 6 6 6-6 6"></path></svg>
      </a>`;
  }).join('\n    ');
  const title = mobileMonth ? `${MNOM[mobileMonth - 1].charAt(0).toUpperCase() + MNOM[mobileMonth - 1].slice(1)} — выход в GA` : '';
  root.innerHTML = `<div style="width: 100%; min-height: 100vh; min-height: 100dvh; box-sizing: border-box; font-family: 'TT Norms Pro', Manrope, system-ui, sans-serif; color: #000000; background: #F2F2FE; display: flex; flex-direction: column;">
  <div style="position: relative; overflow: hidden; background: #0000FF; color: #FFFFFF; padding: 56px 20px 20px; display: flex; flex-direction: column; gap: 18px;">
    <svg aria-hidden="true" style="position: absolute; right: 0; top: 0;" width="240" height="210" viewBox="0 0 240 210">
      <defs><pattern id="tri-mob" width="60" height="103.92" patternUnits="userSpaceOnUse" x="240"><path d="M0 0L60 103.92M60 0L0 103.92M0 0H60M0 51.96H60" fill="none" stroke="#F2F2FE" stroke-width="1"></path></pattern>
      <linearGradient id="fade-mob" x1="0" x2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="0.85" stop-color="#FFFFFF" stop-opacity="1"></stop></linearGradient>
      <mask id="mask-mob"><rect width="240" height="210" fill="url(#fade-mob)"></rect></mask></defs>
      <rect width="240" height="210" fill="url(#tri-mob)" mask="url(#mask-mob)" opacity="0.45"></rect>
    </svg>
    <img src="/assets/yadro-logo-white.png" alt="YADRO" style="position: relative; width: 84px; height: auto;">
    <div style="position: relative; display: flex; flex-direction: column; gap: 6px;">
      <h1 style="margin: 0; font-size: 30px; font-weight: 400; line-height: 1;">Выходы в GA</h1>
      <span style="font-size: 14px;">${year} · ${pluralProducts(products.length)}</span>
    </div>
    <div style="position: relative; display: flex; gap: 6px; overflow: hidden;">
      ${chips}
    </div>
  </div>

  <div style="flex: 1; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
    <span style="font-size: 13px; font-weight: 500; color: #44445C; padding: 4px 2px 0;">${title}</span>
    ${items}
  </div>

  ${bottomNav('calendar', 'sticky')}
</div>`;
}

// ---------- Компьютер ----------

function sidebarSections(products) {
  const admin = state.isAdmin;
  const off = dirFilter();
  const loginBtn = (what) => `
          <button type="button" data-action="open-login" aria-label="Редактировать ${what} (вход для администратора)" style="width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: #5C5C73; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.pencil}</button>`;
  const smallBtn = (action, id, label, icon) => `<button type="button" data-action="${action}" data-id="${id}" aria-label="${label}" style="flex: none; width: 32px; height: 32px; border: 0; border-radius: 6px; background: transparent; color: #44445C; display: flex; align-items: center; justify-content: center; cursor: pointer;">${icon}</button>`;
  const addRow = (role, label, btnLabel) => `
      <div style="display: flex; gap: 6px; margin-top: 4px;">
        <label style="flex: 1; min-width: 0;"><span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);">${label}</span><input type="text" data-role="${role}" placeholder="${label}" style="width: 100%; box-sizing: border-box; height: 36px; border: 1px solid #8A8AC2; border-radius: 6px; padding: 0 10px; font: inherit; font-size: 13px; color: #000000;"></label>
        <button type="button" data-action="${role}" aria-label="${btnLabel}" style="flex: none; width: 36px; height: 36px; border: 0; border-radius: 6px; background: #0000FF; color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.plus16w}</button>
      </div>`;

  const dirs = state.directions.map((d) => {
    const n = products.filter((p) => p.directionId === d.id).length;
    const tail = admin
      ? `${smallBtn('rename-direction', d.id, 'Переименовать направление', ICON.pencil)}
          ${smallBtn('delete-direction', d.id, 'Удалить направление', ICON.trash)}`
      : `<span style="font-size: 13px; color: #5C5C73; padding-left: 6px;">${n}</span>`;
    return `
        <div style="display: flex; align-items: center; gap: 2px; min-height: 32px;">
          <label style="display: flex; align-items: center; gap: 10px; font-size: 14px; flex: 1; min-width: 0; cursor: pointer;"><input type="checkbox" data-role="dir-filter" data-id="${d.id}"${off.includes(d.id) ? '' : ' checked'} style="width: 16px; height: 16px; accent-color: #0000FF; flex: none; margin: 0;"><span style="flex: 1; min-width: 0; line-height: 1.3;">${esc(d.name)}</span></label>
          ${tail}
        </div>`;
  }).join('');

  const statuses = state.statuses.map((s) => {
    const sw = admin
      ? `<button type="button" data-action="status-color" data-id="${s.id}" aria-label="Изменить цвет статуса" style="flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 4px; outline: 2px solid #8A8AC2; outline-offset: 2px; cursor: pointer; ${swatchCss(s)}"></button><input type="color" class="color-input" data-role="status-color" data-id="${s.id}" tabindex="-1" aria-hidden="true" value="${(s.border || s.background).toLowerCase()}">`
      : `<span style="flex: none; width: 16px; height: 16px; border-radius: 3px; ${swatchCss(s)}"></span>`;
    const tail = admin ? `
          ${smallBtn('rename-status', s.id, 'Переименовать статус', ICON.pencil)}
          ${smallBtn('delete-status', s.id, 'Удалить статус', ICON.trash)}` : '';
    return `
        <div style="display: flex; align-items: center; gap: 2px; min-height: 32px;">
          ${sw}
          <span style="flex: 1; min-width: 0; font-size: 14px; line-height: 1.3; padding-left: 10px;">${esc(s.name)}</span>${tail}
        </div>`;
  }).join('');

  const gaCount = Array(12).fill(0);
  for (const p of products) { const m = gaMonth(p); if (m) gaCount[m - 1]++; }
  const grid = MSHORT.map((n, i) => {
    const c = gaCount[i];
    const dots = '<span style="width: 6px; height: 6px; background: #0000FF; border-radius: 1px;"></span>'.repeat(c);
    return `
          <div role="img" aria-label="${MNOM[i]}: ${c ? pluralProducts(c) + ' в GA' : 'нет выходов в GA'}" style="height: 48px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; ${c ? 'background: #F2F2FE; color: #000000; font-weight: 500;' : 'background: transparent; color: #5C5C73;'}"><span style="font-size: 13px;">${n}</span><span style="display: flex; gap: 3px; height: 6px;">${dots}</span></div>`;
  }).join('');

  return `
    <div style="display: flex; flex-direction: column; gap: 8px; padding: 0 8px;">
      <div style="display: flex; align-items: center; min-height: 32px;">
        <span style="font-size: 13px; font-weight: 500; color: #5C5C73; margin-right: auto;">Направления</span>${admin ? '' : loginBtn('направления')}
      </div>${dirs}${admin ? addRow('add-direction', 'Новое направление', 'Добавить направление') : ''}
    </div>

    <div style="display: flex; flex-direction: column; gap: 8px; padding: 0 8px;">
      <div style="display: flex; align-items: center; min-height: 32px;">
        <span style="font-size: 13px; font-weight: 500; color: #5C5C73; margin-right: auto;">Статусы</span>${admin ? '' : loginBtn('статусы')}
      </div>${statuses}${admin ? addRow('add-status', 'Новый статус', 'Добавить статус') : ''}
    </div>

    <div style="display: flex; flex-direction: column; gap: 10px; padding: 0 8px;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <span style="font-size: 13px; font-weight: 500; color: #5C5C73; margin-right: auto;">Выходы в GA · ${year}</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px;">${grid}
      </div>
      <span style="font-size: 12px; color: #5C5C73; line-height: 1.4;">Квадратики — сколько продуктов выходит в GA в этом месяце</span>
    </div>`;
}

function tableRows(products) {
  const off = dirFilter();
  const closed = collapsedGroups();
  const q = search.trim().toLowerCase();
  let html = '';
  for (const d of state.directions) {
    if (off.includes(d.id)) continue;
    const items = products.filter((p) => p.directionId === d.id && (!q || p.name.toLowerCase().includes(q)));
    if (!items.length) continue;
    const isClosed = closed.includes(d.id);
    const gaList = [...new Set(items.map(gaMonth).filter(Boolean))].sort((a, b) => a - b).map((m) => MNOM[m - 1]);
    html += `
            <button type="button" data-action="toggle-group" data-id="${d.id}" aria-expanded="${isClosed ? 'false' : 'true'}" style="width: 100%; min-height: 48px; display: flex; align-items: center; gap: 10px; padding: 8px 20px; border: 0; border-bottom: 1px solid #E0E0F5; background: #F2F2FE; font: inherit; color: #000000; text-align: left; cursor: pointer;">
              <svg aria-hidden="true" style="flex: none; transition: transform 0.15s; transform: rotate(${isClosed ? '-90deg' : '0deg'});" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0000FF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
              <span style="font-size: 15px; font-weight: 500;">${esc(d.name)}</span>
              <span style="font-size: 13px; color: #44445C;">${pluralProducts(items.length)}</span>
              <span style="font-size: 13px; color: #0000FF;">${isClosed && gaList.length ? 'GA: ' + gaList.join(', ') : ''}</span>
            </button>`;
    if (isClosed) continue;
    for (const p of items) {
      const m = gaMonth(p);
      const ga = gaStage(state, p);
      const gaLabel = m ? MNOM[m - 1] : ga ? rangeName({ from: ga.from, to: ga.from }, year) : '';
      let cells = '';
      for (let i = 1; i <= 12; i++) cells += `\n                <div style="grid-column: ${i + 1}; grid-row: 1; border-left: 1px solid #F2F2FE;"></div>`;
      const segs = p.stages.map((st) => {
        const c = clip(st);
        const s = state.statusById[st.statusId];
        if (!c || !s) return '';
        return `\n                <div style="grid-column: ${c.from + 1} / ${c.to + 2}; grid-row: 1; align-self: center; margin: 0 2px; height: 32px; border-radius: 4px; ${statusCss(s)} font-size: 13px; display: flex; align-items: center; justify-content: center; padding: 0 8px; min-width: 0; z-index: 1;"><span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(s.name)}</span></div>`;
      }).join('');
      html += `
            <div style="display: grid; grid-template-columns: 248px repeat(12, minmax(0, 1fr)); border-bottom: 1px solid #F2F2FE; min-height: 56px;">
              <div style="grid-column: 1; grid-row: 1; padding: 8px 12px 8px 46px; display: flex; align-items: center; gap: 6px; min-width: 0;">
                <div style="display: flex; flex-direction: column; gap: 3px; min-width: 0; margin-right: auto;">
                  <a href="/products/${p.id}" style="font-size: 16px; font-weight: 300; line-height: 1.25; color: #000000; text-decoration: none;">${esc(p.name)}</a>
                  ${gaLabel ? `<span style="font-size: 12px; color: #5C5C73;">GA — ${gaLabel}</span>` : ''}
                </div>
                ${state.isAdmin ? editProductButton(p.id) : ''}
              </div>${cells}${segs}
            </div>`;
    }
  }
  return html;
}

// Красная линия «сегодня» поверх строк — только в календаре текущего года.
// Стоит внутри месяца пропорционально дню: 27 октября — почти у правого края «Окт»
function todayLine() {
  const now = today();
  if (now.y !== year) return '';
  const days = new Date(now.y, now.m, 0).getDate();
  const share = (now.m - 1 + (now.d - 0.5) / days) / 12;
  const label = `Сегодня, ${now.d} ${MGEN[now.m - 1]}`;
  return `
          <div role="img" aria-label="${label}" title="${label}" style="position: absolute; top: 0; bottom: 0; left: calc(248px + (100% - 248px) * ${share.toFixed(5)} - 1px); width: 2px; background: #FF3B30; z-index: 2; pointer-events: none;"></div>`;
}

function upcoming(products) {
  const now = today();
  const startM = now.y > year ? 13 : now.y < year ? 1 : now.m;
  const endM = Math.min(startM + 5, 12);
  const list = products.map((p) => ({ p, m: gaMonth(p) })).filter((x) => x.m && x.m >= startM && x.m <= endM)
    .sort((a, b) => a.m - b.m || a.p.id - b.p.id);
  const subtitle = startM > 12 ? '' : startM === 1 && endM === 6 ? `первое полугодие ${year}` : `${MNOM[startM - 1]} – ${MNOM[endM - 1]} ${year}`;
  const cards = list.map(({ p, m }) => {
    const dir = state.directionById[p.directionId];
    return `
        <a href="/products/${p.id}" style="display: flex; flex-direction: column; gap: 14px; background: #FFFFFF; border-radius: 12px; padding: 20px; color: #000000; text-decoration: none;">
          <div style="display: flex; align-items: baseline; gap: 8px;"><span style="font-size: 28px; font-weight: 400; color: #0000FF; line-height: 1;">${MSHORT[m - 1]}</span><span style="font-size: 14px; color: #5C5C73;">${year}</span></div>
          <div style="display: flex; flex-direction: column; gap: 4px;"><span style="font-size: 16px; font-weight: 300; line-height: 1.25;">${esc(p.name)}</span><span style="font-size: 13px; color: #5C5C73;">${esc(dir ? dir.name : '')}</span></div>
          <div style="font-size: 13px; color: #44445C; line-height: 1.5; border-top: 1px solid #E0E0F5; padding-top: 12px;">${esc(planText(p))}</div>
        </a>`;
  }).join('');
  return `
    <div style="display: flex; align-items: baseline; gap: 12px; margin-top: 12px;">
      <h2 style="margin: 0; font-size: 24px; font-weight: 400;">Ближайшие выходы в GA</h2>
      <span style="font-size: 14px; color: #5C5C73;">${subtitle}</span>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px;">${cards}
    </div>`;
}

function renderDesktop() {
  const products = yearProducts();
  const dirsUsed = new Set(products.map((p) => p.directionId)).size;
  const nav = navClosed() ? collapsedNav('calendar') : openNav('calendar', sidebarSections(products), state.isAdmin);
  const legend = state.statuses.map((s) => `
        <span style="display: flex; align-items: center; gap: 8px;"><span style="width: 18px; height: 10px; border-radius: 2px; ${swatchCss(s)}"></span>${esc(s.name)}</span>`).join('');
  const months = MSHORT.map((n) => `
            <div style="padding: 16px 4px; font-size: 13px; font-weight: 500; color: #44445C; text-align: center; border-left: 1px solid #F2F2FE;">${n}</div>`).join('');
  const html = `<div style="font-family: 'TT Norms Pro', Manrope, system-ui, sans-serif; color: #000000; background: #F2F2FE; display: flex; flex-wrap: wrap; min-height: 1400px; box-sizing: border-box; position: relative;">
  ${nav}

  <main style="flex: 999 1 560px; min-width: 0; padding: 24px 32px 48px; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px;">

    <header style="position: relative; overflow: hidden; background: #FFFFFF; border-radius: 12px; padding: 28px 32px; display: flex; flex-wrap: wrap; align-items: flex-end; gap: 20px; min-height: 148px; box-sizing: border-box;">
      <svg aria-hidden="true" style="position: absolute; right: 0; top: 0; height: 100%; width: 460px;" viewBox="0 0 460 156" preserveAspectRatio="xMaxYMid slice">
        <defs>
          <pattern id="tri-main" width="60" height="103.92" patternUnits="userSpaceOnUse" x="460"><path d="M0 0L60 103.92M60 0L0 103.92M0 0H60M0 51.96H60" fill="none" stroke="#0000FF" stroke-width="1"></path></pattern>
          <linearGradient id="fade-main" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="0.75" stop-color="#FFFFFF" stop-opacity="1"></stop></linearGradient>
          <mask id="mask-main"><rect width="460" height="156" fill="url(#fade-main)"></rect></mask>
        </defs>
        <rect width="460" height="156" fill="url(#tri-main)" mask="url(#mask-main)" opacity="0.55"></rect>
      </svg>
      <div style="position: relative; display: flex; flex-direction: column; gap: 10px; margin-right: auto;">
        <h1 style="margin: 0; font-size: 36px; font-weight: 400; line-height: 1;">Календарь выхода продуктов</h1>
        <div style="display: flex; align-items: center; gap: 10px; font-size: 15px; color: #44445C;">
          <button type="button" data-action="prev-year" aria-label="Предыдущий год" style="width: 32px; height: 32px; border: 1px solid #E0E0F5; border-radius: 6px; background: #FFFFFF; color: #000000; display: flex; align-items: center; justify-content: center; cursor: pointer;"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m15 6-6 6 6 6"></path></svg></button>
          <span style="font-size: 18px; color: #000000; font-weight: 500;">${year}</span>
          <button type="button" data-action="next-year" aria-label="Следующий год" style="width: 32px; height: 32px; border: 1px solid #E0E0F5; border-radius: 6px; background: #FFFFFF; color: #000000; display: flex; align-items: center; justify-content: center; cursor: pointer;"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="m9 6 6 6-6 6"></path></svg></button>
          <span>${pluralProducts(products.length)} · ${pluralDirections(dirsUsed)}</span>
        </div>
      </div>
      <div style="position: relative; display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
        ${searchBox('Поиск', 'Найти продукт', search)}
        ${state.isAdmin ? addProductButton() : ''}
      </div>
    </header>

    <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
      <button type="button" data-action="collapse-all" style="height: 36px; padding: 0 12px; margin-left: -12px; border: 0; border-radius: 6px; background: transparent; font: inherit; font-size: 13px; color: #0000FF; cursor: pointer;">Свернуть все</button>
      <button type="button" data-action="expand-all" style="height: 36px; padding: 0 12px; border: 0; border-radius: 6px; background: transparent; font: inherit; font-size: 13px; color: #0000FF; cursor: pointer;">Развернуть все</button>
      <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-left: auto; font-size: 13px; color: #44445C;">${legend}
      </div>
    </div>

    <section aria-label="Календарь на ${year} год" style="background: #FFFFFF; border-radius: 12px; overflow-x: auto;">
      <div style="min-width: 1000px;">
        <div style="display: grid; grid-template-columns: 248px repeat(12, minmax(0, 1fr)); border-bottom: 1px solid #E0E0F5;">
          <div style="padding: 16px 20px; font-size: 13px; font-weight: 500; color: #5C5C73;">Продукт</div>${months}
        </div>
        <div style="position: relative;">${tableRows(products)}${todayLine()}
        </div>
      </div>
    </section>
${upcoming(products)}
  </main>
${showLogin ? loginModal('Изменять направления, статусы и продукты могут только администраторы', '') : ''}
</div>`;
  renderKeepingFocus(root, html);
}

function render() {
  if (isMobile()) renderMobile();
  else renderDesktop();
}

async function reload() {
  state = await loadState();
  year = selectedYear(state);
  render();
}

// ---------- Действия ----------

async function adminCall(fn) {
  try {
    await fn();
  } catch (e) {
    if (e.status === 401) alert('Войдите как администратор');
    else alert(e.message);
  }
  await reload();
}

function toggleInList(key, id) {
  const list = storage(key, []);
  store(key, list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
}

root.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const id = Number(t.dataset.id);
  switch (t.dataset.action) {
    case 'toggle-nav': toggleNav(); render(); break;
    case 'prev-year': year -= 1; setYear(year); mobileMonth = null; render(); break;
    case 'next-year': year += 1; setYear(year); mobileMonth = null; render(); break;
    case 'toggle-group': toggleInList('calendarCollapsed', id); render(); break;
    case 'collapse-all': store('calendarCollapsed', state.directions.map((d) => d.id)); render(); break;
    case 'expand-all': store('calendarCollapsed', []); render(); break;
    case 'pick-month': mobileMonth = Number(t.dataset.month); render(); break;
    case 'new-product': openProductModal(state, { year, onSaved: reload }); break;
    case 'edit-product': openProductModal(state, { year, productId: id, onSaved: reload }); break;
    case 'rename-direction': {
      const d = state.directionById[id];
      const name = prompt('Название направления', d.name);
      if (name != null && name.trim() && name.trim() !== d.name) await adminCall(() => api(`/api/directions/${id}`, { method: 'PUT', body: { name } }));
      break;
    }
    case 'delete-direction': {
      const d = state.directionById[id];
      if (state.products.some((p) => p.directionId === id)) {
        alert('Нельзя удалить: в направлении есть продукты. Сначала перенесите их в другое направление.');
      } else if (confirm(`Удалить направление «${d.name}»?`)) {
        await adminCall(() => api(`/api/directions/${id}`, { method: 'DELETE' }));
      }
      break;
    }
    case 'add-direction': {
      const input = root.querySelector('[data-role="add-direction"]');
      if (input.value.trim()) await adminCall(() => api('/api/directions', { method: 'POST', body: { name: input.value } }));
      break;
    }
    case 'add-status': {
      const input = root.querySelector('input[data-role="add-status"]');
      if (input.value.trim()) await adminCall(() => api('/api/statuses', { method: 'POST', body: { name: input.value } }));
      break;
    }
    case 'status-color': root.querySelector(`input[data-role="status-color"][data-id="${id}"]`).click(); break;
    case 'rename-status': {
      const s = state.statusById[id];
      const name = prompt('Название статуса', s.name);
      if (name != null && name.trim() && name.trim() !== s.name) await adminCall(() => api(`/api/statuses/${id}`, { method: 'PUT', body: { name } }));
      break;
    }
    case 'delete-status': {
      const s = state.statusById[id];
      if (state.products.some((p) => p.stages.some((st) => st.statusId === id))) {
        alert('Нельзя удалить: статус используется в сроках продуктов.');
      } else if (confirm(`Удалить статус «${s.name}»?`)) {
        await adminCall(() => api(`/api/statuses/${id}`, { method: 'DELETE' }));
      }
      break;
    }
    default: break;
  }
});

root.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.dataset.role === 'dir-filter') {
    toggleInList('calendarDirsOff', Number(t.dataset.id));
    render();
  } else if (t.dataset.role === 'status-color') {
    const id = Number(t.dataset.id);
    const s = state.statusById[id];
    const c = t.value.toUpperCase();
    // Статус с обводкой: меняем обводку и текст. Залитый: фон, текст — белый или чёрный
    const body = s.border ? { border: c, color: c } : { background: c, color: contrastText(c) };
    await adminCall(() => api(`/api/statuses/${id}`, { method: 'PUT', body }));
  }
});

root.addEventListener('input', (e) => {
  if (e.target.dataset.role === 'search') {
    search = e.target.value;
    render();
  }
});

root.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const role = e.target.dataset.role;
  if (role === 'add-direction' || role === 'add-status') root.querySelector(`button[data-action="${role}"]`).click();
});

wireLogin(root, {
  openLogin() { showLogin = true; render(); focusLogin(root); },
  closeLogin() { showLogin = false; render(); },
  reload,
});

onMobileChange(render);
reload();
