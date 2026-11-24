// BRICKHOUSE registry schema: entity collections, relationship (junction) collections,
// foreign keys and canonical values. This is the single description of the data model
// used by storage, validation, CRUD and the Data Management page.

export const APP_VERSION = '1.0.0';
export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'brickhouse.registry';

/**
 * ID policy. New records take the LOWEST free number for their prefix, so deleting a record
 * frees its ID again and numbering never skips (delete APP-041 → the next application is APP-041).
 * Prefixes listed here are never reused instead:
 *  - API: the workbook rule "API-01 … API-12 are locked; never change, reorder or reuse".
 *  - ACT: the Activity Log is append-only.
 */
export const LOCKED_ID_PREFIXES = ['API', 'ACT'];

export const LIFECYCLES = ['planning', 'development', 'testing', 'active', 'maintenance', 'archived'];
export const TECHNOLOGY_STATUSES = ['active', 'evaluating', 'deprecated'];
export const INFRASTRUCTURE_STATUSES = ['active', 'inactive', 'deprecated'];
export const DEPLOYMENT_STATUSES = ['active', 'failed', 'inactive'];
export const VISIBILITIES = ['private', 'public', 'internal', 'unknown'];
export const ACCESS_STATUSES = ['accessible', 'inaccessible', 'unknown'];

/** Entity collections (one JSON file each). */
export const ENTITIES = {
  companies: {
    label: 'Company', plural: 'Companies', prefix: 'COMP', group: 'core', file: 'core/companies.json',
    required: ['name', 'code'],
  },
  applications: {
    label: 'Application', plural: 'Applications', prefix: 'APP', group: 'core', file: 'core/applications.json',
    route: '/applications', required: ['name', 'code', 'ownerId', 'category', 'type', 'lifecycle'], unique: ['code'],
    lifecycleField: 'lifecycle',
  },
  repositories: {
    label: 'Repository', plural: 'Repositories', prefix: 'REPO', group: 'core', file: 'core/repositories.json',
    route: '/repositories', required: ['name', 'provider', 'type', 'visibility'], unique: ['name'],
  },
  components: {
    label: 'Component', plural: 'Components', prefix: 'CMP', group: 'core', file: 'core/components.json',
    route: '/components', required: ['name', 'applicationId', 'type', 'layer', 'lifecycle'], lifecycleField: 'lifecycle',
  },
  apis: {
    label: 'API / Service', plural: 'APIs & Services', prefix: 'API', group: 'core', file: 'core/apis.json',
    route: '/apis', required: ['name', 'serviceType', 'protocol', 'authentication', 'lifecycle'], lifecycleField: 'lifecycle',
  },
  endpoints: {
    label: 'Endpoint', plural: 'Endpoints', prefix: 'END', group: 'core', file: 'core/endpoints.json',
    required: ['apiId', 'name', 'method', 'path'],
  },
  deployments: {
    label: 'Deployment', plural: 'Deployments', prefix: 'DEP', group: 'core', file: 'core/deployments.json',
    route: '/deployments', required: ['name', 'componentId', 'environment', 'status'],
  },
  reviews: {
    label: 'Review Snapshot', plural: 'Review Snapshots', prefix: 'REV', group: 'core', file: 'core/reviews.json',
    required: ['repositoryId'],
  },
  commits: {
    label: 'Commit', plural: 'Commits', prefix: 'GC', group: 'core', file: 'core/git-commits.json',
    required: ['repositoryId', 'sha', 'committedAt'],
  },
  technologies: {
    label: 'Technology', plural: 'Technologies', prefix: 'TECH', group: 'catalog', file: 'catalog/technologies.json',
    route: '/technologies', required: ['name', 'category', 'status'], unique: ['name'],
  },
  infrastructure: {
    label: 'Infrastructure', plural: 'Infrastructure', prefix: 'INF', group: 'catalog', file: 'catalog/infrastructure.json',
    route: '/infrastructure', required: ['name', 'provider', 'category', 'status'],
  },
  activities: {
    label: 'Activity', plural: 'Activities', prefix: 'ACT', group: 'system', file: 'system/activities.json',
    required: ['timestamp', 'action', 'resourceType'],
  },
};

