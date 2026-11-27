import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, watch: null },
});

try {
  const { resolveLogo, appLogoSrc, applicationLogos } = await server.ssrLoadModule('/src/assets/logos/index.js');
  const applications = JSON.parse(await readFile(new URL('../database/core/applications.json', import.meta.url), 'utf8'));
  const companies = JSON.parse(await readFile(new URL('../database/core/companies.json', import.meta.url), 'utf8'));
  const sequences = JSON.parse(await readFile(new URL('../database/system/id-sequences.json', import.meta.url), 'utf8'));
  const files = await readdir(new URL('../src/assets/logos/applications/', import.meta.url));
  const normalize = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const file of files) {
    const name = file.replace(/^logo-/, '').replace(/\.(png|jpg)$/, '');
    const app = applications.find((entry) => normalize(entry.name) === name);
    assert.ok(app, `No application matches ${file}`);
    const bundled = applicationLogos[`./applications/${file}`];
    assert.ok(bundled, `Vite did not import ${file}`);
    assert.equal(resolveLogo(app.name, app.id), bundled, `Wrong logo for ${app.name}`);
    assert.equal(appLogoSrc({ ...app, logoUrl: '' }), bundled);
    assert.equal(appLogoSrc({ ...app, logoUrl: 'custom-logo' }), 'custom-logo');
  }

  assert.equal(resolveLogo('PixTale'), applicationLogos['./applications/logo-pixtale.jpg']);
  assert.equal(resolveLogo('Mock Market'), applicationLogos['./applications/logo-mockmarket.jpg']);
  assert.equal(resolveLogo('Terra Dashboard'), applicationLogos['./applications/logo-terradashboard.png']);
  assert.equal(resolveLogo('Terra Interface'), undefined);
  const explorer = applications.find((app) => app.id === 'APP-040');
  assert.equal(explorer.name, 'GitHub Repositories Explorer');
  assert.equal(resolveLogo(explorer.name), applicationLogos['./applications/logo-githubrepositoriesexplorer.png']);
  assert.equal(resolveLogo('GitHub Repository Explorer'), resolveLogo(explorer.name));

  const taskify = applications.filter((app) => app.name === 'Taskify');
  assert.equal(taskify.length, 1);
  assert.equal(taskify[0].id, 'APP-043');
  assert.ok(companies.some((company) => company.id === taskify[0].ownerId));
  assert.equal(sequences.APP, 43);
  assert.equal(new Set(applications.map((app) => app.id)).size, applications.length);
  assert.equal(new Set(applications.map((app) => app.code)).size, applications.length);
  console.log(`PASS: ${files.length} application logos, JPG imports, custom logo precedence, Terra, GitHub Explorer and Taskify.`);
} finally {
  await server.close();
}
