// Общие помощники сервера

function pad(n) {
  return String(n).padStart(2, '0');
}

// Локальное время сервера в виде 'YYYY-MM-DDTHH:MM:SS' — так даты не сдвигаются часовым поясом
function nowLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeDateTime(s) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s + 'T00:00:00';
  return s;
}

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function lastDay(y, m) {
  return new Date(y, m, 0).getDate();
}

function parts(date) {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

// '2027-04' → первый и последний день месяца
function monthStart(ym) {
  return `${ym}-01`;
}
function monthEnd(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${pad(lastDay(y, m))}`;
}

function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const { y, m, d } = parts(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= lastDay(y, m);
}

// Этап целыми месяцами показывается как раньше: «апрель 2027», «январь 2027 – март 2027».
// Иначе — с днями: «15 апреля 2027», «15 января 2027 – 20 марта 2027»
function rangeText(from, to) {
  const a = parts(from), b = parts(to);
  if (a.d === 1 && b.d === lastDay(b.y, b.m)) {
    const s = `${MONTHS[a.m - 1]} ${a.y}`, e = `${MONTHS[b.m - 1]} ${b.y}`;
    return s === e ? s : `${s} – ${e}`;
  }
  const s = `${a.d} ${MONTHS_GEN[a.m - 1]} ${a.y}`, e = `${b.d} ${MONTHS_GEN[b.m - 1]} ${b.y}`;
  return s === e ? s : `${s} – ${e}`;
}

module.exports = { nowLocal, normalizeDateTime, lastDay, monthStart, monthEnd, isDate, rangeText };
