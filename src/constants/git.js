// Pure Git provider constants & environment-variable naming helpers (shared by client services and Node proxy).

export const GIT_PROVIDERS = [
  { key: 'github', label: 'GitHub', apiBaseUrl: 'https://api.github.com' },
  { key: 'gitlab', label: 'GitLab', apiBaseUrl: 'https://gitlab.com/api/v4' },
  { key: 'bitbucket', label: 'Bitbucket', apiBaseUrl: 'https://api.bitbucket.org/2.0' },
];

export const DEFAULT_ALLOWED_GIT_ORIGINS = {
  github: ['https://api.github.com'],
  gitlab: ['https://gitlab.com'],
  bitbucket: ['https://api.bitbucket.org'],
};

export const BROAD_CLASSIC_SCOPES = new Set(['repo', 'delete_repo', 'admin:org', 'write:org', 'workflow', 'admin:repo_hook']);

export const GIT_SYNC_LIMITS = {
  maxPages: 5,
  perPage: 100,
  timeoutMs: 20000,
  extrasTimeoutMs: 15000,
};

export const PR_STATUS_COLORS = {
  open: 'var(--bh-info)',
  merged: 'var(--bh-success)',
  closed: 'var(--bh-gray-500)',
};

export function normalizeOrgEnvSuffix(org = '') {
  return String(org || '').trim().replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

export function providerEnvVarName(provider = 'github') {
  return `BRICKHOUSE_${String(provider || 'github').toUpperCase()}_TOKEN`;
}

export function envVarNameFor(connection) {
  const base = providerEnvVarName(connection?.provider);
  const suffix = normalizeOrgEnvSuffix(connection?.organization || '');
  return suffix ? `${base}_${suffix}` : base;
}