/** Relationship (junction) collections. `from` / `to` describe the two linked entities. */
export const RELATIONS = {
  applicationRepositories: {
    label: 'Application → Repository', prefix: 'AR', file: 'relationships/application-repositories.json',
    from: { field: 'applicationId', entity: 'applications' }, to: { field: 'repositoryId', entity: 'repositories' },
  },
  applicationComponents: {
    label: 'Application uses shared Component', prefix: 'ACU', file: 'relationships/application-components.json',
    from: { field: 'applicationId', entity: 'applications' }, to: { field: 'componentId', entity: 'components' },
  },
  componentRepositories: {
    label: 'Component → Repository', prefix: 'CR', file: 'relationships/component-repositories.json',
    from: { field: 'componentId', entity: 'components' }, to: { field: 'repositoryId', entity: 'repositories' },
  },
  componentTechnologies: {
    label: 'Component → Technology', prefix: 'CT', file: 'relationships/component-technologies.json',
    from: { field: 'componentId', entity: 'components' }, to: { field: 'technologyId', entity: 'technologies' },
  },
  componentInfrastructure: {
    label: 'Component → Infrastructure', prefix: 'CI', file: 'relationships/component-infrastructure.json',
    from: { field: 'componentId', entity: 'components' }, to: { field: 'infrastructureId', entity: 'infrastructure' },
  },
  componentServices: {
    label: 'Component → Component (dependency)', prefix: 'CS', file: 'relationships/component-services.json',
    from: { field: 'sourceComponentId', entity: 'components' }, to: { field: 'targetComponentId', entity: 'components' },
  },
  applicationApis: {
    label: 'Application provides API', prefix: 'AA', file: 'relationships/application-apis.json',
    from: { field: 'applicationId', entity: 'applications' }, to: { field: 'apiId', entity: 'apis' },
  },
  apiConsumers: {
    label: 'API consumed by Application', prefix: 'AC', file: 'relationships/api-consumers.json',
    from: { field: 'apiId', entity: 'apis' }, to: { field: 'applicationId', entity: 'applications' },
  },
  componentDeployments: {
    label: 'Component included in Deployment', prefix: 'CD', file: 'relationships/component-deployments.json',
    from: { field: 'componentId', entity: 'components' }, to: { field: 'deploymentId', entity: 'deployments' },
  },
  // ---- documented extensions (see database/README.md) ----
  componentApis: {
    label: 'Component provides / consumes API', prefix: 'CA', file: 'relationships/component-apis.json', extension: true,
    from: { field: 'componentId', entity: 'components' }, to: { field: 'apiId', entity: 'apis' },
  },
  apiInfrastructure: {
    label: 'API → Infrastructure', prefix: 'PI', file: 'relationships/api-infrastructure.json', extension: true,
    from: { field: 'apiId', entity: 'apis' }, to: { field: 'infrastructureId', entity: 'infrastructure' },
  },
  applicationTechnologies: {
    label: 'Application → Technology', prefix: 'AT', file: 'relationships/application-technologies.json', extension: true,
    from: { field: 'applicationId', entity: 'applications' }, to: { field: 'technologyId', entity: 'technologies' },
  },
  applicationInfrastructure: {
    label: 'Application → Infrastructure', prefix: 'AI', file: 'relationships/application-infrastructure.json', extension: true,
    from: { field: 'applicationId', entity: 'applications' }, to: { field: 'infrastructureId', entity: 'infrastructure' },
  },
};

/** Direct foreign keys stored on entity records. Required keys block deletion of the target. */
export const FOREIGN_KEYS = [
  { entity: 'applications', field: 'ownerId', target: 'companies', required: true },
  { entity: 'components', field: 'applicationId', target: 'applications', required: true },
  { entity: 'endpoints', field: 'apiId', target: 'apis', required: true },
  { entity: 'deployments', field: 'componentId', target: 'components', required: true },
  { entity: 'deployments', field: 'repositoryId', target: 'repositories', required: false },
  { entity: 'deployments', field: 'infrastructureId', target: 'infrastructure', required: false },
  { entity: 'reviews', field: 'repositoryId', target: 'repositories', required: false },
  // Recorded commits belong to their repository and are removed with it.
  { entity: 'commits', field: 'repositoryId', target: 'repositories', required: true, cascade: true },
];

export const OBJECT_COLLECTIONS = {
  categories: { label: 'Registry Categories', file: 'catalog/categories.json' },
  settings: { label: 'Settings', file: 'system/settings.json' },
  idSequences: { label: 'ID Sequences', file: 'system/id-sequences.json' },
};

export const ENTITY_KEYS = Object.keys(ENTITIES);
export const RELATION_KEYS = Object.keys(RELATIONS);

export const DEFAULT_SETTINGS = {
  general: { appName: 'BRICKHOUSE', description: 'Application Registry & Ecosystem Inventory for VSG Group', organization: 'VSG Group', ownerName: 'Registry Owner', theme: 'Brickhouse (default)', lighthouseUrl: 'http://localhost:5174' },
  preferences: { themeMode: 'light', dateFormat: 'DD MMM YYYY', timeFormat: '24h' },
  integrations: {
    github: { organization: '', apiBaseUrl: 'https://api.github.com', notes: '' },
    gitlab: { organization: '', apiBaseUrl: 'https://gitlab.com/api/v4', notes: '' },
    bitbucket: { organization: '', apiBaseUrl: 'https://api.bitbucket.org/2.0', notes: '' },
  },
};

/** Route of an entity's detail page (null when it has none). */
export function routeFor(entity, id) {
  if (entity === 'companies') return '/settings?section=companies';
  if (['endpoints', 'activities', 'reviews', 'commits'].includes(entity)) return null;
  const base = ENTITIES[entity]?.route;
  return base ? `${base}/${encodeURIComponent(id)}` : null;
}

/** Resolve which entity collection a prefixed ID belongs to. */
export function entityForId(id = '') {
  const prefix = String(id).split('-')[0];
  return ENTITY_KEYS.find((k) => ENTITIES[k].prefix === prefix) || null;
}
