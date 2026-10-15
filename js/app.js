/* App shell: helpers, modal/forms, router, dashboard, reports, notifications, settings. */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => s ? new Date(s + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const initials = n => String(n).split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const S = () => DB.data.settings;
const memberName = id => DB.get('team', id)?.name || 'Unassigned';
const projName = id => DB.get('projects', id)?.name || 'No project';
const icons = () => window.lucide && lucide.createIcons();
const empty = (t, d) => `<div class="empty"><i data-lucide="inbox"></i><strong>${t}</strong><p>${d}</p></div>`;
const sel = (k, n, label, opts) => `<select data-f="${k}.${n}" aria-label="${label}">${opts.map(([v, l]) => `<option value="${esc(v)}" ${String(F[k][n]) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const mobile = () => matchMedia('(max-width:900px)').matches;
const RANGES = { 0: 'All time', 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days' };
const COL = { Pending: '#D99A1E', 'In Progress': '#2F7FB8', Completed: '#2E9E6B', Overdue: '#D6453D' };
let cur = 'dashboard';
const charts = {};

function toast(msg, type = 'ok') { const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.remove(), 3200); }
function log(text) { DB.data.log.unshift({ text, ts: Date.now() }); DB.data.log.length = Math.min(DB.data.log.length, 30); DB.save(); }
function refresh() { go(); }

/* ---- Modal, forms, confirmation ---- */
function openModal(title, body) {
  $('#modalRoot').innerHTML = `<div class="modal-bg"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mt"><div class="mh"><h2 id="mt">${title}</h2><button class="icon-btn" data-act="close" aria-label="Close"><i data-lucide="x"></i></button></div><div class="mb">${body}</div></div></div>`;
  icons(); const f = $('#modalRoot input,#modalRoot select,#modalRoot textarea,#modalRoot .btn.primary,#modalRoot .btn.danger'); if (f) f.focus();
}
const closeModal = () => { $('#modalRoot').innerHTML = ''; };
ACT.close = closeModal;
function confirmBox(msg, yes, label = 'Delete') {
  openModal('Please confirm', `<p>${msg}</p><div class="mf"><button class="btn ghost" data-act="close">Cancel</button><button class="btn danger" id="yes">${label}</button></div>`);
  $('#yes').onclick = () => { closeModal(); yes(); };
}
function openForm({ title, fields, values = {}, check, onSave }) {
  const inp = f => {
    const v = values[f.n] ?? '', a = `id="f_${f.n}" name="${f.n}"`;
    if (f.t === 'select') return `<select ${a}>${f.o.map(([x, l]) => `<option value="${esc(x)}" ${String(x) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    if (f.t === 'textarea') return `<textarea ${a} rows="3">${esc(v)}</textarea>`;
    return `<input ${a} type="${f.t || 'text'}" value="${esc(v)}">`;
  };
  openModal(title, `<form id="f" novalidate><div class="fgrid">${fields.map(f => `<div class="fld ${f.w ? 'full' : ''}"><label for="f_${f.n}">${f.l}${f.r ? ' *' : ''}</label>${inp(f)}<small class="err" id="e_${f.n}" role="alert"></small></div>`).join('')}</div>
    <div class="mf"><button type="button" class="btn ghost" data-act="close">Cancel</button><button class="btn primary">Save</button></div></form>`);
  $('#f').onsubmit = e => {
    e.preventDefault(); const o = {}, er = {};
    fields.forEach(f => { const v = $('#f_' + f.n).value.trim(); o[f.n] = v;
      if (f.r && !v) er[f.n] = 'This field is required';
      else if (f.t === 'email' && !/^\S+@\S+\.\S+$/.test(v)) er[f.n] = 'Enter a valid email address'; });
    const c = check && !Object.keys(er).length ? check(o) : {}; Object.assign(er, c);
    fields.forEach(f => { $('#e_' + f.n).textContent = er[f.n] || ''; $('#f_' + f.n).setAttribute('aria-invalid', !!er[f.n]); });
    const bad = fields.find(f => er[f.n]);
    if (bad) { $('#f_' + bad.n).focus(); return toast('Please fix the highlighted fields', 'err'); }
    closeModal(); onSave(o);
  };
}

/* ---- Statistics + charts ---- */
const scoped = () => { const r = +S().range, min = r ? day(-r) : ''; return DB.data.tasks.filter(t => t.due >= min); };
function stats() { const T = scoped(), c = s => T.filter(t => eff(t) === s).length; return { T, total: T.length, done: c('Completed'), pending: c('Pending'), prog: c('In Progress'), over: c('Overdue') }; }
function chart(id, cfg) {
  const c = $('#' + id); if (!c) return;
  if (!window.Chart) { c.parentNode.innerHTML = '<p class="muted">Charts need an internet connection to load Chart.js.</p>'; return; }
  const cs = getComputedStyle(document.documentElement);
  Chart.defaults.color = cs.getPropertyValue('--muted'); Chart.defaults.borderColor = cs.getPropertyValue('--line'); Chart.defaults.font.family = 'Public Sans, system-ui, sans-serif';
  cfg.options = { responsive: true, maintainAspectRatio: false, ...cfg.options };
  charts[id] = new Chart(c, cfg);
}

function renderDashboard() {
  const s = stats(), D = DB.data, st = (i, l, v, sub) => `<div class="stat"><i data-lucide="${i}"></i><div><small>${l}</small><strong>${v}</strong><em>${sub}</em></div></div>`;
  const cv = (id, t) => `<div class="card"><h2>${t}</h2><div class="cv"><canvas id="${id}" role="img" aria-label="${t}"></canvas></div></div>`;
  $('#content').innerHTML = `<div class="stats">${st('list-checks', 'Total tasks', s.total, RANGES[S().range]) + st('check-circle-2', 'Completed', s.done, pct(s.done, s.total) + '% completion rate') +
    st('clock', 'Pending', s.pending, s.over + ' overdue') + st('folder-kanban', 'Active projects', D.projects.filter(p => p.status === 'Active').length, D.projects.length + ' in total') + st('users', 'Team members', D.team.length, 'across ' + new Set(D.team.map(m => m.role)).size + ' roles')}</div>
    ${S().charts ? `<div class="grid2">${cv('c1', 'Task completion over time')}${cv('c2', 'Project progress')}${cv('c3', 'Tasks by status')}${cv('c4', 'Team productivity')}</div>` : ''}
    <div class="card"><div class="ch"><h2>Recent tasks</h2><a href="#tasks">View all</a></div>${taskTable([...s.T].sort((a, b) => b.id - a.id).slice(0, 6))}</div>`;
  if (!S().charts) return;
  const wk = [...Array(8)].map((_, i) => 7 - i);
  chart('c1', { type: 'line', data: { labels: wk.map(w => w ? w + 'w ago' : 'This week'), datasets: [{ label: 'Tasks completed', tension: .3, fill: true, borderColor: '#2E9E6B', backgroundColor: '#2E9E6B22',
    data: wk.map(w => D.tasks.filter(t => t.completedOn && Math.floor((Date.now() - new Date(t.completedOn + 'T00:00')) / 6048e5) === w).length) }] }, options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
  chart('c2', { type: 'bar', data: { labels: D.projects.map(p => p.name), datasets: [{ label: 'Progress (%)', data: D.projects.map(p => projPct(p.id)), backgroundColor: '#0E8A92' }] }, options: { indexAxis: 'y', scales: { x: { max: 100, beginAtZero: true } }, plugins: { legend: { display: false } } } });
  const sk = ['Pending', 'In Progress', 'Completed', 'Overdue'];
  chart('c3', { type: 'doughnut', data: { labels: sk, datasets: [{ data: sk.map(k => s.T.filter(t => eff(t) === k).length), backgroundColor: sk.map(k => COL[k]), borderWidth: 0 }] }, options: { plugins: { legend: { position: 'bottom' } } } });
  chart('c4', { type: 'bar', data: { labels: D.team.map(m => m.name.split(' ')[0]), datasets: [
    { label: 'Completed', data: D.team.map(m => s.T.filter(t => t.member == m.id && t.status === 'Completed').length), backgroundColor: COL.Completed },
    { label: 'Open', data: D.team.map(m => s.T.filter(t => t.member == m.id && t.status !== 'Completed').length), backgroundColor: COL['In Progress'] }] },
    options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } }, plugins: { legend: { position: 'bottom' } } } });
}

/* ---- Reports ---- */
function renderReports() {
  const s = stats(), D = DB.data, open = s.pending + s.prog;
  const dist = (list, key) => list.map(x => { const n = s.T.filter(t => key(t) === x).length; return `<div class="dr"><span>${x}</span>${bar(pct(n, s.total))}<b>${n}</b></div>`; }).join('');
  $('#content').innerHTML = `<div class="toolbar"><p class="muted grow">Showing tasks due: ${RANGES[S().range].toLowerCase()} (change in the header). Generated ${new Date().toLocaleString()}.</p><button class="btn primary" data-act="print"><i data-lucide="printer"></i>Print report</button></div>
    <div class="stats three"><div class="stat"><div><small>Completion rate</small><strong>${pct(s.done, s.total)}%</strong><em>${s.done} of ${s.total} tasks</em></div></div>
    <div class="stat"><div><small>Pending or in progress</small><strong>${open}</strong><em>open tasks</em></div></div><div class="stat"><div><small>Overdue</small><strong>${s.over}</strong><em>need attention</em></div></div></div>
    <div class="grid2"><div class="card"><h2>Project progress</h2>${D.projects.map(p => `<div class="dr"><span>${esc(p.name)}</span>${bar(projPct(p.id))}<b>${projPct(p.id)}%</b></div>`).join('') || empty('No projects', 'Add a project first.')}</div>
    <div class="card"><h2>Tasks by priority</h2>${dist(PRI, t => t.priority)}<h2 class="gap">Tasks by status</h2>${dist(['Pending', 'In Progress', 'Completed', 'Overdue'], eff)}</div></div>
    <div class="card"><h2>Team performance</h2>${D.team.length ? `<div class="tw"><table><thead><tr><th>Member</th><th>Assigned</th><th>Completed</th><th>Overdue</th><th>Completion</th></tr></thead><tbody>${D.team.map(m => { const T = s.T.filter(t => t.member == m.id), d = T.filter(t => t.status === 'Completed').length;
    return `<tr><td data-l="Member"><strong>${esc(m.name)}</strong></td><td data-l="Assigned">${T.length}</td><td data-l="Completed">${d}</td><td data-l="Overdue">${T.filter(t => eff(t) === 'Overdue').length}</td><td data-l="Completion">${pct(d, T.length)}%</td></tr>`; }).join('')}</tbody></table></div>` : empty('No team members', 'Add members to see performance.')}</div>`;
}
ACT.print = () => window.print();

/* ---- Notifications ---- */
function notes() {
  const s = S(), n = [], mid = new Date().setHours(0, 0, 0, 0);
  if (s.nDeadline) DB.data.tasks.filter(t => t.status !== 'Completed').forEach(t => {
    const d = Math.round((new Date(t.due + 'T00:00') - mid) / 864e5);
    if (d < 0) n.push({ i: 'alert-triangle', x: `“${t.name}” is ${-d} day${d < -1 ? 's' : ''} overdue`, ts: mid, w: 1 });
    else if (d <= 3) n.push({ i: 'calendar-clock', x: `“${t.name}” is due ${d ? 'in ' + d + ' day' + (d > 1 ? 's' : '') : 'today'}`, ts: mid, w: 1 });
  });
  if (s.nActivity) DB.data.log.forEach(l => n.push({ i: 'activity', x: l.text, ts: l.ts }));
  return n.sort((a, b) => b.ts - a.ts);
}
function renderNotifications() {
  const l = notes(), r = S().readAt;
  $('#content').innerHTML = `<div class="toolbar"><p class="muted grow">${l.filter(x => x.ts > r).length} unread</p><button class="btn ghost" data-act="markread"><i data-lucide="check-check"></i>Mark all as read</button></div>
    <div class="card">${l.length ? `<ul class="notes">${l.map(x => `<li class="${x.ts > r ? 'unread' : ''} ${x.w ? 'warn' : ''}"><i data-lucide="${x.i}"></i><span>${esc(x.x)}</span><small>${x.w ? 'Deadline' : new Date(x.ts).toLocaleString()}</small></li>`).join('')}</ul>` : empty('You are all caught up', 'Deadline alerts and activity appear here. Manage them in Settings.')}</div>`;
}
ACT.markread = () => { S().readAt = Date.now(); DB.save(); toast('Notifications marked as read'); refresh(); };

/* ---- Settings ---- */
function renderSettings() {
  const s = S(), chk = (k, l) => `<label class="check"><input type="checkbox" data-s="${k}" ${s[k] ? 'checked' : ''}> ${l}</label>`;
  $('#content').innerHTML = `<div class="grid2"><div class="card"><h2>Profile</h2><div class="fld"><label for="s_name">Full name</label><input id="s_name" data-s="name" value="${esc(s.name)}"></div>
    <div class="fld"><label for="s_role">Role</label><input id="s_role" data-s="role" value="${esc(s.role)}"></div></div>
    <div class="card"><h2>Appearance</h2><div class="fld"><label for="s_theme">Theme</label><select id="s_theme" data-s="theme">${['light', 'dark', 'system'].map(x => `<option value="${x}" ${s.theme === x ? 'selected' : ''}>${x[0].toUpperCase() + x.slice(1)}</option>`).join('')}</select></div>
    ${chk('compact', 'Compact density')}${chk('charts', 'Show charts on the dashboard')}</div>
    <div class="card"><h2>Notifications</h2>${chk('nDeadline', 'Deadline and overdue alerts')}${chk('nActivity', 'Activity on tasks, projects and members')}</div>
    <div class="card"><h2>Data</h2><p class="muted">Everything is stored in this browser with localStorage. It is not a database: clearing site data deletes it, and it is not shared across devices.</p><button class="btn ghost" data-act="reset"><i data-lucide="rotate-ccw"></i>Restore demo data</button></div></div>`;
}
ACT.reset = () => confirmBox('Restore the original demo data? All your changes will be lost.', () => { DB.reset(); applyTheme(); shell(); toast('Demo data restored'); refresh(); }, 'Restore');

/* ---- Shell, router, events ---- */
const VIEWS = {
  dashboard: { t: 'Overview', d: 'Tasks, projects and team at a glance', i: 'layout-dashboard', r: renderDashboard },
  tasks: { t: 'Tasks', d: 'Create, assign and track work', i: 'list-checks', r: renderTasks },
  projects: { t: 'Projects', d: 'Progress, owners and deadlines', i: 'folder-kanban', r: renderProjects },
  team: { t: 'Team members', d: 'Who is working on what', i: 'users', r: renderTeam },
  reports: { t: 'Reports & analytics', d: 'Completion, workload and performance', i: 'bar-chart-3', r: renderReports },
  notifications: { t: 'Notifications', d: 'Deadlines and recent activity', i: 'bell', r: renderNotifications },
  settings: { t: 'Settings', d: 'Profile, theme and preferences', i: 'settings', r: renderSettings }
};
function applyTheme() {
  const t = S().theme; document.documentElement.dataset.theme = t === 'system' ? (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light') : t;
  document.body.classList.toggle('compact', !!S().compact);
}
function shell() {
  const s = S(); $('#sbName').textContent = s.name; $('#sbRole').textContent = s.role; $('#sbAvatar').textContent = $('#userBtn').textContent = initials(s.name); $('#range').value = s.range;
}
function go() {
  const h = location.hash.slice(1); cur = VIEWS[h] ? h : 'dashboard'; const V = VIEWS[cur];
  Object.keys(charts).forEach(k => { charts[k].destroy(); delete charts[k]; });
  $('#pageTitle').textContent = V.t; $('#pageDesc').textContent = V.d; document.title = V.t + ' · Ledgerline';
  V.r();
  const n = notes().filter(x => x.ts > S().readAt).length; $('#bellDot').hidden = !n; const b = $('#navBadge'); if (b) b.textContent = n || '';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.v === cur));
  document.body.classList.remove('open'); icons();
}
ACT.menu = () => document.body.classList.toggle(mobile() ? 'open' : 'collapsed');
ACT.usermenu = () => { const m = $('#userMenu'); m.hidden = !m.hidden; icons(); };
ACT['go-settings'] = () => { $('#userMenu').hidden = true; location.hash = 'settings'; };
ACT['go-notifications'] = () => { location.hash = 'notifications'; };

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!e.target.closest('.menu-wrap')) $('#userMenu').hidden = true;
  if (b) { const f = ACT[b.dataset.act]; if (f) f(b.dataset.id); }
  else if (e.target.classList.contains('modal-bg')) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
