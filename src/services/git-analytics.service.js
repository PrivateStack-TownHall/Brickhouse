// Git development analytics.
//
// GitHub / GitLab / Bitbucket sync writes provider snapshots into the registry. Two sources exist:
//  - RECORDED: commits stored in the registry (`commits` collection, e.g. imported from a
//    GitHub snapshot). Only what was recorded is shown; branches, PRs and authors are
//    reported as "not recorded" when the records do not contain them.
//  - SAMPLE: when no commits are recorded, a deterministic, clearly-labelled sample is
//    generated from the registered repositories so the dashboards can be reviewed.
import { applicationsOfRepo } from './query.service';

export const GIT_DATA_SOURCE = {
  kind: 'sample', label: 'Sample data',
  description: 'Illustrative values generated locally from registered repositories. No Git provider is connected.',
  caps: { branches: true, prs: true, contributors: true },
};

export const PERIODS = [
  { key: '7d', label: '7 Days', days: 7, groupings: ['day'] },
  { key: '30d', label: '30 Days', days: 30, groupings: ['day', 'week'] },
  { key: '90d', label: '90 Days', days: 90, groupings: ['day', 'week', 'month'] },
  { key: '6m', label: '6 Months', days: 182, groupings: ['week', 'month'] },
  { key: '1y', label: '1 Year', days: 365, groupings: ['week', 'month'] },
];

const HISTORY_DAYS = 365;
const CONTRIBUTORS = ['dev.alpha', 'dev.bravo', 'dev.charlie', 'dev.delta', 'dev.echo', 'dev.foxtrot', 'dev.golf', 'dev.hotel', 'dev.india'];
const LEVEL = { planning: 0.35, development: 4.2, testing: 3.1, active: 2.3, maintenance: 0.9, archived: 0.6 };
const RANK = ['archived', 'planning', 'maintenance', 'active', 'testing', 'development'];
const DAY = 86400000;

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const dayKey = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const cache = new Map();

/** Recorded commits if any exist, otherwise the labelled sample. */
export function buildGitData(ds, anchor = new Date()) {
  return (ds.commits || []).length ? buildRecordedGit(ds, anchor) : buildGitSample(ds, anchor);
}

const recordedCache = new WeakMap();

/** Aggregate recorded commits into the same shape as the sample. */
export function buildRecordedGit(ds, anchor = new Date()) {
  const end = startOfDay(anchor);
  const key = dayKey(end);
  const cached = recordedCache.get(ds);
  if (cached?.key === key) return cached.result;
  const start = end.getTime() - (HISTORY_DAYS - 1) * DAY;
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => new Date(start + i * DAY));
  const byRepo = new Map((ds.repositories || []).map((r) => [r.id, []]));
  ds.commits.forEach((c) => byRepo.get(c.repositoryId)?.push(c));
  const repos = (ds.repositories || []).map((repo) => {
    const list = byRepo.get(repo.id) || [];
    const daily = new Array(HISTORY_DAYS).fill(0);
    let last = null;
    for (const c of list) {
      const idx = Math.round((startOfDay(c.committedAt).getTime() - start) / DAY);
      if (idx >= 0 && idx < HISTORY_DAYS) daily[idx] += 1;
      if (!last || c.committedAt > last) last = c.committedAt;
    }
    return { repository: repo, applications: applicationsOfRepo(ds, repo.id).map((x) => x.record), daily, byContributor: {}, branches: [], prs: [], lastCommitAt: last };
  });
  const withCommits = repos.filter((r) => r.lastCommitAt).length;
  const repoById = new Map((ds.repositories || []).map((r) => [r.id, r]));
  const synced = ds.commits.some((c) => c.integrationId);
  const result = {
    source: {
      kind: 'recorded', label: synced ? 'Synced commits' : 'Recorded commits', synced,
      description: synced
        ? `${ds.commits.length} commits across ${withCommits} repositories are saved locally, including provider sync results. Sync imports up to 500 latest primary-branch commits per repository; this is not full history or live monitoring. Branch and pull-request analytics are not collected.`
        : `${ds.commits.length} commits across ${withCommits} repositories are recorded in the registry — a selected snapshot from GitHub, not the full history. Author, branch and pull-request data were not included.`,
      caps: { branches: false, prs: false, contributors: false },
    },
    end, days, repos,
    commits: [...ds.commits].sort((a, b) => b.committedAt.localeCompare(a.committedAt)).map((c) => ({ ...c, repository: repoById.get(c.repositoryId) })),
  };
  recordedCache.set(ds, { key, result });
  return result;
}

