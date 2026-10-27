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

// '2027-04' → 'апрель 2027'
function monthYear(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function isMonth(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

module.exports = { nowLocal, normalizeDateTime, monthYear, isMonth };
