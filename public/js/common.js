// Общие помощники всех страниц: данные, форматирование, боковая панель, окно входа

export const MSHORT = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
export const MNOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
export const MGEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MLOWER = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MDATE = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export const KEY_PRE = 'pre-ga';
export const KEY_SUPPORT = 'sales-support';

// ---------- Мелочи ----------

export function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  const w = a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? few : many;
  return `${n} ${w}`;
}
export const pluralProducts = (n) => plural(n, 'продукт', 'продукта', 'продуктов');
export const pluralDirections = (n) => plural(n, 'направление', 'направления', 'направлений');

export function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// 'YYYY-MM-DD' (или 'YYYY-MM') → { y, m, d } (m: 1..12)
export function ym(s) {
  const [y, m, d = 1] = s.split('-').map(Number);
  return { y, m, d };
}
function ymStr(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}
export function dateStr(y, m, d) {
  return `${ymStr(y, m)}-${String(d).padStart(2, '0')}`;
}
function lastDay(y, m) {
  return new Date(y, m, 0).getDate();
}
// Следующий день после даты 'YYYY-MM-DD'
export function nextDay(s) {
  const { y, m, d } = ym(s);
  const t = new Date(y, m - 1, d + 1);
  return dateStr(t.getFullYear(), t.getMonth() + 1, t.getDate());
}

// Сегодня. В визуальных тестах дата фиксируется через page.clock
export function today() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
}

// '2026-10-24T…' → '24 окт'
export function shortDate(s) {
  const [, m, d] = s.slice(0, 10).split('-').map(Number);
  return `${d} ${MDATE[m - 1]}`;
}

export function storage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
export function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
}

export async function api(url, options = {}) {
  const opts = { ...options, headers: { ...(options.headers || {}) } };
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Ошибка');
    err.status = res.status;
    throw err;
  }
  return data;
}

export function isMobile() {
  return window.matchMedia('(max-width: 768px)').matches;
}
export function onMobileChange(fn) {
  window.matchMedia('(max-width: 768px)').addEventListener('change', fn);
}

// ---------- Данные ----------

export async function loadState() {
  const s = await api('/api/state');
  s.statusById = Object.fromEntries(s.statuses.map((x) => [x.id, x]));
  s.directionById = Object.fromEntries(s.directions.map((x) => [x.id, x]));
  s.release = s.statuses.find((x) => x.isRelease) || null;
  s.isAdmin = !!s.admin;
  return s;
}

function stageKey(state, st) {
  const s = state.statusById[st.statusId];
  return s ? s.key : '';
}

export function stageOf(state, product, key) {
  return product.stages.find((st) => stageKey(state, st) === key) || null;
}
export function gaStage(state, product) {
  return state.release ? product.stages.find((st) => st.statusId === state.release.id) || null : null;
}

export function inYear(product, year) {
  return product.stages.some((st) => st.from <= `${year}-12-31` && st.to >= `${year}-01-01`);
}

// Год по умолчанию: текущий, если в нём есть этапы; иначе ближайший следующий с этапами
function stageYears(state) {
  const years = new Set();
  for (const p of state.products) for (const st of p.stages) {
    for (let y = ym(st.from).y; y <= ym(st.to).y; y++) years.add(y);
  }
  return [...years].sort((a, b) => a - b);
}
function defaultYear(state) {
  const now = today().y;
  const years = stageYears(state);
  if (!years.length || years.includes(now)) return now;
  const next = years.find((y) => y > now);
  return next != null ? next : years[years.length - 1];
}
export function selectedYear(state) {
  const y = storage('year', null);
  return Number.isInteger(y) ? y : defaultYear(state);
}
export function setYear(y) {
  store('year', y);
}

// Этап занимает целые месяцы: с 1-го числа по последнее
function wholeMonths(st) {
  const a = ym(st.from), b = ym(st.to);
  return a.d === 1 && b.d === lastDay(b.y, b.m);
}

