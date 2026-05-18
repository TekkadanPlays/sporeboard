// ---------------------------------------------------------------------------
// Seed demo data into a fresh Kanboard instance
// Run: bun run seed-demo.ts
// ---------------------------------------------------------------------------

const URL = 'http://localhost:8080/jsonrpc.php';
const AUTH = 'Basic ' + btoa('admin:admin');

let reqId = 1;

async function rpc(method: string, params?: Record<string, any>) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': AUTH },
    body: JSON.stringify({ jsonrpc: '2.0', method, id: reqId++, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`${method}: ${data.error.message}`);
  return data.result;
}

async function main() {
  console.log('🌱 Seeding Kanboard demo data...\n');

  // --- Project 1: Product Development ---
  const p1 = await rpc('createProject', {
    name: 'Product Development',
    description: 'Main product roadmap and feature development',
    identifier: 'PROD',
  });
  console.log(`✓ Project "Product Development" → id=${p1}`);

  // Categories
  const catFeature = await rpc('createCategory', { project_id: p1, name: 'Feature' });
  const catBug     = await rpc('createCategory', { project_id: p1, name: 'Bug' });
  const catChore   = await rpc('createCategory', { project_id: p1, name: 'Chore' });
  const catDesign  = await rpc('createCategory', { project_id: p1, name: 'Design' });
  console.log(`  ✓ Categories: Feature, Bug, Chore, Design`);

  // Get columns (Kanboard creates 4 default columns)
  const cols = await rpc('getColumns', { project_id: p1 });
  const colMap: Record<string, number> = {};
  for (const c of cols) colMap[c.title] = c.id;
  console.log(`  ✓ Columns: ${cols.map((c: any) => c.title).join(', ')}`);

  // Get default swimlane
  const swimlanes = await rpc('getActiveSwimlanes', { project_id: p1 });
  const defaultSwimlane = swimlanes[0]?.id || 0;

  // --- Tasks in Backlog ---
  const t1 = await rpc('createTask', {
    title: 'Design new onboarding flow',
    project_id: p1, column_id: colMap['Backlog'], color_id: 'purple',
    category_id: catDesign, description: 'Create wireframes and high-fidelity mockups for the new user onboarding experience. Should include:\n- Welcome screen\n- Feature highlights\n- Permission requests\n- Profile setup',
    priority: 1, swimlane_id: defaultSwimlane,
  });

  await rpc('createTask', {
    title: 'Audit third-party dependencies',
    project_id: p1, column_id: colMap['Backlog'], color_id: 'grey',
    category_id: catChore, description: 'Review all npm packages for security vulnerabilities and license compliance.',
    priority: 0, swimlane_id: defaultSwimlane,
  });

  await rpc('createTask', {
    title: 'Add dark mode support to email templates',
    project_id: p1, column_id: colMap['Backlog'], color_id: 'blue',
    category_id: catFeature, priority: 0, swimlane_id: defaultSwimlane,
  });

  // --- Tasks in Ready ---
  const t4 = await rpc('createTask', {
    title: 'Implement WebSocket reconnection logic',
    project_id: p1, column_id: colMap['Ready'], color_id: 'orange',
    category_id: catFeature, description: 'Handle automatic reconnection with exponential backoff when the WebSocket connection drops.',
    priority: 2, swimlane_id: defaultSwimlane,
  });

  await rpc('createTask', {
    title: 'Fix pagination offset bug on search results',
    project_id: p1, column_id: colMap['Ready'], color_id: 'red',
    category_id: catBug, description: 'Search results page 2+ shows duplicate items due to incorrect offset calculation.',
    priority: 2, date_due: new Date(Date.now() - 86400000).toISOString().split('T')[0], // yesterday = overdue!
    swimlane_id: defaultSwimlane,
  });

  // --- Tasks in Work in progress ---
  const t6 = await rpc('createTask', {
    title: 'Build real-time notification system',
    project_id: p1, column_id: colMap['Work in progress'], color_id: 'green',
    category_id: catFeature, description: 'Server-sent events for live notifications. Includes toast UI, badge counts, and persistence.',
    priority: 1, date_due: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    swimlane_id: defaultSwimlane,
  });

  const t7 = await rpc('createTask', {
    title: 'Migrate database to PostgreSQL',
    project_id: p1, column_id: colMap['Work in progress'], color_id: 'teal',
    category_id: catChore, description: 'Moving from SQLite to PostgreSQL for production. Need to handle schema migration and data export.',
    priority: 1, swimlane_id: defaultSwimlane,
  });

  await rpc('createTask', {
    title: 'Profile page performance regression',
    project_id: p1, column_id: colMap['Work in progress'], color_id: 'deep_orange',
    category_id: catBug, description: 'Profile page takes 4+ seconds to load after the avatar refactor. Likely N+1 query issue.',
    priority: 3, date_due: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    swimlane_id: defaultSwimlane,
  });

  // --- Tasks in Done ---
  const t9 = await rpc('createTask', {
    title: 'Set up CI/CD pipeline',
    project_id: p1, column_id: colMap['Done'], color_id: 'lime',
    category_id: catChore, swimlane_id: defaultSwimlane,
  });
  await rpc('closeTask', { task_id: t9 });

  const t10 = await rpc('createTask', {
    title: 'Implement user avatar upload',
    project_id: p1, column_id: colMap['Done'], color_id: 'cyan',
    category_id: catFeature, swimlane_id: defaultSwimlane,
  });
  await rpc('closeTask', { task_id: t10 });

  console.log(`  ✓ 10 tasks created across 4 columns`);

  // --- Subtasks for "Build real-time notification system" ---
  await rpc('createSubtask', { task_id: t6, title: 'Design SSE event schema' });
  await rpc('createSubtask', { task_id: t6, title: 'Implement server-side event emitter' });
  await rpc('createSubtask', { task_id: t6, title: 'Build toast notification component' });
  await rpc('createSubtask', { task_id: t6, title: 'Add notification badge to navbar' });
  await rpc('createSubtask', { task_id: t6, title: 'Persist read/unread state' });
  // Mark first two as done
  const subs = await rpc('getAllSubtasks', { task_id: t6 });
  await rpc('updateSubtask', { id: subs[0].id, task_id: t6, status: 2 });
  await rpc('updateSubtask', { id: subs[1].id, task_id: t6, status: 2 });
  console.log(`  ✓ 5 subtasks on "Build real-time notification system" (2 completed)`);

  // --- Subtasks for "Design new onboarding flow" ---
  await rpc('createSubtask', { task_id: t1, title: 'User research & competitor analysis' });
  await rpc('createSubtask', { task_id: t1, title: 'Low-fidelity wireframes' });
  await rpc('createSubtask', { task_id: t1, title: 'High-fidelity mockups in Figma' });
  await rpc('createSubtask', { task_id: t1, title: 'Prototype interactive flow' });
  console.log(`  ✓ 4 subtasks on "Design new onboarding flow"`);

  // --- Comments ---
  await rpc('createComment', { task_id: t6, user_id: 1, content: 'Started working on the SSE schema. Using a simple JSON envelope with `type`, `payload`, and `timestamp` fields.' });
  await rpc('createComment', { task_id: t6, user_id: 1, content: 'Toast component is done — supports success, error, warning, and info variants with auto-dismiss.' });
  await rpc('createComment', { task_id: t7, user_id: 1, content: 'Migration script is ready. Need to test with production data dump before proceeding.' });
  await rpc('createComment', { task_id: t4, user_id: 1, content: 'Should we use exponential backoff with jitter? That would prevent thundering herd on server restarts.' });
  console.log(`  ✓ 4 comments across tasks`);

  // --- Project 2: Marketing Website ---
  const p2 = await rpc('createProject', {
    name: 'Marketing Website',
    description: 'Company website redesign and content updates',
    identifier: 'MKTG',
  });
  console.log(`\n✓ Project "Marketing Website" → id=${p2}`);

  const cols2 = await rpc('getColumns', { project_id: p2 });
  const colMap2: Record<string, number> = {};
  for (const c of cols2) colMap2[c.title] = c.id;
  const sl2 = await rpc('getActiveSwimlanes', { project_id: p2 });

  await rpc('createTask', { title: 'Redesign landing page hero section', project_id: p2, column_id: colMap2['Ready'], color_id: 'purple', swimlane_id: sl2[0]?.id || 0 });
  await rpc('createTask', { title: 'Write case study: Acme Corp', project_id: p2, column_id: colMap2['Work in progress'], color_id: 'blue', swimlane_id: sl2[0]?.id || 0 });
  await rpc('createTask', { title: 'Update pricing page with new tiers', project_id: p2, column_id: colMap2['Backlog'], color_id: 'amber', swimlane_id: sl2[0]?.id || 0 });
  await rpc('createTask', { title: 'SEO audit and meta tag cleanup', project_id: p2, column_id: colMap2['Backlog'], color_id: 'green', swimlane_id: sl2[0]?.id || 0 });
  console.log(`  ✓ 4 tasks created`);

  // --- Project 3: Internal Tools ---
  const p3 = await rpc('createProject', {
    name: 'Internal Tools',
    description: 'Developer tooling, scripts, and infrastructure',
    identifier: 'TOOL',
  });
  console.log(`\n✓ Project "Internal Tools" → id=${p3}`);

  const cols3 = await rpc('getColumns', { project_id: p3 });
  const colMap3: Record<string, number> = {};
  for (const c of cols3) colMap3[c.title] = c.id;
  const sl3 = await rpc('getActiveSwimlanes', { project_id: p3 });

  await rpc('createTask', { title: 'Build log analyzer dashboard', project_id: p3, column_id: colMap3['Work in progress'], color_id: 'orange', swimlane_id: sl3[0]?.id || 0 });
  await rpc('createTask', { title: 'Automate staging deployments', project_id: p3, column_id: colMap3['Ready'], color_id: 'teal', swimlane_id: sl3[0]?.id || 0 });
  await rpc('createTask', { title: 'Create shared ESLint config', project_id: p3, column_id: colMap3['Done'], color_id: 'lime', swimlane_id: sl3[0]?.id || 0 });
  console.log(`  ✓ 3 tasks created`);

  console.log('\n🎉 Demo data seeded! You can now log in with:');
  console.log('   URL:      http://localhost:8080/jsonrpc.php');
  console.log('   Username: admin');
  console.log('   Token:    admin');
}

main().catch(console.error);
