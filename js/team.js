/* Team members: cards, filters, CRUD. */
const hue = id => (id * 67) % 360;
const memTasks = id => DB.data.tasks.filter(t => t.member == id);
const memProjects = id => DB.data.projects.filter(p => p.manager == id || memTasks(id).some(t => t.project == p.id));

function renderTeam() {
  const roles = [...new Set(DB.data.team.map(m => m.role))].sort();
  $('#content').innerHTML = `<div class="toolbar">
    <label class="search"><i data-lucide="search"></i><input type="search" data-f="m.q" value="${esc(F.m.q)}" placeholder="Search by name or email" aria-label="Search team"></label>
    ${sel('m', 'role', 'Role', [['', 'All roles']].concat(roles.map(r => [r, r])))}
    <button class="btn primary" data-act="mem-new"><i data-lucide="plus"></i>Add member</button></div><div id="mlist"></div>`;
  drawTeam();
}
function drawTeam() {
  const q = F.m.q.toLowerCase(), l = DB.data.team.filter(m => (!q || (m.name + m.email).toLowerCase().includes(q)) && (!F.m.role || m.role === F.m.role));
  $('#mlist').innerHTML = l.length ? `<div class="cards">${l.map(m => { const T = memTasks(m.id), d = T.filter(t => t.status === 'Completed').length;
    return `<article class="card member"><div class="mh2"><div class="avatar lg" style="background:hsl(${hue(m.id)} 45% 36%)">${initials(m.name)}</div><div><h2>${esc(m.name)}</h2><p class="muted">${esc(m.role)}</p></div></div>
    <p class="muted"><i data-lucide="mail"></i>${esc(m.email)}</p><p class="muted"><i data-lucide="folder-kanban"></i>${memProjects(m.id).map(p => esc(p.name)).join(', ') || 'No projects'}</p>
    ${bar(pct(d, T.length))}<div class="meta"><span>${T.length} tasks</span><span>${d} completed (${pct(d, T.length)}%)</span></div>
    <div class="act">${rowBtns('mem', m.id)}</div></article>`; }).join('')}</div>` : `<div class="card">${empty('No team members found', 'Clear the filters or add a member.')}</div>`;
  icons();
}
DRAW.m = drawTeam;

function memForm(id) {
  const m = id ? DB.get('team', id) : {};
  openForm({
    title: id ? 'Edit member' : 'Add member', values: m,
    fields: [{ n: 'name', l: 'Full name', r: 1, w: 1 }, { n: 'role', l: 'Job title', r: 1 }, { n: 'email', l: 'Email', t: 'email', r: 1 }],
    check: o => DB.data.team.some(x => x.email.toLowerCase() === o.email.toLowerCase() && x.id != id) ? { email: 'This email is already used by another member' } : {},
    onSave: o => { if (id) o.id = +id; DB.upsert('team', o); log(`Team member ${o.name} ${id ? 'updated' : 'added'}`); toast(`Member ${id ? 'updated' : 'added'}`); refresh(); }
  });
}
ACT['mem-new'] = () => memForm();
ACT['mem-edit'] = id => memForm(id);
ACT['mem-del'] = id => {
  const m = DB.get('team', id), n = memTasks(id).length;
  confirmBox(`Remove ${esc(m.name)}?${n ? ` Their ${n} task${n > 1 ? 's' : ''} will become unassigned.` : ''}`, () => { DB.remove('team', id); log(`Team member ${m.name} removed`); toast('Member removed'); refresh(); }, 'Remove');
};