// Сроки этапа словами. Целыми месяцами — как раньше: «январь – март», «апрель».
// Иначе с днями: «15 января – 20 марта», «15–20 апреля», «15 апреля».
// Год добавляется, если он не совпадает с year. short — короткие названия для телефона: «янв – мар», «15 янв – 20 мар»
export function rangeName(st, year, short = false) {
  const a = ym(st.from), b = ym(st.to);
  const yearOf = (x) => (x.y === year ? '' : ` ${x.y}`);
  if (wholeMonths(st)) {
    const names = short ? MLOWER : MNOM;
    const s1 = names[a.m - 1] + yearOf(a), s2 = names[b.m - 1] + yearOf(b);
    return s1 === s2 ? s1 : `${s1} – ${s2}`;
  }
  const names = short ? MDATE : MGEN;
  if (a.y === b.y && a.m === b.m) {
    return a.d === b.d ? `${a.d} ${names[a.m - 1]}${yearOf(a)}` : `${a.d}–${b.d} ${names[a.m - 1]}${yearOf(a)}`;
  }
  return `${a.d} ${names[a.m - 1]}${yearOf(a)} – ${b.d} ${names[b.m - 1]}${yearOf(b)}`;
}

// Начало этапа после предлога «с»: «мая» или «15 мая»
export function sinceName(st, year, short = false) {
  const a = ym(st.from);
  const yearOf = a.y === year ? '' : ` ${a.y}`;
  if (a.d === 1) return MGEN[a.m - 1] + yearOf;
  return `${a.d} ${(short ? MDATE : MGEN)[a.m - 1]}${yearOf}`;
}

// Положение полоски этапа в сетке из 12 месяцев выбранного года.
// Колонки — целые месяцы, начало и конец внутри месяца — отступы в процентах от ширины полоски.
// offset — сколько колонок слева до января, gap — отступ полоски от границ колонок в px
export function stageSpan(st, year, offset = 0, gap = 0) {
  const a = ym(st.from), b = ym(st.to);
  if (st.from > `${year}-12-31` || st.to < `${year}-01-01`) return null;
  const from = a.y < year ? 1 : a.m;
  const to = b.y > year ? 12 : b.m;
  const startShare = a.y < year ? 0 : (a.d - 1) / lastDay(a.y, a.m);
  const endShare = b.y > year ? 0 : (lastDay(b.y, b.m) - b.d) / lastDay(b.y, b.m);
  const months = to - from + 1;
  const pct = (share) => `${((share / months) * 100).toFixed(3)}%`;
  const side = (share) => (share ? `calc(${gap}px + ${pct(share)})` : `${gap}px`);
  const margin = startShare || endShare
    ? ` margin: 0 ${side(endShare)} 0 ${side(startShare)};`
    : gap ? ` margin: 0 ${gap}px;` : '';
  // grid-row: 1 — этапы в одном месяце (GA 7 апреля и поддержка с 8-го) должны стоять в одной строке, а не переноситься
  return { from, to, css: `grid-column: ${from + offset} / ${to + offset + 1}; grid-row: 1;`, margin, partial: !!(startShare || endShare) };
}

// GA, отмеченный «Релиз состоялся», — зелёный вместо синего. Белый текст на нём — контраст 4.6:1
export const RELEASED_GREEN = '#00873C';
export function stageStatus(state, product, st) {
  const s = state.statusById[st.statusId];
  if (!s || !s.isRelease || !product.releasedAt) return s;
  return { ...s, background: RELEASED_GREEN, color: '#FFFFFF', border: null };
}

// Стиль полоски этапа: фон, текст, обводка
export function statusCss(s) {
  return `background: ${s.background}; color: ${s.color};${s.border ? ` box-shadow: inset 0 0 0 1.5px ${s.border};` : ''}`;
}
// Образец цвета без цвета текста
export function swatchCss(s) {
  return `background: ${s.background};${s.border ? ` box-shadow: inset 0 0 0 1.5px ${s.border};` : ''}`;
}

// Белый или чёрный текст — у какого контраст с фоном выше
export function contrastText(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? '#FFFFFF' : '#000000';
}

// Тип материала для узкого квадратика (40–44 px): длинные названия сокращаем
const CATEGORY_SHORT = { 'Презентации': 'Презен.', 'Визуалы': 'Визуал.', 'Документы': 'Докум.' };
export function categoryShort(category) {
  return CATEGORY_SHORT[category] || category;
}

