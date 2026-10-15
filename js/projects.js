/* Projects: cards, filters, CRUD. Progress is calculated from each project's tasks. */
const PST = ['Active', 'On Hold', 'Completed'];
const projTasks = id => DB.data.tasks.filter(t => t.project == id);
const projPct = id => { const T = projTasks(id); return pct(T.filter(t => t.status === 'Completed').length, T.length); };
const bar = p => `<div class="bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`;

function renderProjects() {
  $('#content').innerHTML = `<div class="toolbar">
    <label class="search"><i data-lucide="search"></i><input type="search" data-f="p.q" value="${esc(F.p.q)}" placeholder="Search projects" aria-label="Search projects"></label>
    ${sel('p', 'status', 'Status', [['', 'All statuses']].concat(PST.map(x => [x, x])))}
    <button class="btn primary" data-act="proj-new"><i data-lucide="plus"></i>New project</button></div><div id="plist"></div>`;
  drawProjects();
}
function drawProjects() {
  const q = F.p.q.toLowerCase(), l = DB.data.projects.filter(p => (!q || (p.name + p.desc).toLowerCase().includes(q)) && (!F.p.status || p.status === F.p.status)).sort((a, b) => a.due.localeCompare(b.due));
  $('#plist').innerHTML = l.length ? `<div class="cards">${l.map(p => { const pc = projPct(p.id);
    return `<article class="card proj"><div class="ch"><h2>${esc(p.name)}</h2><span class="badge ps-${p.status.replace(' ', '')}">${p.status}</span></div>
    <p class="muted">${esc(p.desc)}</p>${bar(pc)}<div class="meta"><span>${pc}% complete</span><span>${projTasks(p.id).length} tasks</span></div>
    <div class="meta"><span>Manager: ${esc(memberName(p.manager))}</span><span>${fmt(p.start)} – ${fmt(p.due)}</span></div>
    <div class="act">${rowBtns('proj', p.id, 1)}</div></article>`; }).join('')}</div>` : `<div class="card">${empty('No projects found', 'Clear the filters or add a project.')}</div>`;
  icons();
}
DRAW.p = drawProjects;

function projForm(id) {
  const D = DB.data, p = id ? DB.get('projects', id) : { status: 'Active', start: iso(new Date()) };
  if (!D.team.length) return toast('Add a team member to manage the project first', 'err');
  openForm({
    title: id ? 'Edit project' : 'New project', values: p,
    fields: [{ n: 'name', l: 'Project name', r: 1, w: 1 }, { n: 'desc', l: 'Description', t: 'textarea', w: 1 },
      { n: 'manager', l: 'Project manager', t: 'select', o: D.team.map(m => [m.id, m.name]) }, { n: 'status', l: 'Status', t: 'select', o: PST.map(x => [x, x]) },
      { n: 'start', l: 'Start date', t: 'date', r: 1 }, { n: 'due', l: 'Due date', t: 'date', r: 1 }],
    check: o => o.start && o.due && o.due < o.start ? { due: 'Due date must be on or after the start date' } : {},
    onSave: o => { o.manager = +o.manager; if (id) o.id = +id; DB.upsert('projects', o); log(`Project “${o.name}” ${id ? 'updated' : 'created'}`); toast(`Project ${id ? 'updated' : 'created'}`); refresh(); }
  });
}
ACT['proj-new'] = () => projForm();
ACT['proj-edit'] = id => projForm(id);
ACT['proj-view'] = id => {
  const p = DB.get('projects', id);
  openModal(esc(p.name), `<p class="muted">${esc(p.desc)}</p>${bar(projPct(id))}<p class="meta"><span>${projPct(id)}% complete</span><span>Manager: ${esc(memberName(p.manager))}</span></p>
    <h3>Tasks</h3>${projTasks(id).length ? `<ul class="plain">${projTasks(id).map(t => `<li>${esc(t.name)} ${badge(eff(t))}</li>`).join('')}</ul>` : '<p class="muted">No tasks yet.</p>'}`);
};
ACT['proj-del'] = id => {
  const p = DB.get('projects', id), n = projTasks(id).length;
  confirmBox(`Delete project “${esc(p.name)}”${n ? ` and its ${n} task${n > 1 ? 's' : ''}` : ''}? This can't be undone.`, () => {
    DB.data.tasks = DB.data.tasks.filter(t => t.project != id); DB.remove('projects', id); log(`Project “${p.name}” deleted`); toast('Project deleted'); refresh();
  });
};
