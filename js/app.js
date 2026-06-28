// =============================================
//  ГЛАВНАЯ ЛОГИКА ПРИЛОЖЕНИЯ
// =============================================

let progress  = null;   // текущий прогресс
let activePhaseId = null; // открытый этап

// ──────────────────────────────────────────────
//  ВХОД / ЛОГИН
// ──────────────────────────────────────────────

// При нажатии Enter в поле ключа
document.getElementById('key-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});

async function handleLogin() {
  const input = document.getElementById('key-input').value.trim();
  if (!input) return;

  const errorEl   = document.getElementById('login-error');
  const loadingEl = document.getElementById('login-loading');

  errorEl.classList.add('hidden');
  loadingEl.classList.remove('hidden');

  // Сохраняем ключ в браузере
  localStorage.setItem('secret_key', input);

  try {
    // Пробуем загрузить прогресс
    const loaded = await loadProgress();
    progress = loaded || createEmptyProgress();

    // Если Google Sheets не настроен — это нормально, работаем с localStorage
    showApp();
  } catch (err) {
    localStorage.removeItem('secret_key');
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
  }
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('login-loading').classList.add('hidden');

  renderSidebar();
  updateHeaderStats();

  // Открываем первый незавершённый этап
  const firstIncomplete = PHASES.find(p => !isPhaseComplete(p.id));
  openPhase(firstIncomplete ? firstIncomplete.id : PHASES[0].id);
}

function logout() {
  if (!confirm('Выйти? Ключ будет удалён из этого браузера.')) return;
  localStorage.removeItem('secret_key');
  location.reload();
}

// При загрузке: проверяем, есть ли уже ключ
window.addEventListener('load', async () => {
  const savedKey = localStorage.getItem('secret_key');
  if (savedKey) {
    document.getElementById('key-input').value = savedKey;
    const loadingEl = document.getElementById('login-loading');
    loadingEl.classList.remove('hidden');
    try {
      const loaded = await loadProgress();
      progress = loaded || createEmptyProgress();
      showApp();
    } catch {
      localStorage.removeItem('secret_key');
      loadingEl.classList.add('hidden');
    }
  }
});

// ──────────────────────────────────────────────
//  БОКОВАЯ ПАНЕЛЬ
// ──────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  PHASES.forEach(phase => {
    const doneTopics = countDone(phase.id, 'topics', phase.topics.length);
    const totalTopics = phase.topics.length;
    const complete = doneTopics === totalTopics;

    const btn = document.createElement('button');
    btn.className = 'sidebar-nav-item' + (activePhaseId === phase.id ? ' active' : '');
    btn.id = `nav-item-${phase.id}`;
    btn.onclick = () => openPhase(phase.id);

    btn.innerHTML = `
      <div class="sidebar-nav-icon" style="background:${phase.accent}18; color:${phase.accent}">
        <i class="ti ${phase.icon}"></i>
      </div>
      <div class="sidebar-nav-info">
        <div class="sidebar-nav-title">${phase.title}</div>
        <div class="sidebar-nav-progress">${doneTopics}/${totalTopics} тем${phase.optional ? ' · опц.' : ''}</div>
      </div>
      ${complete ? '<span class="sidebar-nav-badge"><i class="ti ti-check"></i></span>' : ''}
    `;

    nav.appendChild(btn);
  });

  updateOverallBar();
}

function updateOverallBar() {
  const totalDone = PHASES.reduce((s, p) => s + countDone(p.id, 'topics', p.topics.length), 0);
  const pct = Math.round((totalDone / TOTAL_TOPICS) * 100);

  document.getElementById('sidebar-overall-bar').style.width = pct + '%';
  document.getElementById('sidebar-overall-text').textContent = `${totalDone} / ${TOTAL_TOPICS} топиков`;
}

// ──────────────────────────────────────────────
//  ШАПКА
// ──────────────────────────────────────────────
function updateHeaderStats() {
  const totalDone = PHASES.reduce((s, p) => s + countDone(p.id, 'topics', p.topics.length), 0);
  const pct = Math.round((totalDone / TOTAL_TOPICS) * 100);

  document.getElementById('header-progress-text').textContent = `${totalDone} из ${TOTAL_TOPICS} тем`;
  document.getElementById('header-progress-bar').style.width  = pct + '%';

  if (progress && progress.started) {
    const start = new Date(progress.started);
    const now   = new Date();
    const days  = Math.max(1, Math.floor((now - start) / 86400000) + 1);
    document.getElementById('header-days').textContent = `день ${days}`;
  }
}