export function fileExt(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toUpperCase() : '';
}
export function stripExt(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

export function materialsText(links, files) {
  const parts = [];
  if (links) parts.push(plural(links, 'ссылка', 'ссылки', 'ссылок'));
  if (files) parts.push(plural(files, 'файл', 'файла', 'файлов'));
  return parts.join(' · ');
}

// ---------- Иконки (из эталонов) ----------

export const ICON = {
  calendar18: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path></svg>',
  grid18: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>',
  clip18: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.5 12.6 20.9a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"></path></svg>',
  pencil: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg>',
  trash: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"></path></svg>',
  plus16w: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>',
  plus18: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>',
  plus16: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>',
  plus14: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg>',
  search: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>',
  shield: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"></path></svg>',
  close16: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg>',
  close18: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg>',
  download18: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"></path></svg>',
  download16: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"></path></svg>',
  arrowUpRight14: '<svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0000FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"></path></svg>',
  arrowUpRight16: '<svg aria-hidden="true" style="flex: none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0000FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"></path></svg>',
};

export const SR = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);';

// ---------- Боковая панель ----------

const NAV_ITEMS = [
  { key: 'calendar', href: '/', label: 'Календарь', icon: 'calendar' },
  { key: 'products', href: '/products', label: 'Все продукты', icon: 'grid' },
  { key: 'files', href: '/files', label: 'Файлы и ссылки', icon: 'clip' },
];

function icon20(name) {
  return ICON[name + '18'].replace('width="18" height="18"', 'width="20" height="20"');
}

export function navClosed() {
  return !!storage('navClosed', false);
}
export function toggleNav() {
  store('navClosed', !navClosed());
}

// Свёрнутая панель 72 px. Без кнопки «Развернуть» — на карточке продукта
export function collapsedNav(active, withToggle = true) {
  const links = NAV_ITEMS.map((n) => {
    const on = n.key === active;
    return `<a href="${n.href}" aria-label="${n.label}" style="width: 44px; height: 44px; border-radius: 8px; ${on ? 'background: #F2F2FE; color: #0000FF;' : 'color: #44445C;'} display: flex; align-items: center; justify-content: center;">${icon20(n.icon)}</a>`;
  }).join('\n    ');
  const toggle = withToggle
    ? `<button type="button" data-action="toggle-nav" aria-label="Развернуть панель" style="width: 44px; height: 44px; border: 0; border-radius: 8px; background: #0000FF; color: #FFFFFF; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; cursor: pointer;"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16M13 10l2 2-2 2"></path></svg></button>\n    `
    : '';
  return `<nav class="main-nav" aria-label="Основное меню" style="flex: none; width: 72px; background: #FFFFFF; border-right: 1px solid #E0E0F5; padding: 20px 14px; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; gap: 8px;">
    ${toggle}${links}
  </nav>`;
}

// Развёрнутая панель: логотип, меню и разделы страницы
export function openNav(active, sectionsHtml) {
  const links = NAV_ITEMS.map((n) => {
    const on = n.key === active;
    return `<a href="${n.href}" style="display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 8px; ${on ? 'background: #F2F2FE; color: #0000FF; font-weight: 500;' : 'color: #000000;'} font-size: 15px; text-decoration: none;">${ICON[n.icon + '18']}${n.label}</a>`;
  }).join('\n      ');
  return `<nav class="main-nav" aria-label="Основное меню" style="flex: 1 1 256px; max-width: 280px; min-width: 232px; background: #FFFFFF; border-right: 1px solid #E0E0F5; padding: 22px 16px 32px; box-sizing: border-box; display: flex; flex-direction: column; gap: 28px;">
    <div style="display: flex; align-items: center; gap: 10px; padding: 0 8px;">
      <div style="display: flex; flex-direction: column; gap: 8px; margin-right: auto;">
        <img src="/assets/yadro-logo-blue.png" alt="YADRO" style="width: 96px; height: auto; display: block;">
        <span style="font-size: 13px; color: #5C5C73;">Календарь релизов</span>
      </div>
      <button type="button" data-action="toggle-nav" aria-label="Свернуть панель" style="width: 40px; height: 40px; border: 0; border-radius: 8px; background: #F2F2FE; color: #44445C; display: flex; align-items: center; justify-content: center; cursor: pointer;"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16M15 10l-2 2 2 2"></path></svg></button>
    </div>
    <div style="display: flex; flex-direction: column; gap: 2px;">
      ${links}
    </div>
${sectionsHtml}
  </nav>`;
}

// Вход для администратора — справа вверху шапки, под ним поиск и кнопки страницы.
// После входа на месте кнопки — плашка «Режим администратора» с кнопкой «Выйти»
export function headerRight(isAdmin, controlsHtml) {
  return `<div style="position: relative; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; max-width: 100%;">
        ${adminHeaderControl(isAdmin)}
        <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end; max-width: 100%;">
        ${controlsHtml}
        </div>
      </div>`;
}

