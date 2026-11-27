/**
 * Logo asset exports and dynamic resolver for Brickhouse.
 */
import brickhouseMark from './brickhouse-mark.png';
import brickhouseFull from './brickhouse-logo-full.png';

export const brandLogos = {
  mark: brickhouseMark,
  full: brickhouseFull,
};

// Vite eager glob imports for structured logo collections
export const applicationLogos = import.meta.glob('./applications/*.{png,jpg}', { eager: true, import: 'default' });
export const platformLogos = import.meta.glob('./platforms/*.png', { eager: true, import: 'default' });
export const technologyLogos = import.meta.glob('./technologies/*.png', { eager: true, import: 'default' });

const norm = (s) => String(s || '').toLowerCase().replace(/\.js\b/g, 'js').replace(/[^a-z0-9]/g, '');

const applicationLogosByName = Object.fromEntries(
  Object.entries(applicationLogos).map(([path, url]) => [
    norm(path.replace(/^.*\/logo-/, '').replace(/\.(png|jpg)$/, '')),
    url,
  ]),
);

const ALIASES = {
  // Applications
  ...applicationLogosByName,
  vsportfolio: applicationLogosByName.vincentportfolio,
  webresume: applicationLogosByName.vincentwebresume,
  wirewagon: applicationLogos['./applications/logo-wirenwagon.png'],
  githubrepositoryexplorer: applicationLogosByName.githubrepositoriesexplorer,

  // Platforms / Providers
  github: platformLogos['./platforms/logo-github.png'],
  gitlab: platformLogos['./platforms/logo-gitlab.png'],
  bitbucket: platformLogos['./platforms/logo-bitbucket.png'],
  git: platformLogos['./platforms/logo-git.png'],
  render: platformLogos['./platforms/logo-render.png'],
  vercel: platformLogos['./platforms/logo-vercel.png'],

  // Technologies
  react: technologyLogos['./technologies/logo-react.png'],
  javascript: technologyLogos['./technologies/logo-javascript.png'],
  js: technologyLogos['./technologies/logo-javascript.png'],
  typescript: technologyLogos['./technologies/logo-typescript.png'],
  ts: technologyLogos['./technologies/logo-typescript.png'],
  nodejs: technologyLogos['./technologies/logo-nodejs.png'],
  node: technologyLogos['./technologies/logo-nodejs.png'],
  express: technologyLogos['./technologies/logo-express.png'],
  python: technologyLogos['./technologies/logo-python.png'],
  flutter: technologyLogos['./technologies/logo-flutter.png'],
  nextjs: technologyLogos['./technologies/logo-nextjs.png'],
  postgresql: technologyLogos['./technologies/logo-postgres.png'],
  postgres: technologyLogos['./technologies/logo-postgres.png'],
  prisma: technologyLogos['./technologies/logo-prisma.png'],
  bootstrap: technologyLogos['./technologies/logo-bootstrap.png'],
  tailwindcss: technologyLogos['./technologies/logo-tailwind.png'],
  tailwind: technologyLogos['./technologies/logo-tailwind.png'],
  axios: technologyLogos['./technologies/logo-axios.png'],
  css3: technologyLogos['./technologies/logo-css3.png'],
  css: technologyLogos['./technologies/logo-css3.png'],
  html5: technologyLogos['./technologies/logo-html5.png'],
  html: technologyLogos['./technologies/logo-html5.png'],
  mongodb: technologyLogos['./technologies/logo-mongodb.png'],
  mongo: technologyLogos['./technologies/logo-mongodb.png'],
  sequelize: technologyLogos['./technologies/logo-sequelize.png'],
  shadcn: technologyLogos['./technologies/logo-shadcn.png'],
  shadcnui: technologyLogos['./technologies/logo-shadcn.png'],
  figma: technologyLogos['./technologies/logo-figma.png'],
  firebase: technologyLogos['./technologies/logo-firebase.png'],
  json: technologyLogos['./technologies/logo-json.png'],
  database: technologyLogos['./technologies/logo-database.png'],
};

/**
 * Resolves a logo URL by name or ID. Returns undefined if none matches.
 */
export function resolveLogo(name, hint) {
  if (!name && !hint) return undefined;
  const k1 = norm(name);
  if (ALIASES[k1]) return ALIASES[k1];
  const k2 = norm(hint);
  if (ALIASES[k2]) return ALIASES[k2];
  return undefined;
}

/** Resolve logo URL for an application (custom logoUrl takes priority over bundled asset). */
export function appLogoSrc(app) {
  if (!app) return undefined;
  return app.logoUrl || resolveLogo(app.name, app.id);
}