document.addEventListener('input', e => { const f = e.target.dataset.f; if (f) { const [k, n] = f.split('.'); F[k][n] = e.target.value; DRAW[k](); } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.f) { const [k, n] = t.dataset.f.split('.'); F[k][n] = t.value; DRAW[k](); }
  if (t.id === 'range') { S().range = +t.value; DB.save(); refresh(); }
  if (t.dataset.s) { const v = t.type === 'checkbox' ? t.checked : t.value.trim(); if (t.dataset.s === 'name' && !v) { toast('Name cannot be empty', 'err'); t.value = S().name; return; }
    S()[t.dataset.s] = v; DB.save(); applyTheme(); shell(); toast('Settings saved'); if (['theme', 'nDeadline', 'nActivity'].includes(t.dataset.s)) refresh(); }
});
$('#gsearch').addEventListener('keydown', e => { if (e.key === 'Enter') { F.t.q = e.target.value; e.target.value = ''; if (cur === 'tasks') renderTasks(); else location.hash = 'tasks'; } });

DB.load(); applyTheme();
$('#nav').innerHTML = Object.entries(VIEWS).map(([k, v]) => `<a href="#${k}" data-v="${k}"><i data-lucide="${v.i}"></i><span>${v.t.split(' &')[0]}</span>${k === 'notifications' ? '<b class="nbadge" id="navBadge"></b>' : ''}</a>`).join('');
shell(); window.addEventListener('hashchange', go); go();
