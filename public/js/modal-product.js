// Окно «Новый продукт» / «Редактирование продукта» (только администратор)
import { esc, api, dateStr, nextDay, stageSpan, statusCss, swatchCss, contrastText, ICON, SR } from './common.js';

const INPUT = 'height: 44px; border: 1px solid #8A8AC2; border-radius: 8px; padding: 0 12px; font: inherit; font-size: 15px; font-weight: 400; color: #000000;';
const FIELD = 'display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: #44445C;';
const ROW_INPUT = 'width: 100%; box-sizing: border-box; height: 44px; border: 1px solid #8A8AC2; border-radius: 8px; padding: 0 12px; font: inherit; font-size: 15px; color: #000000;';
const ROW_DATE = 'width: 100%; box-sizing: border-box; height: 44px; border: 1px solid #8A8AC2; border-radius: 8px; padding: 0 10px; font: inherit; font-size: 15px; color: #000000; background: #FFFFFF;';
const STAGE_GRID = 'display: grid; grid-template-columns: minmax(0, 1.4fr) 1fr 1fr 40px; gap: 10px;';
const TEAM_GRID = 'display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.4fr) 40px; gap: 10px;';
const CONTACT_HINTS = ['https://t.me/…', 'имя@yadro.com'];

function rowButton(action, label, i) {
  return `<button type="button" data-action="${action}" data-i="${i}" aria-label="${esc(label)}" style="width: 40px; height: 40px; border: 0; border-radius: 6px; background: transparent; color: #44445C; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.trash}</button>`;
}

// Образец статуса в строке этапа: светлый залитый — с тонкой обводкой
function stageChip(s) {
  const outline = !s.border && contrastText(s.background) === '#000000' ? ' box-shadow: inset 0 0 0 1px #C9C9EA;' : '';
  return `flex: none; width: 14px; height: 14px; border-radius: 3px; ${swatchCss(s)}${outline}`;
}