/** Deterministic sample history (365 days) for every registered repository. */
export function buildGitSample(ds, anchor = new Date()) {
  const end = startOfDay(anchor);
  const cacheKey = `${dayKey(end)}|${(ds.repositories || []).map((r) => r.id).join(',')}|${(ds.applications || []).map((a) => a.id + a.lifecycle).join(',')}|${(ds.applicationRepositories || []).length}|${(ds.componentRepositories || []).length}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const days = Array.from({ length: HISTORY_DAYS }, (_, i) => new Date(end.getTime() - (HISTORY_DAYS - 1 - i) * DAY));

  const repos = (ds.repositories || []).map((repo) => {
    const apps = applicationsOfRepo(ds, repo.id).map((x) => x.record);
    const lifecycle = apps.length ? apps.map((a) => a.lifecycle).sort((a, b) => RANK.indexOf(b) - RANK.indexOf(a))[0] : 'maintenance';
    const level = LEVEL[lifecycle] ?? 1;
    const rand = mulberry32(hash(repo.id + repo.name));
    const team = [...CONTRIBUTORS].sort(() => rand() - 0.5).slice(0, 2 + Math.floor(rand() * 3));
    const weights = team.map(() => 0.3 + rand());
    const byContributor = Object.fromEntries(team.map((c) => [c, new Array(HISTORY_DAYS).fill(0)]));
    const daily = new Array(HISTORY_DAYS).fill(0);
    const phase = rand() * Math.PI * 2;
    for (let i = 0; i < HISTORY_DAYS; i += 1) {
      const age = HISTORY_DAYS - 1 - i;
      if (lifecycle === 'archived' && age < 245) continue; // archived ~8 months ago
      if (lifecycle === 'planning' && age > 45) continue; // repository only recently started
      const dow = days[i].getDay();
      const weekday = dow === 0 || dow === 6 ? 0.2 : 1;
      const wave = 0.65 + 0.45 * Math.sin(i / 18 + phase);
      const lambda = level * weekday * wave;
      let n = 0;
      for (let k = 0; k < 3; k += 1) n += rand() < lambda / 3 ? 1 + Math.floor(rand() * 2) : 0;
      daily[i] = n;
      for (let c = 0; c < n; c += 1) {
        let r = rand() * weights.reduce((a, b) => a + b, 0);
        let idx = 0;
        while (r > weights[idx] && idx < weights.length - 1) { r -= weights[idx]; idx += 1; }
        byContributor[team[idx]][i] += 1;
      }
    }
    const lastIdx = daily.reduce((li, v, i) => (v > 0 ? i : li), -1);
    const activeDays = daily.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0);
    const pick = () => (activeDays.length ? activeDays[Math.floor(rand() * activeDays.length)] : HISTORY_DAYS - 1);

    const branchKinds = ['feature', 'feature', 'feature', 'fix', 'fix', 'release', 'chore'];
    const branches = [{ name: repo.mainBranch || 'main', kind: 'main', lastIdx: Math.max(lastIdx, 0) }];
    if (level > 1) branches.push({ name: 'develop', kind: 'develop', lastIdx: Math.max(lastIdx, 0) });
    const nBranches = Math.round(level * 2.2 + rand() * 3);
    for (let b = 0; b < nBranches; b += 1) {
      const kind = branchKinds[Math.floor(rand() * branchKinds.length)];
      branches.push({ name: `${kind}/${repo.code || 'task'}-${100 + Math.floor(rand() * 400)}`, kind, lastIdx: pick() });
    }
    const totalCommits = daily.reduce((a, b) => a + b, 0);
    const prs = Array.from({ length: Math.round(totalCommits / 6) }, (_, p) => {
      const idx = pick();
      const age = HISTORY_DAYS - 1 - idx;
      const r = rand();
      const status = age < 10 ? (r < 0.55 ? 'open' : r < 0.92 ? 'merged' : 'closed') : r < 0.82 ? 'merged' : r < 0.95 ? 'closed' : 'open';
      return { number: p + 1, idx, status, author: team[Math.floor(rand() * team.length)] };
    });
    return {
      repository: repo,
      applications: apps,
      lifecycle,
      daily,
      byContributor,
      branches,
      prs,
      lastCommitAt: lastIdx >= 0 ? new Date(days[lastIdx].getTime() + 15 * 3600000).toISOString() : null,
    };
  });
  const result = { source: GIT_DATA_SOURCE, end, days, repos, commits: [] };
  cache.set(cacheKey, result);
  return result;
}

export function bucketKey(date, grouping) {
  const d = new Date(date);
  if (grouping === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (grouping === 'week') {
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return dayKey(monday);
  }
  return dayKey(d);
}

/**
 * Aggregate the sample for a period.
 * opts: { days, grouping, repositoryIds? (Set) }
 */
export function summarizeGit(sample, { days, grouping = 'day', repositoryIds = null }) {
  const from = HISTORY_DAYS - days;
  const repos = sample.repos.filter((r) => !repositoryIds || repositoryIds.has(r.repository.id));
  const sum = (arr) => arr.slice(from).reduce((a, b) => a + b, 0);

  const buckets = new Map();
  for (let i = from; i < HISTORY_DAYS; i += 1) {
    const k = bucketKey(sample.days[i], grouping);
    if (!buckets.has(k)) buckets.set(k, { key: k, date: sample.days[i], value: 0 });
  }
  const contributors = new Map();
  const byRepo = repos.map((r) => {
    for (let i = from; i < HISTORY_DAYS; i += 1) if (r.daily[i]) buckets.get(bucketKey(sample.days[i], grouping)).value += r.daily[i];
    const contrib = Object.entries(r.byContributor).map(([name, arr]) => [name, sum(arr)]).filter(([, n]) => n > 0);
    for (const [name, n] of contrib) {
      const c = contributors.get(name) || { name, commits: 0, repositories: new Set() };
      c.commits += n;
      c.repositories.add(r.repository.id);
      contributors.set(name, c);
    }
    const prs = r.prs.filter((p) => p.idx >= from);
    const branches = r.branches.filter((b) => b.lastIdx >= from);
    return {
      repository: r.repository,
      applications: r.applications,
      commits: sum(r.daily),
      branches: branches.length,
      branchList: branches,
      totalBranches: r.branches.length,
      prs: prs.length,
      openPrs: prs.filter((p) => p.status === 'open').length,
      mergedPrs: prs.filter((p) => p.status === 'merged').length,
      closedPrs: prs.filter((p) => p.status === 'closed').length,
      prList: prs,
      contributors: contrib.length,
      contributorNames: contrib.map(([n]) => n),
      lastCommitAt: r.lastCommitAt,
      series: r.daily.slice(from),
    };
  });
  const total = (f) => byRepo.reduce((a, r) => a + r[f], 0);
  const branchKinds = {};
  byRepo.forEach((r) => r.branchList.forEach((b) => { branchKinds[b.kind] = (branchKinds[b.kind] || 0) + 1; }));
  const heat = [];
  for (let i = from; i < HISTORY_DAYS; i += 1) heat.push({ date: sample.days[i], count: repos.reduce((a, r) => a + r.daily[i], 0) });

  return {
    totals: {
      commits: total('commits'), branches: total('branches'), prs: total('prs'), mergedPrs: total('mergedPrs'),
      openPrs: total('openPrs'), closedPrs: total('closedPrs'), contributors: contributors.size,
    },
    series: [...buckets.values()],
    byRepo,
    contributors: [...contributors.values()].map((c) => ({ ...c, repositories: c.repositories.size })).sort((a, b) => b.commits - a.commits),
    branchKinds,
    heat,
    dayIndexToDate: (idx) => sample.days[idx],
  };
}

/** Group repository stats per application (a repository shared by several apps counts for each). */
export function byApplication(summary) {
  const m = new Map();
  for (const r of summary.byRepo) {
    const apps = r.applications.length ? r.applications : [{ id: '—', name: 'Unassigned' }];
    for (const a of apps) {
      const e = m.get(a.id) || { application: a, repositories: [], commits: 0, branches: 0, prs: 0, openPrs: 0, mergedPrs: 0, names: new Set(), lastCommitAt: null, series: null };
      e.repositories.push(r.repository);
      e.commits += r.commits; e.branches += r.branches; e.prs += r.prs; e.openPrs += r.openPrs; e.mergedPrs += r.mergedPrs;
      r.contributorNames.forEach((n) => e.names.add(n));
      if (r.lastCommitAt && (!e.lastCommitAt || r.lastCommitAt > e.lastCommitAt)) e.lastCommitAt = r.lastCommitAt;
      e.series = e.series ? e.series.map((v, i) => v + r.series[i]) : [...r.series];
      m.set(a.id, e);
    }
  }
  return [...m.values()].map(({ names, ...e }) => ({ ...e, contributors: names.size })).sort((a, b) => b.commits - a.commits);
}
