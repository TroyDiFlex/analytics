// =============================================
//  ХРАНИЛИЩЕ: Google Sheets через Apps Script
//  + fallback на localStorage пока не настроен
// =============================================

// URL Apps Script
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby4BjEWBgxpJMswEjC_GD1CeF5Oq9du7UyehkTI7lPSl4lVLOr4eYkJA2o9OmIJzMoh/exec';

// Ключ сессии — вводится один раз при входе, хранится в localStorage
function getSecretKey() {
  return localStorage.getItem('secret_key') || '';
}

// ──────────────────────────────────────────────
//  ЗАГРУЗКА прогресса с Google Sheets
// ──────────────────────────────────────────────
async function loadProgress() {
  const url = SCRIPT_URL;
  const key = getSecretKey();

  if (!url) {
    // Google Sheets ещё не настроен — грузим из localStorage
    const local = localStorage.getItem('progress_local');
    return local ? JSON.parse(local) : null;
  }

  try {
    const res = await fetch(`${url}?action=get&key=${encodeURIComponent(key)}`);
    const data = await res.json();

    if (data && data.error === 'Unauthorized') {
      throw new Error('Unauthorized');
    }
    return data;
  } catch (e) {
    if (e.message === 'Unauthorized') {
      throw e;
    }
    console.warn('Google Sheets недоступен, читаю из localStorage:', e);
    const local = localStorage.getItem('progress_local');
    return local ? JSON.parse(local) : null;
  }
}

// ──────────────────────────────────────────────
//  СОХРАНЕНИЕ прогресса в Google Sheets
// ──────────────────────────────────────────────
let saveTimer = null;

function saveProgress(progressData) {
  // Всегда сохраняем локально как резервную копию
  localStorage.setItem('progress_local', JSON.stringify(progressData));

  // Debounce: отправляем в Google только через 1.5 сек после последнего изменения
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => pushToSheets(progressData), 1500);
}

async function pushToSheets(progressData) {
  const url = SCRIPT_URL;
  const key = getSecretKey();

  if (!url) return; // Не настроен — ок, уже в localStorage

  try {
    showSaving();
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ key, data: progressData })
    });
    showSaved();
  } catch (e) {
    console.warn('Не удалось сохранить в Google Sheets:', e);
    showSaved(); // Показываем успех т.к. данные в localStorage
  }
}

// ──────────────────────────────────────────────
//  СОЗДАНИЕ пустой структуры прогресса
// ──────────────────────────────────────────────
function createEmptyProgress() {
  const progress = {
    started: new Date().toISOString().slice(0, 10),
    phases: {}
  };

  PHASES.forEach(phase => {
    const topics = {};
    phase.topics.forEach((_, i) => { topics[i] = null; });

    const tasks = {};
    phase.tasks.forEach((_, i) => { tasks[i] = null; });

    const notes = { phase: '' };
    phase.tasks.forEach((_, i) => { notes[`task_${i}`] = ''; });

    progress.phases[phase.id] = { topics, tasks, notes };
  });

  return progress;
}

// ──────────────────────────────────────────────
//  ИНДИКАТОР СОХРАНЕНИЯ
// ──────────────────────────────────────────────
let savedTimer = null;

function showSaving() {
  const el = document.getElementById('save-indicator');
  el.innerHTML = '<i class="ti ti-loader spin"></i> Сохраняю...';
  el.classList.remove('hidden');
}

function showSaved() {
  const el = document.getElementById('save-indicator');
  el.innerHTML = '<i class="ti ti-check"></i> Сохранено';
  el.classList.remove('hidden');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => el.classList.add('hidden'), 2000);
}

// ──────────────────────────────────────────────
//  ЭКСПОРТ прогресса в JSON файл
// ──────────────────────────────────────────────
function exportProgress() {
  const data = localStorage.getItem('progress_local');
  if (!data) { alert('Нет данных для экспорта'); return; }

  const blob = new Blob([data], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `progress_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
