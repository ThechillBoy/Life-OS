import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const AxeBuilder = require(process.env.AXE_MODULE || '@axe-core/playwright').default;
const browser = await playwright.chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
// Axe injects its own analyzer. App CSP is verified separately by the browser suite.
const context = await browser.newContext({ bypassCSP: true });
const page = await context.newPage();
const origin = process.env.BASE_URL || 'http://127.0.0.1:4173';
const failures = [];
let count = 0;
const routes = { dashboard: 'Overview', tasks: 'Tasks', habits: 'Habits', notes: 'Notes', expenses: 'Expenses', focus: 'Focus', settings: 'Settings' };
async function audit(label) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  count++;
  if (result.violations.length) failures.push({ label, violations: result.violations.map(v => ({ id: v.id, help: v.help, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
  console.log(`${result.violations.length ? 'FAIL' : 'PASS'} ${label}`);
}
try {
  await page.goto(origin); await page.locator('main[aria-busy="false"]').waitFor();
  await page.evaluate(async () => {
    const { repository, setHabitCheckin } = await import('/js/core/storage.js');
    const { record } = await import('/js/core/models.js');
    const { localDate } = await import('/js/core/dates.js');
    const day = localDate();
    await repository.save('tasks', record({ title: 'An intentional next step', dueDate: day, completed: false }));
    const habit = record({ title: 'Read a few pages' }); await repository.save('habits', habit); await setHabitCheckin(habit.id, day, true);
    await repository.save('notes', record({ title: 'A little room to think', body: 'Some ideas for a calmer week.' }));
    await repository.save('expenses', record({ amount: 1234, currency: 'USD', category: 'Food & drink', description: 'Lunch', date: day }));
  });
  for (const theme of ['light', 'dark']) {
    await page.evaluate(async theme => { await (await import('/js/core/storage.js')).savePreferences({ theme }); }, theme);
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [route, label] of Object.entries(routes)) {
        await page.goto(`${origin}/#${route}`);
        await page.waitForFunction(label => document.getElementById('current-section').textContent === label && document.getElementById('main').getAttribute('aria-busy') === 'false', label);
        await audit(`${theme} / ${width}px / ${route}`);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [route, label] of [['tasks', 'New task'], ['habits', 'New habit'], ['expenses', 'Add expense']]) {
    await page.goto(`${origin}/#${route}`); await page.locator('main[aria-busy="false"]').waitFor();
    await page.getByRole('button', { name: label, exact: true }).click(); await audit(`${route} form dialog`);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await page.setViewportSize({ width: 320, height: 850 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await audit('mobile navigation dialog');
  await page.keyboard.press('Escape');
  if (failures.length) console.log(JSON.stringify(failures, null, 2));
  assert.deepEqual(failures, []);
  console.log(`\n${count} WCAG A/AA automated accessibility audits passed.`);
} finally { await browser.close(); }
