/* Tasks: table, filters, sorting, CRUD. */
const PRI = ['Low', 'Medium', 'High', 'Critical'], STAT = ['Pending', 'In Progress', 'Completed'];
const eff = t => t.status !== 'Completed' && t.due < iso(new Date()) ? 'Overdue' : t.status;
const badge = s => `<span class="badge s-${s.replace(' ', '')}">${s}</span>`;
const rowBtns = (k, id, view) => (view ? `<button class="icon-btn" data-act="${k}-view" data-id="${id}" aria-label="View"><i data-lucide="eye"></i></button>` : '') +
  `<button class="icon-btn" data-act="${k}-edit" data-id="${id}" aria-label="Edit"><i data-lucide="pencil"></i></button>` +
  `<button class="icon-btn" data-act="${k}-del" data-id="${id}" aria-label="Delete"><i data-lucide="trash-2"></i></button>`;

function taskTable(list) {
  if (!list.length) return empty('No tasks match', 'Clear the filters or add a new task.');
  return `<div class="tw"><table><thead><tr><th>ID</th><th>Task</th><th>Member</th><th>Project</th><th>Priority</th><th>Status</th><th>Due</th><th><span class="sr">Actions</span></th></tr></thead><tbody>` +
    list.map(t => `<tr><td data-l="ID">#${t.id}</td><td data-l="Task"><strong>${esc(t.name)}</strong></td><td data-l="Member">${esc(memberName(t.member))}</td><td data-l="Project">${esc(projName(t.project))}</td><td data-l="Priority"><span class="pri p-${t.priority}">${t.priority}</span></td><td data-l="Status">${badge(eff(t))}</td><td data-l="Due">${fmt(t.due)}</td><td class="act">${rowBtns('task', t.id)}</td></tr>`).join('') + '</tbody></table></div>';
}

function filteredTasks() {
  const f = F.t, q = f.q.toLowerCase().replace('#', '');
  return DB.data.tasks.filter(t => (!q || t.name.toLowerCase().includes(q) || String(t.id) === q) && (!f.status || eff(t) === f.status) &&
    (!f.priority || t.priority === f.priority) && (!f.project || t.project == f.project) && (!f.member || t.member == f.member))
    .sort((a, b) => f.sort === 'name' ? a.name.localeCompare(b.name) : f.sort === 'priority' ? PRI.indexOf(b.priority) - PRI.indexOf(a.priority) : a.due.localeCompare(b.due));
}

function renderTasks() {
  const D = DB.data, all = l => [['', l]];
  $('#content').innerHTML = `<div class="toolbar">
    <label class="search"><i data-lucide="search"></i><input type="search" data-f="t.q" value="${esc(F.t.q)}" placeholder="Search by name or ID" aria-label="Search tasks"></label>
    ${sel('t', 'status', 'Status', all('All statuses').concat(['Pending', 'In Progress', 'Completed', 'Overdue'].map(x => [x, x])))}
    ${sel('t', 'priority', 'Priority', all('All priorities').concat(PRI.map(x => [x, x])))}
    ${sel('t', 'project', 'Project', all('All projects').concat(D.projects.map(p => [p.id, p.name])))}
    ${sel('t', 'member', 'Member', all('All members').concat(D.team.map(m => [m.id, m.name])))}
    ${sel('t', 'sort', 'Sort by', [['due', 'Sort: due date'], ['priority', 'Sort: priority'], ['name', 'Sort: name']])}
    <button class="btn primary" data-act="task-new"><i data-lucide="plus"></i>New task</button></div>
    <p class="count" id="tcount"></p><div class="card" id="tlist"></div>`;
  drawTasks();
}
function drawTasks() {
  const l = filteredTasks();
  $('#tlist').innerHTML = taskTable(l);
  $('#tcount').textContent = `${l.length} of ${DB.data.tasks.length} tasks`;
  icons();
}
DRAW.t = drawTasks;

function taskForm(id) {
  const D = DB.data, t = id ? DB.get('tasks', id) : { status: 'Pending', priority: 'Medium', start: iso(new Date()) };
  if (!D.team.length || !D.projects.length) return toast('Add a project and a team member before creating tasks', 'err');
  openForm({
    title: id ? 'Edit task' : 'New task', values: t,
    fields: [{ n: 'name', l: 'Task name', r: 1, w: 1 }, { n: 'desc', l: 'Description', t: 'textarea', w: 1 },
      { n: 'member', l: 'Assigned member', t: 'select', o: D.team.map(m => [m.id, m.name]) }, { n: 'project', l: 'Project', t: 'select', o: D.projects.map(p => [p.id, p.name]) },
      { n: 'priority', l: 'Priority', t: 'select', o: PRI.map(x => [x, x]) }, { n: 'status', l: 'Status', t: 'select', o: STAT.map(x => [x, x]) },
      { n: 'start', l: 'Start date', t: 'date', r: 1 }, { n: 'due', l: 'Due date', t: 'date', r: 1 }],
    check: o => o.start && o.due && o.due < o.start ? { due: 'Due date must be on or after the start date' } : {},
    onSave: o => {
      o.member = +o.member; o.project = +o.project;
      o.completedOn = o.status === 'Completed' ? (t.completedOn || iso(new Date())) : null;
      if (id) o.id = +id;
      DB.upsert('tasks', o); log(`Task “${o.name}” ${id ? 'updated' : 'created'}`); toast(`Task ${id ? 'updated' : 'created'}`); refresh();
    }
  });
}
ACT['task-new'] = () => taskForm();
ACT['task-edit'] = id => taskForm(id);
ACT['task-del'] = id => { const t = DB.get('tasks', id); confirmBox(`Delete task “${esc(t.name)}”? This can't be undone.`, () => { DB.remove('tasks', id); log(`Task “${t.name}” deleted`); toast('Task deleted'); refresh(); }); };