function adminHeaderControl(isAdmin) {
  if (isAdmin) {
    return `<div style="display: flex; align-items: center; gap: 8px; height: 44px; box-sizing: border-box; background: #0000FF; color: #FFFFFF; border-radius: 8px; padding: 0 6px 0 12px;">
          ${ICON.shield}
          <span style="font-size: 13px; font-weight: 500;">Режим администратора</span>
          <button type="button" data-action="logout" style="height: 32px; padding: 0 10px; border: 0; border-radius: 6px; background: #FFFFFF; font: inherit; font-size: 12px; font-weight: 500; color: #0000FF; cursor: pointer;">Выйти</button>
        </div>`;
  }
  return `<button type="button" data-action="open-login" style="display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 16px; border: 1px solid #8A8AC2; border-radius: 8px; background: #FFFFFF; font: inherit; font-size: 14px; color: #000000; cursor: pointer;">${ICON.shield.replace('width="16" height="16"', 'width="18" height="18"')}Вход для администратора</button>`;
}

// Нижнее меню на телефоне
// mode: 'fixed' — поверх десктопной вёрстки; 'sticky' — в конце мобильного экрана, как в эталоне
export function bottomNav(active, mode = 'fixed') {
  const items = [
    { key: 'calendar', href: '/', label: 'Календарь', icon: 'calendar' },
    { key: 'products', href: '/products', label: 'Продукты', icon: 'grid' },
    { key: 'files', href: '/files', label: 'Материалы', icon: 'clip' },
  ];
  const links = items.map((n) => {
    const on = n.key === active;
    const svg = ICON[n.icon + '18'].replace('width="18" height="18"', 'width="22" height="22"');
    return `<a href="${n.href}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 11px;${on ? ' font-weight: 500; color: #0000FF;' : ' color: #44445C;'} text-decoration: none;">${svg}${n.label}</a>`;
  }).join('\n    ');
  return `<nav class="bottom-nav ${mode}" aria-label="Нижнее меню" style="height: 84px; background: #FFFFFF; border-top: 1px solid #E0E0F5; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding-bottom: 20px; box-sizing: border-box;">
    ${links}
  </nav>`;
}

export function searchBox(srLabel, placeholder, value, width = 280) {
  return `<label style="display: flex; align-items: center; gap: 8px; background: #FFFFFF; border: 1px solid #8A8AC2; border-radius: 8px; padding: 0 12px; height: 44px; width: ${width}px; max-width: 100%; box-sizing: border-box; color: #5C5C73;">${ICON.search}<span style="${SR}">${srLabel}</span><input type="search" data-role="search" placeholder="${placeholder}" value="${esc(value)}" style="border: 0; outline: 0; font: inherit; font-size: 14px; background: transparent; flex: 1; min-width: 0; color: #000000;"></label>`;
}

// Чип с нативным <select> внутри
export function chipSelect(role, label, options, value, extraStyle = '') {
  const opts = options.map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  return `<label class="chip-select" style="display: inline-flex; align-items: center; height: 36px; padding: 0 14px; border: 1px solid #8A8AC2; border-radius: 6px; background: #FFFFFF; font-size: 13px; color: #000000; box-sizing: border-box; cursor: pointer;${extraStyle}">${esc(label)} ▾<select data-role="${role}" aria-label="${esc(label)}">${opts}</select></label>`;
}

export function addProductButton(attrs = '') {
  return `<button type="button" data-action="new-product"${attrs} style="display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border: 0; border-radius: 8px; background: #0000FF; color: #FFFFFF; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer;">${ICON.plus18}Добавить продукт</button>`;
}

export function editProductButton(id) {
  return `<button type="button" data-action="edit-product" data-id="${id}" aria-label="Редактировать продукт" style="flex: none; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #44445C; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.pencil}</button>`;
}

// ---------- Окно входа ----------

