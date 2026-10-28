// Окно «Добавить материал»: ссылка или файл (доступно всем)
import { esc, api, fileExt, ICON } from './common.js';

const FIELD = 'display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 500; color: #44445C;';
const INPUT = 'height: 44px; border: 1px solid #8A8AC2; border-radius: 8px; padding: 0 12px; font: inherit; font-size: 15px; font-weight: 400; color: #000000;';
const SELECT = 'height: 44px; border: 1px solid #8A8AC2; border-radius: 8px; padding: 0 10px; font: inherit; font-size: 15px; font-weight: 400; color: #000000; background: #FFFFFF;';

export function openMaterialModal(state, { productId = null, tab = 'link', files = [], onSaved } = {}) {
  const products = state.products;
  const m = {
    tab,
    url: '',
    title: '',
    titleAuto: false,
    productId: productId || (products[0] && products[0].id) || null,
    linkCategory: state.categories[0],
    fileCategory: state.categories[0],
    queue: [],
    uploading: false,
    busy: false, // идёт сохранение ссылки — повторное нажатие «Добавить» не создаёт дубль
    closed: false,
    uploaded: 0, // сколько файлов уже загружено — страницу обновим, даже если окно закрыли посреди очереди
  };
  const existingFiles = {}; // productId → { имя файла: последняя версия }
  let titleRequest = 0;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position: fixed; inset: 0; overflow-y: auto; background: rgba(0,0,0,0.4); display: flex; justify-content: center; align-items: flex-start; padding: 64px 40px; box-sizing: border-box; z-index: 20; font-family: \'TT Norms Pro\', Manrope, system-ui, sans-serif; color: #000000;';
  document.body.appendChild(overlay);

  // Выбор файлов живёт вне перерисовываемой разметки, чтобы выбранные файлы не терялись
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.hidden = true;
  fileInput.dataset.role = 'file-input';
  fileInput.addEventListener('change', () => {
    addFiles([...fileInput.files]);
    fileInput.value = '';
  });
  document.body.appendChild(fileInput);

  async function loadExisting(pid) {
    if (!pid || existingFiles[pid]) return;
    const d = await api(`/api/products/${pid}`);
    existingFiles[pid] = Object.fromEntries(d.materials.filter((x) => x.kind === 'file').map((x) => [x.title, x.version]));
    // Перерисовываем, только если список нужен прямо сейчас (плашка «версия N»), — иначе собьём ввод в полях
    if (m.tab === 'file' && m.queue.length) render();
  }

  function productSelect() {
    return `<label style="${FIELD}">Продукт
          <select data-role="product" style="${SELECT}">${products.map((p) => `<option value="${p.id}"${p.id === m.productId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
        </label>`;
  }
  function categorySelect(value) {
    return `<label style="${FIELD}">Тип материала
          <select data-role="category" style="${SELECT}">${state.categories.map((c) => `<option${c === value ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select>
        </label>`;
  }

  function linkBody() {
    return `
      <label style="${FIELD}">Адрес ссылки
        <input type="url" data-role="url" value="${esc(m.url)}" style="${INPUT}">
      </label>
      <label style="${FIELD}">Название
        <input type="text" data-role="title" value="${esc(m.title)}" style="${INPUT}">${m.titleAuto ? `
        <span style="font-size: 12px; font-weight: 400; color: #5C5C73;">Подставили из ссылки — можно поменять</span>` : ''}
      </label>
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;">
        ${productSelect()}
        ${categorySelect(m.linkCategory)}
      </div>`;
  }

  function versionOf(name) {
    const known = existingFiles[m.productId];
    return known && known[name] ? known[name] : 0;
  }

  function fileBody() {
    const rows = m.queue.map((f, i) => `
        <div data-item="${i}" style="display: grid; grid-template-columns: 40px minmax(0, 1fr) 40px; gap: 12px; align-items: center;">
          <span style="width: 40px; height: 40px; border-radius: 6px; background: #F2F2FE; color: #0000FF; font-size: 11px; font-weight: 500; display: flex; align-items: center; justify-content: center;">${esc(fileExt(f.file.name))}</span>
          <div style="display: flex; flex-direction: column; gap: 6px; min-width: 0;">
            <div style="display: flex; justify-content: space-between; font-size: 14px;"><span>${esc(f.file.name)}</span><span data-role="percent" style="color: #5C5C73; font-size: 13px;">${f.progress}%</span></div>
            <div style="height: 4px; border-radius: 2px; background: #E0E0F5;"><div data-role="bar" style="width: ${f.progress}%; height: 4px; border-radius: 2px; background: #0000FF;"></div></div>
          </div>
          <button type="button" data-action="cancel-file" data-i="${i}" aria-label="Отменить загрузку" style="width: 40px; height: 40px; border: 0; border-radius: 6px; background: transparent; color: #44445C; display: flex; align-items: center; justify-content: center; cursor: pointer;"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"></path></svg></button>
        </div>`).join('');
    const notes = m.queue.map((f) => versionOf(f.file.name)).filter(Boolean).map((v) => `
        <div style="display: flex; gap: 10px; background: #F2F2FE; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.45; color: #000000;">
          <svg aria-hidden="true" style="flex: none; margin-top: 1px;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0000FF" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg>
          <span>Файл с таким именем уже есть. Сохраним его как версию ${v + 1}, версия ${v} останется в истории</span>
        </div>`).join('');
    return `
      <div data-role="dropzone" style="border: 1.5px dashed #9999E0; border-radius: 8px; padding: 26px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; background: #F2F2FE;">
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0000FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0-4 4m4-4 4 4M5 20h14"></path></svg>
        <span style="font-size: 15px;">Перетащите файлы или <button type="button" data-action="pick-files" style="padding: 0; border: 0; background: transparent; font: inherit; color: #0000FF; cursor: pointer;">выберите на компьютере</button></span>
        <span style="font-size: 13px; color: #5C5C73;">PDF, PPTX, DOCX, XLSX, изображения, ZIP — до 200 МБ</span>
      </div>${m.queue.length ? `
      <div style="display: flex; flex-direction: column; gap: 8px;">${rows}${notes}
      </div>` : ''}
      <div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px;">
        ${productSelect()}
        ${categorySelect(m.fileCategory)}
      </div>`;
  }

  function tabButton(key, label) {
    const on = m.tab === key;
    return `<button type="button" data-action="tab" data-tab="${key}" aria-pressed="${on}" style="flex: 1; height: 38px; border: 0; border-radius: 6px; ${on ? 'background: #FFFFFF; font: inherit; font-size: 14px; font-weight: 500; color: #0000FF;' : 'background: transparent; font: inherit; font-size: 14px; color: #000000;'} cursor: pointer;">${label}</button>`;
  }

  function render() {
    const isLink = m.tab === 'link';
    overlay.innerHTML = `<form class="dialog" role="dialog" aria-label="${isLink ? 'Добавить ссылку' : 'Загрузить файл'}" novalidate style="width: 560px; max-width: 100%; background: #FFFFFF; border-radius: 12px; display: flex; flex-direction: column; box-shadow: 0 24px 60px rgba(0,0,40,0.25); margin: 0;">
    <div style="display: flex; align-items: center; gap: 12px; padding: 24px 28px 0;">
      <h2 style="margin: 0; font-size: 26px; font-weight: 400; margin-right: auto;">Добавить материал</h2>
      <button type="button" data-action="close" aria-label="Закрыть" style="width: 40px; height: 40px; padding: 0; border: 0; border-radius: 8px; background: #F2F2FE; color: #000000; display: flex; align-items: center; justify-content: center; cursor: pointer;">${ICON.close18}</button>
    </div>
    <div style="padding: 20px 28px 24px; display: flex; flex-direction: column; gap: 18px;">
      <div role="group" aria-label="Ссылка или файл" style="display: flex; background: #E0E0F5; border-radius: 8px; padding: 4px; gap: 2px;">
        ${tabButton('link', 'Ссылка')}
        ${tabButton('file', 'Файл')}
      </div>${isLink ? linkBody() : fileBody()}
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px; padding: 18px 28px; border-top: 1px solid #E0E0F5;">
      <button type="button" data-action="close" style="display: inline-flex; align-items: center; height: 44px; padding: 0 18px; box-sizing: content-box; border: 1px solid #8A8AC2; border-radius: 8px; background: #FFFFFF; color: #000000; font: inherit; font-size: 15px; cursor: pointer;">Отмена</button>
      <button type="submit"${m.uploading ? ' disabled' : ''} style="display: inline-flex; align-items: center; height: 44px; padding: 0 22px; border: 0; border-radius: 8px; background: #0000FF; color: #FFFFFF; font: inherit; font-size: 15px; font-weight: 500; cursor: pointer;">${isLink ? 'Добавить' : 'Загрузить'}</button>
    </div>
  </form>`;
  }

  function addFiles(list) {
    for (const file of list) m.queue.push({ file, progress: 0, xhr: null });
    render();
  }

  function close() {
    if (m.closed) return;
    m.closed = true;
    const queue = m.queue;
    m.queue = [];
    for (const f of queue) if (f.xhr) f.xhr.abort();
    overlay.remove();
    fileInput.remove();
    document.removeEventListener('keydown', onKey);
    if (m.uploaded && onSaved) onSaved();
  }
  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  async function fetchTitle() {
    const url = m.url.trim();
    if (!/^https?:\/\/\S+/i.test(url) || (m.title && !m.titleAuto)) return;
    const req = ++titleRequest;
    try {
      const { title } = await api(`/api/link-title?url=${encodeURIComponent(url)}`);
      if (req !== titleRequest || !title || (m.title && !m.titleAuto)) return;
      m.title = title;
      m.titleAuto = true;
      render();
    } catch { /* не удалось — пользователь введёт название сам */ }
  }

  function uploadOne(item) {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      fd.append('productId', String(m.productId));
      fd.append('category', m.fileCategory);
      fd.append('file', item.file);
      const xhr = new XMLHttpRequest();
      item.xhr = xhr;
      xhr.open('POST', '/api/materials/file');
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        item.progress = Math.round((e.loaded / e.total) * 100);
        const row = overlay.querySelector(`[data-item="${m.queue.indexOf(item)}"]`);
        if (row) {
          row.querySelector('[data-role="percent"]').textContent = `${item.progress}%`;
          row.querySelector('[data-role="bar"]').style.width = `${item.progress}%`;
        }
      };
      xhr.onload = () => {
        item.xhr = null;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else {
          let msg = 'Не удалось загрузить файл';
          try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* не JSON */ }
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => { item.xhr = null; reject(new Error('Не удалось загрузить файл')); };
      xhr.onabort = () => { item.xhr = null; resolve('aborted'); };
      xhr.send(fd);
    });
  }

  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);

  overlay.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.role === 'url') m.url = t.value;
    else if (t.dataset.role === 'title') { m.title = t.value; m.titleAuto = false; }
  });

  overlay.addEventListener('change', (e) => {
    const t = e.target;
    const role = t.dataset.role;
    if (role === 'url') fetchTitle();
    else if (role === 'product') { m.productId = Number(t.value); loadExisting(m.productId); render(); }
    else if (role === 'category') { if (m.tab === 'link') m.linkCategory = t.value; else m.fileCategory = t.value; }
  });

  // Название по ссылке подставляем и при вставке адреса, не дожидаясь ухода из поля
  overlay.addEventListener('paste', (e) => {
    if (e.target.dataset.role === 'url') setTimeout(() => { m.url = e.target.value; fetchTitle(); }, 0);
  });

  overlay.addEventListener('dragover', (e) => {
    if (m.tab === 'file' && e.target.closest('[data-role="dropzone"]')) e.preventDefault();
  });
  overlay.addEventListener('drop', (e) => {
    if (m.tab !== 'file' || !e.target.closest('[data-role="dropzone"]')) return;
    e.preventDefault();
    addFiles([...e.dataTransfer.files]);
  });

  overlay.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (!t) return;
    switch (t.dataset.action) {
      case 'close': close(); break;
      case 'tab': if (!m.uploading) { m.tab = t.dataset.tab; render(); } break;
      case 'pick-files': fileInput.click(); break;
      case 'cancel-file': {
        const item = m.queue[Number(t.dataset.i)];
        if (item.xhr) item.xhr.abort();
        m.queue.splice(Number(t.dataset.i), 1);
        render();
        break;
      }
      default: break;
    }
  });

  overlay.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (m.tab === 'link') {
      if (!/^https?:\/\/\S+/i.test(m.url.trim())) {
        const input = overlay.querySelector('[data-role="url"]');
        input.setCustomValidity('Введите адрес ссылки');
        input.reportValidity();
        input.setCustomValidity('');
        return;
      }
      if (m.busy) return;
      m.busy = true;
      try {
        await api('/api/materials/link', { method: 'POST', body: { url: m.url.trim(), title: m.title, productId: m.productId, category: m.linkCategory } });
        m.uploaded += 1;
        close();
      } catch (err) {
        alert(err.message);
      } finally {
        m.busy = false;
      }
      return;
    }
    if (!m.queue.length || m.uploading) return;
    m.uploading = true;
    render();
    try {
      while (m.queue.length && !m.closed) {
        const item = m.queue[0];
        if ((await uploadOne(item)) !== 'aborted') m.uploaded += 1;
        const i = m.queue.indexOf(item);
        if (i >= 0) m.queue.splice(i, 1);
        if (!m.closed) render();
      }
      close();
    } catch (err) {
      m.uploading = false;
      render();
      alert(err.message);
    }
  });

  render();
  loadExisting(m.productId);
  if (files.length) addFiles(files);
}