export async function openProductModal(state, { year, productId = null, directionId = null, onSaved, onDeleted }) {
  const editing = productId != null;
  const product = editing ? state.products.find((p) => p.id === productId) : null;
  const details = editing ? await api(`/api/products/${productId}`) : { team: [] };

  const model = {
    name: product ? product.name : '',
    directionId: product ? product.directionId : directionId,
    description: product ? product.description : '',
    stages: product ? product.stages.map((s) => ({ ...s })) : [],
    team: details.team.map((m) => ({ ...m })),
    reason: '',
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; overflow-y: auto; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: flex-start; padding: 56px 16px; box-sizing: border-box; z-index: 20; font-family: \'TT Norms Pro\', Manrope, system-ui, sans-serif; color: #000000;';
  document.body.appendChild(overlay);

  // Дата этапа — нативный календарь браузера
  function dateInput(role, i, value, label) {
    return `<label><span style="${SR}">${esc(label)}</span><input type="date" data-role="${role}" data-i="${i}" value="${value}" min="2000-01-01" max="2099-12-31" required style="${ROW_DATE}"></label>`;
  }

  function stagesHtml() {
    return model.stages.map((st, i) => {
      const s = state.statusById[st.statusId];
      return `
          <div data-stage="${i}" style="${STAGE_GRID} align-items: center;">
            <div style="display: flex; align-items: center; gap: 10px; height: 44px; padding: 0 12px; border-radius: 8px; background: #F2F2FE;"><span style="${stageChip(s)}"></span><span style="font-size: 15px;">${esc(s.name)}</span></div>
            ${dateInput('stage-from', i, st.from, 'Начало этапа ' + s.name)}
            ${dateInput('stage-to', i, st.to, 'Конец этапа ' + s.name)}
            ${rowButton('remove-stage', 'Убрать этап ' + s.name, i)}
          </div>`;
    }).join('');
  }

  function previewHtml() {
    return model.stages.map((st) => {
      const s = state.statusById[st.statusId];
      const c = stageSpan(st, year);
      if (!c) return '';
      return `
            <div style="${c.css}${c.margin} height: 24px; border-radius: 3px; ${statusCss(s)} font-size: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; white-space: nowrap;">${esc(s.name)}</div>`;
    }).join('');
  }

  function teamHtml() {
    return model.team.map((m, i) => `
          <div data-member="${i}" style="${TEAM_GRID} align-items: center;">
            <label><span style="${SR}">ФИО</span><input type="text" data-role="member" data-field="fullName" data-i="${i}" value="${esc(m.fullName)}" placeholder="Фамилия Имя Отчество" style="${ROW_INPUT}"></label>
            <label><span style="${SR}">Роль</span><input type="text" data-role="member" data-field="role" data-i="${i}" value="${esc(m.role)}" style="${ROW_INPUT}"></label>
            <label><span style="${SR}">Ссылка для связи</span><input type="text" data-role="member" data-field="contactUrl" data-i="${i}" value="${esc(m.contactUrl)}" placeholder="${CONTACT_HINTS[i % 2]}" style="${ROW_INPUT}"></label>
            ${rowButton('remove-member', 'Убрать из команды', i)}
          </div>`).join('');
  }

  function unusedStatus() {
    return state.statuses.find((s) => !model.stages.some((st) => st.statusId === s.id)) || null;
  }

  function render() {
    const title = editing ? 'Редактирование продукта' : 'Новый продукт';
    const dirOptions = (model.directionId ? '' : '<option value="" selected></option>')
      + state.directions.map((d) => `<option value="${d.id}"${d.id === model.directionId ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
    const canAdd = !!unusedStatus();
    overlay.innerHTML = `<form class="dialog" role="dialog" aria-modal="true" aria-label="${title}" novalidate style="width: 760px; max-width: 100%; background: #FFFFFF; border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,40,0.25); margin: 0;">

    <div style="display: flex; align-items: center; gap: 12px; padding: 24px 28px; border-bottom: 1px solid #E0E0F5;">
      <div style="display: flex; flex-direction: column; gap: 6px; margin-right: auto;">
        <span style="align-self: flex-start; font-size: 12px; font-weight: 500; color: #FFFFFF; background: #0000FF; border-radius: 4px; padding: 3px 8px;">Режим администратора</span>
        <h2 style="margin: 0; font-size: 26px; font-weight: 400;">${title}</h2>
      </div>
      <button type="button" data-action="close" aria-label="Закрыть" style="width: 40px; height: 40px; padding: 0; border: 0; border-radius: 8px; background: #F2F2FE; color: #000000; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.close18}</button>
    </div>

    <div style="padding: 24px 28px; display: flex; flex-direction: column; gap: 22px;">
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
        <label style="${FIELD}">Название продукта
          <input type="text" data-role="name" required value="${esc(model.name)}" style="${INPUT}">
        </label>
        <label style="${FIELD}">Направление
          <select data-role="direction" required style="height: 44px; border: 1px solid #8A8AC2; border-radius: 8px; padding: 0 10px; font: inherit; font-size: 15px; font-weight: 400; color: #000000; background: #FFFFFF;">
            ${dirOptions}
          </select>
        </label>
      </div>
      <label style="${FIELD}">Короткое описание
        <textarea rows="2" data-role="description" placeholder="Что это за продукт и для кого" style="border: 1px solid #8A8AC2; border-radius: 8px; padding: 10px 12px; font: inherit; font-size: 15px; font-weight: 400; color: #000000; resize: vertical;">${esc(model.description)}</textarea>
      </label>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: baseline; gap: 10px;"><span style="font-size: 18px;">Этапы и сроки</span><span style="font-size: 13px; color: #5C5C73;">с точностью до дня</span></div>
        <div style="${STAGE_GRID} font-size: 13px; color: #5C5C73; padding: 0 2px;"><span>Статус</span><span>С</span><span>По</span><span></span></div>${stagesHtml()}
        <button type="button" data-action="add-stage"${canAdd ? '' : ' disabled'} style="align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 4px; border: 0; background: transparent; font: inherit; font-size: 14px; color: #0000FF; cursor: pointer;${canAdd ? '' : ' cursor: default;'}">${ICON.plus16}Добавить этап</button>
        <div style="display: flex; flex-direction: column; gap: 6px; background: #F2F2FE; border-radius: 8px; padding: 14px;">
          <span style="font-size: 13px; color: #44445C;">Так продукт будет выглядеть в календаре ${year}</span>
          <div data-role="preview" style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 2px;">${previewHtml()}
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; align-items: baseline; gap: 10px;"><span style="font-size: 18px;">Команда продукта</span><span style="font-size: 13px; color: #5C5C73;">видна всем в карточке продукта</span></div>
        <div style="${TEAM_GRID} font-size: 13px; color: #5C5C73; padding: 0 2px;"><span>ФИО</span><span>Роль</span><span>Как связаться</span><span></span></div>${teamHtml()}
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px;">
          <button type="button" data-action="add-member" style="display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 4px; border: 0; background: transparent; font: inherit; font-size: 14px; color: #0000FF; cursor: pointer;">${ICON.plus16}Добавить участника</button>
          <span style="font-size: 12px; color: #5C5C73;">Ссылка: Telegram (t.me/…), почта (имя@yadro.com) или профиль в корпоративном мессенджере</span>
        </div>
      </div>

      <label style="${FIELD}">Причина изменения сроков
        <input type="text" data-role="reason" value="${esc(model.reason)}" placeholder="Например: перенос сертификации. Попадёт в историю сроков" style="${INPUT}">
      </label>
    </div>

    <div style="display: flex; align-items: center; gap: 10px; padding: 18px 28px; border-top: 1px solid #E0E0F5;">
      ${editing ? `<button type="button" data-action="delete" style="display: inline-flex; align-items: center; gap: 6px; height: 44px; padding: 0 8px; border: 0; background: transparent; font: inherit; font-size: 14px; color: #44445C; margin-right: auto; cursor: pointer;">${ICON.trash}Удалить продукт</button>` : '<span style="margin-right: auto;"></span>'}
      <button type="button" data-action="close" style="display: inline-flex; align-items: center; height: 44px; padding: 0 18px; box-sizing: content-box; border: 1px solid #8A8AC2; border-radius: 8px; background: #FFFFFF; color: #000000; font: inherit; font-size: 15px; cursor: pointer;">Отмена</button>
      <button type="submit" style="display: inline-flex; align-items: center; height: 44px; padding: 0 22px; border: 0; border-radius: 8px; background: #0000FF; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 500; cursor: pointer;">Сохранить</button>
    </div>
  </form>`;
  }

  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('input', (e) => {
    const t = e.target;
    const role = t.dataset.role;
    if (role === 'name') model.name = t.value;
    else if (role === 'description') model.description = t.value;
    else if (role === 'reason') model.reason = t.value;
    else if (role === 'member') model.team[Number(t.dataset.i)][t.dataset.field] = t.value;
  });

  overlay.addEventListener('change', (e) => {
    const t = e.target;
    const role = t.dataset.role;
    if (role === 'direction') model.directionId = Number(t.value) || null;
    else if (role === 'stage-from' || role === 'stage-to') {
      // Пустое поле (дату стёрли) не сохраняем. Окно целиком не перерисовываем, чтобы не сбить ввод даты
      if (!t.value) return;
      model.stages[Number(t.dataset.i)][role === 'stage-from' ? 'from' : 'to'] = t.value;
      overlay.querySelector('[data-role="preview"]').innerHTML = previewHtml();
    }
  });

  overlay.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const i = Number(t.dataset.i);
    switch (t.dataset.action) {
      case 'close': close(); break;
      case 'add-stage': {
        const s = unusedStatus();
        if (!s) break;
        // Новый этап начинается на следующий день после последнего, иначе — 1 января выбранного года
        const last = model.stages.map((st) => st.to).sort().pop();
        const from = last ? nextDay(last) : dateStr(year, 1, 1);
        model.stages.push({ statusId: s.id, from, to: from });
        render();
        break;
      }
      case 'remove-stage': model.stages.splice(i, 1); render(); break;
      case 'add-member': model.team.push({ fullName: '', role: '', contactUrl: '' }); render(); break;
      case 'remove-member': model.team.splice(i, 1); render(); break;
      case 'delete':
        if (!confirm('Удалить продукт и все его материалы?')) break;
        try {
          await api(`/api/products/${productId}`, { method: 'DELETE' });
          close();
          if (onDeleted) onDeleted(); else if (onSaved) onSaved();
        } catch (err) { alert(err.message); }
        break;
      default: break;
    }
  });

  overlay.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    if (!form.reportValidity()) return;
    if (model.stages.some((st) => st.from > st.to)) {
      alert('Дата начала этапа позже даты окончания');
      return;
    }
    const body = { ...model };
    try {
      if (editing) await api(`/api/products/${productId}`, { method: 'PUT', body });
      else await api('/api/products', { method: 'POST', body });
      close();
      if (onSaved) onSaved();
    } catch (err) {
      alert(err.status === 401 ? 'Войдите как администратор' : err.message);
    }
  });

  render();
  const first = overlay.querySelector('[data-role="name"]');
  if (first && !editing) first.focus();
}