export function loginModal(subtitle, suffix) {
  return `<div data-role="login-overlay" style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: flex-start; padding: 160px 16px 0; box-sizing: border-box; z-index: 10;">
      <div role="dialog" aria-modal="true" aria-label="Вход для администратора" style="width: 100%; max-width: 420px; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,40,0.25);">
        <div style="position: relative; height: 104px; background: #0000FF; overflow: hidden;">
          <svg aria-hidden="true" style="position: absolute; right: 0; top: 0;" width="300" height="104" viewBox="0 0 300 104">
            <defs><pattern id="tri-login${suffix}" width="60" height="103.92" patternUnits="userSpaceOnUse" x="300"><path d="M0 0L60 103.92M60 0L0 103.92M0 0H60M0 51.96H60" fill="none" stroke="#F2F2FE" stroke-width="1"></path></pattern>
            <linearGradient id="fade-login${suffix}" x1="0" x2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="0.8" stop-color="#FFFFFF" stop-opacity="1"></stop></linearGradient>
            <mask id="mask-login${suffix}"><rect width="300" height="104" fill="url(#fade-login${suffix})"></rect></mask></defs>
            <rect width="300" height="104" fill="url(#tri-login${suffix})" mask="url(#mask-login${suffix})" opacity="0.6"></rect>
          </svg>
          <img src="/assets/yadro-logo-white.png" alt="YADRO" style="position: absolute; left: 28px; bottom: 24px; width: 104px; height: auto;">
          <button type="button" data-action="close-login" aria-label="Закрыть" style="position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; border: 0; border-radius: 6px; background: #FFFFFF; color: #000000; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.close16}</button>
        </div>
        <form data-role="login-form" style="padding: 28px; display: flex; flex-direction: column; gap: 18px; margin: 0;">
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <h2 style="margin: 0; font-size: 24px; font-weight: 400;">Вход для администратора</h2>
            <span style="font-size: 14px; color: #44445C; line-height: 1.45;">${subtitle}</span>
          </div>
          <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: #44445C;">Логин
            <input type="text" name="login" autocomplete="username" style="height: 44px; border: 1px solid #8A8AC2; border-radius: 8px; padding: 0 12px; font: inherit; font-size: 15px; font-weight: 400; color: #000000;">
          </label>
          <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: #44445C;">Пароль
            <input type="password" name="password" autocomplete="current-password" style="height: 44px; border: 1px solid #8A8AC2; border-radius: 8px; padding: 0 12px; font: inherit; font-size: 15px; font-weight: 400; color: #000000;">
          </label>
          <button type="submit" style="height: 48px; border: 0; border-radius: 8px; background: #0000FF; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 500; cursor: pointer;">Войти</button>
        </form>
      </div>
    </div>`;
}

// Подключает окно входа: открыть/закрыть, Esc, клик по затемнению, вход и выход
export function wireLogin(root, ctx) {
  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action]');
    if (e.target.matches('[data-role="login-overlay"]')) { ctx.closeLogin(); return; }
    if (!t) return;
    const a = t.dataset.action;
    if (a === 'open-login') { ctx.openLogin(); }
    else if (a === 'close-login') { ctx.closeLogin(); }
    else if (a === 'logout') { await api('/api/auth/logout', { method: 'POST' }); await ctx.reload(); }
  });
  root.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-role="login-form"]')) return;
    e.preventDefault();
    const f = e.target;
    try {
      await api('/api/auth/login', { method: 'POST', body: { login: f.login.value, password: f.password.value } });
      ctx.closeLogin();
      await ctx.reload();
    } catch {
      alert('Неверный логин или пароль');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.querySelector('[data-role="login-overlay"]')) ctx.closeLogin();
  });
}

// Окно входа стоит вверху страницы, как в эталоне — прокручиваем к нему
export function focusLogin() {
  window.scrollTo(0, 0);
}

// Перерисовка с сохранением фокуса и курсора в поле поиска
export function renderKeepingFocus(root, html) {
  const active = document.activeElement;
  const role = active && root.contains(active) && active.dataset ? active.dataset.role : null;
  const pos = role && typeof active.selectionStart === 'number' ? active.selectionStart : null;
  let selector = role ? `[data-role="${role}"]` : '';
  if (role && active.dataset.id) selector += `[data-id="${active.dataset.id}"]`;
  if (role && active.dataset.cat) selector += `[data-cat="${CSS.escape(active.dataset.cat)}"]`;
  root.innerHTML = html;
  if (role) {
    const el = root.querySelector(selector);
    if (el) {
      el.focus();
      if (pos != null && el.setSelectionRange) try { el.setSelectionRange(pos, pos); } catch { /* не текстовое поле */ }
    }
  }
}