// ──────────────────────────────────────────────
//  ОТКРЫТЬ ЭТАП
// ──────────────────────────────────────────────
function openPhase(phaseId) {
  activePhaseId = phaseId;

  // Подсветка в сайдбаре
  document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
  const navItem = document.getElementById(`nav-item-${phaseId}`);
  if (navItem) navItem.classList.add('active');

  const phase = PHASES.find(p => p.id === phaseId);
  if (!phase) return;

  const ph = getPhaseProgress(phaseId);
  const doneTopics = countDone(phaseId, 'topics', phase.topics.length);
  const doneTasks  = countDone(phaseId, 'tasks',  phase.tasks.length);
  const complete   = doneTopics === phase.topics.length;

  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="phase-content">

      <!-- ЗАГОЛОВОК -->
      <div class="phase-header">
        <div class="phase-icon-big" style="background:${phase.accent}18; color:${phase.accent}">
          <i class="ti ${phase.icon}"></i>
        </div>
        <div class="phase-header-info">
          <div class="phase-num" style="color:${phase.accent}">Этап ${String(phase.id).padStart(2,'0')}</div>
          <div class="phase-title">${phase.title}</div>
          <div class="phase-meta">
            <span class="phase-duration">
              <i class="ti ti-clock" style="font-size:13px"></i>
              ${phase.duration}
            </span>
            ${phase.optional ? '<span class="phase-badge-optional"><i class="ti ti-star" style="font-size:11px"></i> Необязательный</span>' : ''}
            ${complete ? '<span class="phase-badge-done"><i class="ti ti-check"></i> Завершён</span>' : ''}
          </div>
        </div>
      </div>

      <!-- ПРОГРЕСС ЭТАПА -->
      <div class="phase-progress-block">
        <div class="phase-progress-item">
          <div class="phase-progress-label">Темы</div>
          <div class="phase-progress-bar-wrap">
            <div class="phase-progress-bar" style="width:${Math.round(doneTopics/phase.topics.length*100)}%; background:${phase.accent}"></div>
          </div>
          <div class="phase-progress-count">${doneTopics} / ${phase.topics.length}</div>
        </div>
        <div class="phase-progress-item">
          <div class="phase-progress-label">Задания</div>
          <div class="phase-progress-bar-wrap">
            <div class="phase-progress-bar" style="width:${Math.round(doneTasks/phase.tasks.length*100)}%; background:#6366f1"></div>
          </div>
          <div class="phase-progress-count">${doneTasks} / ${phase.tasks.length}</div>
        </div>
      </div>

      <!-- ЗАМЕТКА ЭТАПА -->
      ${phase.note ? `<div class="phase-note" style="border-color:${phase.accent}">${phase.note}</div>` : ''}

      <!-- ТЕМЫ -->
      <div class="section-title"><i class="ti ti-list-check"></i> Темы для изучения</div>
      <div class="topics-list">
        ${phase.topics.map((t, i) => renderTopic(phaseId, i, t, ph)).join('')}
      </div>

      <!-- ПОДСКАЗКИ -->
      ${phase.hints.length > 0 ? `
        <div class="section-title" style="margin-top:1rem"><i class="ti ti-alert-triangle" style="color:var(--warning)"></i> Подсказки</div>
        <div class="hints-list">
          ${phase.hints.map((h, i) => renderHint(h, i, phaseId)).join('')}
        </div>
      ` : ''}

      <!-- ПРАКТИЧЕСКИЕ ЗАДАНИЯ -->
      <div class="section-title" style="margin-top:1rem"><i class="ti ti-pencil-check" style="color:#6366f1"></i> Практические задания</div>
      <div class="tasks-list">
        ${phase.tasks.map((t, i) => renderTask(phaseId, i, t, ph)).join('')}
      </div>

      <!-- РЕСУРСЫ -->
      <div class="resources-block">
        <div class="section-title"><i class="ti ti-books"></i> Ресурсы</div>
        <div class="resources-list">
          ${phase.resources.map(r => `<span class="res-pill"><i class="ti ti-link" style="font-size:11px"></i>${r}</span>`).join('')}
        </div>
      </div>

      <!-- МОИ ЗАМЕТКИ -->
      <div class="phase-notes-block">
        <div class="section-title"><i class="ti ti-notes"></i> Мои заметки к этапу</div>
        <textarea
          class="phase-textarea"
          id="phase-note-${phaseId}"
          placeholder="Пиши сюда всё что угодно — выводы, ссылки, мысли..."
          oninput="onPhaseNote(${phaseId}, this.value)"
        >${ph.notes.phase || ''}</textarea>
      </div>

      <!-- СБРОСИТЬ -->
      <button class="reset-btn" onclick="resetPhase(${phaseId})">
        <i class="ti ti-refresh"></i> Сбросить прогресс этого этапа
      </button>

    </div>
  `;
}

// ──────────────────────────────────────────────
//  РЕНДЕР ТЕМЫ
// ──────────────────────────────────────────────
function renderTopic(phaseId, idx, topic, ph) {
  const date  = ph.topics[idx];
  const done  = !!date;
  const phase = PHASES.find(p => p.id === phaseId);

  return `
    <div class="topic-item ${done ? 'done' : ''}" id="topic-${phaseId}-${idx}" onclick="toggleTopic(${phaseId}, ${idx})">
      <div class="topic-checkbox">
        ${done ? '<i class="ti ti-check"></i>' : ''}
      </div>
      <div class="topic-body">
        <div class="topic-name">${topic.name}</div>
        <div class="topic-desc">${topic.desc}</div>
        ${done ? `<div class="topic-date"><i class="ti ti-calendar" style="font-size:11px"></i> ${formatDate(date)}</div>` : ''}
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────
//  РЕНДЕР ПОДСКАЗКИ
// ──────────────────────────────────────────────
function renderHint(hint, idx, phaseId) {
  return `
    <details class="hint-details">
      <summary class="hint-summary">
        <i class="ti ti-alert-triangle hint-summary-icon"></i>
        <span class="hint-summary-title">${hint.title}</span>
        <i class="ti ti-chevron-down hint-chevron"></i>
      </summary>
      <div class="hint-body">${hint.text}</div>
    </details>
  `;
}

// ──────────────────────────────────────────────
//  РЕНДЕР ЗАДАНИЯ
// ──────────────────────────────────────────────
function renderTask(phaseId, idx, task, ph) {
  const date = ph.tasks[idx];
  const done = !!date;
  const note = ph.notes[`task_${idx}`] || '';

  return `
    <div class="task-card ${done ? 'done' : ''}" id="task-card-${phaseId}-${idx}">
      <div class="task-top">
        <button class="task-checkbox" onclick="toggleTask(${phaseId}, ${idx})">
          ${done ? '<i class="ti ti-check"></i>' : ''}
        </button>
        <div>
          <div class="task-text">${task.text}</div>
          ${done ? `<div class="task-date"><i class="ti ti-calendar" style="font-size:11px"></i> Выполнено ${formatDate(date)}</div>` : ''}
        </div>
      </div>
      <textarea
        class="task-note-input"
        placeholder="Заметка к заданию (результат, ссылка, вывод)..."
        oninput="onTaskNote(${phaseId}, ${idx}, this.value)"
      >${note}</textarea>
    </div>
  `;
}

// ──────────────────────────────────────────────
//  ПЕРЕКЛЮЧЕНИЕ ГАЛОЧЕК
// ──────────────────────────────────────────────
function toggleTopic(phaseId, idx) {
  const ph   = getPhaseProgress(phaseId);
  const done = !!ph.topics[idx];

  ph.topics[idx] = done ? null : new Date().toISOString().slice(0, 10);
  progress.phases[phaseId] = ph;
  saveProgress(progress);

  // Перерисовываем этап и статистику
  openPhase(phaseId);
  renderSidebar();
  updateHeaderStats();
}

function toggleTask(phaseId, idx) {
  const ph   = getPhaseProgress(phaseId);
  const done = !!ph.tasks[idx];

  ph.tasks[idx] = done ? null : new Date().toISOString().slice(0, 10);
  progress.phases[phaseId] = ph;
  saveProgress(progress);

  openPhase(phaseId);
  renderSidebar();
  updateHeaderStats();
}

// ──────────────────────────────────────────────
//  ЗАМЕТКИ
// ──────────────────────────────────────────────
function onPhaseNote(phaseId, value) {
  const ph = getPhaseProgress(phaseId);
  ph.notes.phase = value;
  progress.phases[phaseId] = ph;
  saveProgress(progress);
}

function onTaskNote(phaseId, taskIdx, value) {
  const ph = getPhaseProgress(phaseId);
  ph.notes[`task_${taskIdx}`] = value;
  progress.phases[phaseId] = ph;
  saveProgress(progress);
}

// ──────────────────────────────────────────────
//  СБРОС ЭТАПА
// ──────────────────────────────────────────────
function resetPhase(phaseId) {
  const phase = PHASES.find(p => p.id === phaseId);
  if (!confirm(`Сбросить весь прогресс этапа «${phase.title}»? Это нельзя отменить.`)) return;

  const topics = {};
  phase.topics.forEach((_, i) => { topics[i] = null; });
  const tasks = {};
  phase.tasks.forEach((_, i) => { tasks[i] = null; });
  const notes = { phase: '' };
  phase.tasks.forEach((_, i) => { notes[`task_${i}`] = ''; });

  progress.phases[phaseId] = { topics, tasks, notes };
  saveProgress(progress);

  openPhase(phaseId);
  renderSidebar();
  updateHeaderStats();
}

// ──────────────────────────────────────────────
//  ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ──────────────────────────────────────────────
function getPhaseProgress(phaseId) {
  if (!progress.phases[phaseId]) {
    const phase = PHASES.find(p => p.id === phaseId);
    const topics = {}, tasks = {}, notes = { phase: '' };
    phase.topics.forEach((_, i) => { topics[i] = null; });
    phase.tasks.forEach((_, i) => { tasks[i] = null; notes[`task_${i}`] = ''; });
    progress.phases[phaseId] = { topics, tasks, notes };
  }
  return progress.phases[phaseId];
}

function countDone(phaseId, type, total) {
  const ph = progress?.phases?.[phaseId];
  if (!ph || !ph[type]) return 0;
  let count = 0;
  for (let i = 0; i < total; i++) {
    if (ph[type][i]) count++;
  }
  return count;
}

function isPhaseComplete(phaseId) {
  const phase = PHASES.find(p => p.id === phaseId);
  return countDone(phaseId, 'topics', phase.topics.length) === phase.topics.length;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}
