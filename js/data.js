/* Data layer: demo data + localStorage persistence (browser-only, not a real database). */
const KEY = 'enterprise-dashboard-v1';
const iso = d => d.toISOString().slice(0, 10);
const day = n => { const x = new Date(); x.setDate(x.getDate() + n); return iso(x); };
const ACT = {}, DRAW = {};
const F = { t: { q: '', status: '', priority: '', project: '', member: '', sort: 'due' }, p: { q: '', status: '' }, m: { q: '', role: '' } };

function demo() {
  const team = [['Amira Hassan', 'Product Manager'], ['Omar Farouk', 'Frontend Engineer'], ['Lina Mostafa', 'UX Designer'],
    ['Youssef Adel', 'Backend Engineer'], ['Nour Saleh', 'QA Analyst'], ['Karim Nabil', 'Data Analyst']]
    .map((m, i) => ({ id: i + 1, name: m[0], role: m[1], email: m[0].split(' ')[0].toLowerCase() + '@ledgerline.example' }));
  const projects = [
    ['Website Redesign', 'Refresh the customer portal and marketing site.', 1, -40, 25, 'Active'],
    ['Mobile App v2', 'Offline mode and push notifications.', 4, -25, 45, 'Active'],
    ['Data Warehouse', 'Consolidate reporting data into one warehouse.', 6, -60, 10, 'Active'],
    ['Security Audit', 'Annual review of access and logging.', 5, -90, -10, 'Completed'],
    ['Partner Onboarding', 'Self-service onboarding for new partners.', 1, -5, 70, 'On Hold']
  ].map((p, i) => ({ id: i + 1, name: p[0], desc: p[1], manager: p[2], start: day(p[3]), due: day(p[4]), status: p[5] }));
  const tasks = [
    ['Design new landing page', 3, 1, 'High', 'In Progress', -10, 5], ['Migrate blog to new CMS', 2, 1, 'Medium', 'Pending', -2, 14],
    ['Audit accessibility issues', 5, 1, 'High', 'Completed', -30, -12], ['Build offline sync', 4, 2, 'Critical', 'In Progress', -14, 6],
    ['Push notification service', 4, 2, 'High', 'Pending', -3, 20], ['Write onboarding screens', 3, 2, 'Medium', 'Completed', -20, -6],
    ['Fix login crash on Android', 2, 2, 'Critical', 'Pending', -9, -2], ['Define warehouse schema', 6, 3, 'High', 'Completed', -50, -25],
    ['Load historical sales data', 6, 3, 'Medium', 'In Progress', -12, 3], ['Set up nightly ETL jobs', 4, 3, 'High', 'Pending', -1, 9],
    ['Review access logs', 5, 4, 'Medium', 'Completed', -80, -30], ['Patch outdated dependencies', 2, 4, 'High', 'Completed', -70, -20],
    ['Partner signup form', 2, 5, 'Low', 'Pending', -4, 30], ['Draft partner guide', 1, 5, 'Low', 'In Progress', -6, 2],
    ['Quarterly KPI report', 6, 3, 'Medium', 'Completed', -15, -1], ['Usability test round 2', 3, 1, 'Medium', 'Completed', -18, -8]
  ].map((t, i) => ({ id: i + 1, name: t[0], desc: 'Scope and acceptance criteria are tracked in the project plan.', member: t[1], project: t[2],
    priority: t[3], status: t[4], start: day(t[5]), due: day(t[6]), completedOn: t[4] === 'Completed' ? day(t[6] - 1) : null }));
  return { team, projects, tasks, log: [{ text: 'Demo data loaded', ts: Date.now() }],
    settings: { name: 'Alex Morgan', role: 'Operations Lead', theme: 'light', nDeadline: true, nActivity: true, compact: false, charts: true, range: 0, readAt: 0 } };
}

const DB = {
  data: null,
  load() { try { this.data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { this.data = null; } if (!this.data || !this.data.tasks) this.reset(); },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { console.warn('localStorage unavailable'); } },
  reset() { this.data = demo(); this.save(); },
  get(c, id) { return this.data[c].find(x => x.id == id); },
  upsert(c, o) {
    if (o.id) Object.assign(this.get(c, o.id), o);
    else { o.id = Math.max(0, ...this.data[c].map(x => x.id)) + 1; this.data[c].push(o); }
    this.save(); return o;
  },
  remove(c, id) { this.data[c] = this.data[c].filter(x => x.id != id); this.save(); }
};
