import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Code2, GitBranch, GitPullRequest, GitMerge, Clock3, Users, FlaskConical, BarChart3, FolderGit2, User, ListTree, Info,
  ExternalLink, Layers, Github, PieChart, Target, Trophy, GitCommitHorizontal, CalendarDays, AppWindow, RefreshCw,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import SectionCard from '../../components/common/SectionCard';
import DetailTabs from '../../components/common/DetailTabs';
import SelectMenu from '../../components/common/SelectMenu';
import Trend, { pctChange } from '../../components/common/Trend';
import MetricList from '../../components/common/MetricList';
import ProgressBar from '../../components/common/ProgressBar';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import BarChart from '../../components/charts/BarChart';
import LineChart from '../../components/charts/LineChart';
import DonutChart from '../../components/charts/DonutChart';
import Heatmap from '../../components/charts/Heatmap';
import DataTable from '../../components/tables/DataTable';
import FilterBar from '../../components/tables/FilterBar';
import RowActions from '../../components/tables/RowActions';
import EntityLink from '../../components/common/EntityLink';
import StatusBadge from '../../components/badges/StatusBadge';
import GitSourceBadge from '../../components/badges/GitSourceBadge';
import { seriesColor } from '../../components/charts/palette';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useToast } from '../../hooks/useToast';
import { useNotifications } from '../../hooks/useNotifications';
import { PERIODS, buildGitData, summarizeGit, byApplication, bucketKey } from '../../services/git-analytics.service';
import {
  integrationConnections,
  matchingRepositories,
  fetchServerTokenStatus,
  fetchIntegrationFullSync,
  applyIntegrationSync,
} from '../../services/git-integrations.service';
import { applicationsOfRepo } from '../../services/query.service';
import { applicationOptions } from '../../utils/options';
import { shortMonth, titleCase } from '../../helpers';

const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'project', label: 'By Project', icon: FolderGit2 },
  { key: 'repository', label: 'By Repository', icon: CalendarDays },
  { key: 'contributor', label: 'By Contributor', icon: User },
  { key: 'prs', label: 'Pull Requests', icon: GitPullRequest },
  { key: 'branches', label: 'Branches', icon: ListTree },
  { key: 'commits', label: 'Commits', icon: Layers },
];
const PR_COLORS = { open: 'var(--bh-info)', merged: 'var(--bh-success)', closed: 'var(--bh-gray-500)' };
const BRANCH_KINDS = ['main', 'develop', 'feature', 'fix', 'release', 'chore'];

export default function ProgressReviewPage() {
  const { data, run } = useRegistry();
  const fmt = useFormat();
  const toast = useToast();
  const { notify } = useNotifications();
  const [section, setSection] = useState('overview');
  const [periodKey, setPeriodKey] = useState('30d');
  const period = PERIODS.find((p) => p.key === periodKey);
  const [grouping, setGrouping] = useState('day');
  const [appId, setAppId] = useState('');
  const [prSearch, setPrSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const syncController = useRef(null);

  useEffect(() => () => syncController.current?.abort(), []);

  const handleSyncAll = async () => {
    if (syncController.current) return;
    const allConnections = integrationConnections(data.settings.integrations);
    const activeConnections = allConnections.filter((c) => matchingRepositories(data.repositories, c).length > 0);
    if (!activeConnections.length) {
      toast('No integrations match registered repositories. Configure one in Settings → Integrations.', 'error');
      return;
    }

    const request = new AbortController();
    syncController.current = request;
    setSyncing(true);

    try {
      const envStatus = await fetchServerTokenStatus(activeConnections);
      let totalRepos = 0;
      let totalAdded = 0;
      let totalBranches = 0;
      let totalPrs = 0;
      let totalFailures = 0;
      let rateLimited = false;

      for (const conn of activeConnections) {
        request.signal.throwIfAborted();
        const useServerToken = Boolean(envStatus.statuses?.[conn.id]?.configured);
        const result = await fetchIntegrationFullSync(conn, data.repositories, '', { signal: request.signal, useServerToken });
        request.signal.throwIfAborted();
        if (result.successes.length) {
          const saved = run(applyIntegrationSync, conn, result);
          totalRepos += saved.repositories || 0;
          totalAdded += saved.added || 0;
          totalBranches += saved.branches || 0;
          totalPrs += saved.prs || 0;
        }
        totalFailures += result.failures.length;
        if (result.rateLimited) {
          rateLimited = true;
          break;
        }
      }

      const failedAll = totalRepos === 0 && totalFailures > 0;
      const msg = rateLimited
        ? `Synced ${totalRepos} repositories (${totalAdded} new commits). GitHub rate limit reached — check .env PAT.`
        : failedAll
          ? `Sync failed for all ${totalFailures} repositories.`
          : `Synced ${totalRepos} repositories · ${totalAdded} new commits · ${totalBranches} branches · ${totalPrs} PRs${totalFailures ? ` (${totalFailures} failed)` : ''}.`;

      toast(msg, totalFailures ? 'error' : 'success', { skipNotification: true });
      notify({
        kind: 'sync',
        tone: failedAll ? 'danger' : totalFailures ? 'warning' : 'success',
        title: failedAll ? 'Git sync failed' : 'Git sync completed',
        message: msg,
        to: '/progress',
      });
    } catch (e) {
      if (!request.signal.aborted) {
        toast(e.message, 'error', { skipNotification: true });
        notify({ kind: 'sync', tone: 'danger', title: 'Git sync failed', message: e.message, to: '/progress' });
      }
    } finally {
      syncController.current = null;
      setSyncing(false);
    }
  };

  const git = useMemo(() => buildGitData(data), [data]);
  const source = git.source;
  const caps = source.caps;
  const badge = <GitSourceBadge source={source} />;
  const na = (cap, v) => (cap ? v : '—');
  const repoIds = useMemo(() => (appId ? new Set(data.repositories.filter((r) => applicationsOfRepo(data, r.id).some((a) => a.record.id === appId)).map((r) => r.id)) : null), [data, appId]);
  const s = useMemo(() => summarizeGit(git, { days: period.days, grouping, repositoryIds: repoIds }), [git, period.days, grouping, repoIds]);
  // previous window of the same length (for "vs. last N days"); not available for 1 year
  const prev = useMemo(() => (period.days * 2 <= 365 ? summarizeGit(git, { days: period.days * 2, grouping: 'month', repositoryIds: repoIds }) : null), [git, period.days, repoIds]);
  const prevCommits = prev ? prev.totals.commits - s.totals.commits : null;
  const prevByRepo = useMemo(() => new Map((prev?.byRepo || []).map((r) => [r.repository.id, r.commits])), [prev]);
  const yearHeat = useMemo(() => summarizeGit(git, { days: 365, grouping: 'month', repositoryIds: repoIds }).heat, [git, repoIds]);
  const projects = useMemo(() => byApplication(s).filter((p) => !appId || p.application.id === appId), [s, appId]);
  const activeProjects = projects.filter((p) => p.commits > 0);

  const periodDates = git.days.slice(-period.days);
  const label = (d) => (grouping === 'month' ? `${shortMonth(d)} ${String(new Date(d).getFullYear()).slice(2)}` : `${shortMonth(d)} ${new Date(d).getDate()}`);
  const tip = (d) => (grouping === 'month' ? `${shortMonth(d)} ${new Date(d).getFullYear()}` : grouping === 'week' ? `week of ${fmt.date(d)}` : fmt.date(d));
  const bucketize = (daily) => {
    const m = new Map(s.series.map((b) => [b.key, 0]));
    daily.forEach((v, i) => { const k = bucketKey(periodDates[i], grouping); m.set(k, (m.get(k) || 0) + v); });
    return s.series.map((b) => m.get(b.key));
  };
  const commitTrend = pctChange(s.totals.commits, prevCommits);
  const vsLabel = prev ? `vs. previous ${period.days} days` : null;
  const share = (n) => (s.totals.commits ? (n / s.totals.commits) * 100 : 0);

  const top = activeProjects.slice(0, 5);
  const othersTotal = activeProjects.slice(5).reduce((a, p) => a + p.commits, 0);
  const distribution = [...top.map((p, i) => ({ label: p.application.name, value: p.commits, color: seriesColor(i) })), ...(othersTotal ? [{ label: 'Others', value: othersTotal, color: 'var(--bh-gray-300)' }] : [])];
  const trend = top.map((p, i) => ({ name: p.application.name, color: seriesColor(i), values: bucketize(p.series) }));
  const prDonut = ['open', 'merged', 'closed'].map((k) => ({ label: titleCase(k), value: s.totals[`${k}Prs`], color: PR_COLORS[k] }));
  const branchDonut = BRANCH_KINDS.map((k, i) => ({ label: titleCase(k), value: s.branchKinds[k] || 0, color: seriesColor(i) })).filter((d) => d.value > 0);
  const allPrs = s.byRepo.flatMap((r) => r.prList.map((p) => ({ ...p, repository: r.repository, key: `${r.repository.id}#${p.number}`, createdAt: p.createdAt ? new Date(p.createdAt) : s.dayIndexToDate(p.idx) })));
  const allBranches = s.byRepo.flatMap((r) => r.branchList.map((b) => ({ ...b, repository: r.repository, key: `${r.repository.id}:${b.name}`, lastCommitAt: s.dayIndexToDate(b.lastIdx) })));
  const filteredPrs = useMemo(() => {
    const q = prSearch.trim().toLowerCase();
    if (!q) return allPrs;
    return allPrs.filter((p) => (
      `#${p.number}`.toLowerCase().includes(q)
      || (p.repository?.name || '').toLowerCase().includes(q)
      || (p.status || '').toLowerCase().includes(q)
      || (p.author || '').toLowerCase().includes(q)
    ));
  }, [allPrs, prSearch]);
  const filteredBranches = useMemo(() => {
    const q = branchSearch.trim().toLowerCase();
    if (!q) return allBranches;
    return allBranches.filter((b) => (
      (b.name || '').toLowerCase().includes(q)
      || (b.kind || '').toLowerCase().includes(q)
      || (b.repository?.name || '').toLowerCase().includes(q)
    ));
  }, [allBranches, branchSearch]);
  const topPrAuthors = useMemo(() => {
    const counts = new Map();
    allPrs.forEach((p) => { if (p.author) counts.set(p.author, (counts.get(p.author) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [allPrs]);
  const topBranchRepos = useMemo(() => (
    [...s.byRepo].filter((r) => r.branches > 0).sort((a, b) => b.branches - a.branches).slice(0, 3)
  ), [s.byRepo]);
  const prMergeRate = s.totals.prs ? Math.round((s.totals.mergedPrs / s.totals.prs) * 100) : 0;
  const branchPrimaryCount = (s.branchKinds.main || 0) + (s.branchKinds.release || 0);
  const branchDevCount = Math.max(0, s.totals.branches - branchPrimaryCount);
  const commitRows = git.commits.filter((c) => (!repoIds || repoIds.has(c.repositoryId)) && new Date(c.committedAt) >= periodDates[0]);
  const notRecorded = (what) => <EmptyState icon={Info} title={`${what} not recorded`} message="The recorded Git snapshot contains commits only. This fills in once a Git provider is connected." />;

  const metrics = [
    { label: 'Total Commits', value: s.totals.commits, icon: Code2, tone: 'orange', trend: <Trend delta={commitTrend} percent label={vsLabel || 'selected period'} /> },
    { label: 'Total Branches', value: na(caps.branches, s.totals.branches), icon: GitBranch, tone: 'info', hint: caps.branches ? 'with commits in period' : 'not recorded' },
    { label: 'Total Pull Requests', value: na(caps.prs, s.totals.prs), icon: GitPullRequest, tone: 'danger', hint: caps.prs ? 'opened in period' : 'not recorded' },
    { label: 'Merged PRs', value: na(caps.prs, s.totals.mergedPrs), icon: GitMerge, tone: 'success', hint: caps.prs ? `${s.totals.prs ? ((s.totals.mergedPrs / s.totals.prs) * 100).toFixed(1) : 0}% of total` : 'not recorded' },
    { label: 'Open PRs', value: na(caps.prs, s.totals.openPrs), icon: Clock3, tone: 'warning', hint: caps.prs ? `${s.totals.prs ? ((s.totals.openPrs / s.totals.prs) * 100).toFixed(1) : 0}% of total` : 'not recorded' },
    { label: 'Active Contributors', value: na(caps.contributors, s.totals.contributors), icon: Users, tone: 'info', hint: caps.contributors ? 'committed in period' : 'not recorded' },
  ];

  const projectColumns = [
    { key: 'rank', label: '#', sortable: false, width: 32, render: (p, i) => i + 1 },
    { key: 'project', label: 'Project', sortValue: (p) => p.application.name, render: (p) => (
      <div className="d-flex align-items-center gap-2 min-w-0"><Avatar name={p.application.name} seed={p.application.id} src={p.application.logoUrl} size={26} />
        {p.application.id === '—' ? 'Unassigned' : <EntityLink entity="applications" record={p.application} className="bh-nowrap" />}</div>
    ) },
    { key: 'repository', label: 'Repository', sortable: false, render: (p) => (
      <div className="d-flex flex-column gap-1 min-w-0" style={{ maxWidth: 165 }}>{p.repositories.slice(0, 2).map((r) => <span key={r.id} className="d-inline-flex align-items-center gap-1 small text-truncate"><Github size={12} className="flex-shrink-0" /><span className="text-truncate">{r.name}</span></span>)}</div>
    ) },
    { key: 'commits', label: 'Commits', sub: `(${period.label})`, align: 'right', render: (p) => {
      const prevN = p.repositories.reduce((a, r) => a + ((prevByRepo.get(r.id) || 0) - (s.byRepo.find((x) => x.repository.id === r.id)?.commits || 0)), 0);
      return <div className="text-nowrap"><strong>{p.commits}</strong>{prev && <div><Trend delta={pctChange(p.commits, prevN)} percent /></div>}</div>;
    } },
    { key: 'share', label: 'Share', sortValue: (p) => p.commits, render: (p) => <div style={{ minWidth: 70 }}><ProgressBar value={share(p.commits)} color={seriesColor(activeProjects.indexOf(p) >= 0 && activeProjects.indexOf(p) < 8 ? activeProjects.indexOf(p) : 0)} label="Share of commits" /></div> },
    { key: 'lastCommitAt', label: 'Last Commit', render: (p) => <span className="text-nowrap">{p.lastCommitAt ? fmt.relative(p.lastCommitAt) : '—'}</span> },
    { key: 'actions', label: '', sortable: false, render: (p) => (p.application.id === '—' ? null : (
      <RowActions label={p.application.name} viewTo={`/applications/${p.application.id}`} editTo={`/applications/${p.application.id}/edit`}
        extra={p.repositories.map((r) => ({ label: `Open ${r.name}`, icon: GitBranch, to: `/repositories/${r.id}` }))} />
    )) },
  ];
  const repoColumns = [
    { key: 'repository', label: 'Repository', sortValue: (r) => r.repository.name, render: (r) => <span className="d-inline-flex align-items-center gap-2 text-nowrap"><Github size={15} /><EntityLink entity="repositories" record={r.repository} /></span> },
    { key: 'apps', label: 'Application', sortable: false, render: (r) => r.applications.map((a) => a.name).join(', ') || '—' },
    { key: 'commits', label: 'Commits', align: 'right' },
    { key: 'branches', label: 'Branches', align: 'right', render: (r) => r.branches },
    { key: 'prs', label: 'Total PR', align: 'right', render: (r) => r.prs },
    { key: 'share', label: 'Share', sortValue: (r) => r.commits, render: (r) => <div style={{ minWidth: 80 }}><ProgressBar value={share(r.commits)} label="Share of commits" /></div> },
    { key: 'lastCommitAt', label: 'Last Commit', render: (r) => fmt.date(r.lastCommitAt) },
  ];

  // Columns for data the source does not contain are hidden instead of showing a row of dashes.
  const NEEDS = { branches: 'branches', prs: 'prs', openPrs: 'prs', mergedPrs: 'prs', contributors: 'contributors' };
  const visibleColumns = (cols) => cols.filter((c) => !NEEDS[c.key] || caps[NEEDS[c.key]]);

  const groupingFilter = (
    <div className="btn-group btn-group-sm" role="group" aria-label="Commit time grouping">
      <button
        type="button"
        className={`btn ${grouping === 'day' ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={() => setGrouping('day')}
      >
        By Day
      </button>
      <button
        type="button"
        className={`btn ${grouping === 'week' ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={() => setGrouping('week')}
      >
        By Week
      </button>
      <button
        type="button"
        className={`btn ${grouping === 'month' ? 'btn-primary' : 'btn-outline-secondary'}`}
        onClick={() => setGrouping('month')}
      >
        By Month
      </button>
    </div>
  );

  const activityCard = (
    <SectionCard icon={BarChart3} title="Commit Activity" subtitle="Number of commits over time." badge={badge}
      actions={groupingFilter}>
      <LineChart area labels={s.series.map((b) => label(b.date))} tooltipLabels={s.series.map((b) => tip(b.date))}
        series={[{ name: 'Commits', color: 'var(--bh-info)', values: s.series.map((b) => b.value) }]} height={260} maxTicks={10} />
    </SectionCard>
  );
  const distributionCard = (
    <SectionCard icon={Layers} title="Commit Distribution by Project" subtitle={`Share of commits in the ${period.label.toLowerCase()}.`} badge={badge}>
      {distribution.length ? (
        <DonutChart data={distribution} size={180} thickness={30} centerLabel="Commits" centerValue={s.totals.commits}
          legendValue={(d, total) => <>{((d.value / total) * 100).toFixed(1)}% <span className="text-muted fw-normal">({d.value})</span></>} />
      ) : <EmptyState title="No commits in this period" message="Choose a longer period." />}
    </SectionCard>
  );
  const projectTable = (
    <SectionCard icon={Target} title="Project Progress" subtitle="Development progress and Git statistics per project. Share = share of commits in the period." badge={badge} noBody>
      <DataTable compact rows={projects} pageSize={5} rowKey={(p) => p.application.id} initialSort={{ key: 'commits', dir: 'desc' }} columns={visibleColumns(projectColumns)} noun="projects" footerNote="shared repositories count for each project" />
    </SectionCard>
  );
  const summaryCard = (
    <SectionCard icon={PieChart} title="Development Summary" subtitle={period.label} badge={badge} fullHeight={false}>
      <MetricList rows={[
        { icon: Code2, label: 'Commits', value: s.totals.commits, trend: <Trend delta={commitTrend} percent /> },
        { icon: FolderGit2, label: 'Active projects', value: activeProjects.length },
        { icon: GitCommitHorizontal, label: 'Active repositories', value: s.byRepo.filter((r) => r.commits > 0).length },
        { icon: GitBranch, label: 'Branches', value: na(caps.branches, s.totals.branches), tone: 'info' },
        { icon: GitPullRequest, label: 'Pull Requests', value: na(caps.prs, s.totals.prs), tone: 'info' },
        { icon: GitMerge, label: 'Merged PRs', value: na(caps.prs, s.totals.mergedPrs), tone: 'success' },
        { icon: Clock3, label: 'Open PRs', value: na(caps.prs, s.totals.openPrs), tone: 'warning' },
      ]} />
    </SectionCard>
  );
  const contributorsCard = (
    <SectionCard icon={Trophy} title="Top Contributors" subtitle={`By number of commits (${period.label.toLowerCase()}).`} badge={badge} fullHeight={false}>
      {!caps.contributors ? <div className="text-muted small">Commit authors were not included in the recorded snapshot.</div> : (
        <div className="d-flex flex-column gap-2">
          {s.contributors.slice(0, 5).map((c) => (
            <div key={c.name} className="d-flex align-items-center gap-2">
              <Avatar name={c.name.replace('.', ' ')} size={28} round />
              <span className="flex-grow-1 text-truncate fw-semibold">{c.name}</span>
              <div style={{ width: 90 }}><div className="bh-progress"><div style={{ width: `${share(c.commits)}%`, background: 'var(--bh-orange)' }} /></div></div>
              <strong style={{ minWidth: 36, textAlign: 'right' }}>{c.commits}</strong>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
  const commitTable = (
    <SectionCard icon={GitCommitHorizontal} title="Commits" subtitle={`${commitRows.length} commits in the ${period.label.toLowerCase()}.`} badge={badge} noBody>
      {source.kind !== 'recorded' ? <EmptyState title="Individual commits are not available for sample data" /> : (
        <DataTable rows={commitRows} pageSize={10} initialSort={{ key: 'committedAt', dir: 'desc' }} noun="commits" empty={<EmptyState title="No recorded commits in this period" message="Choose a longer period." />} columns={[
          { key: 'committedAt', label: 'Date', render: (c) => <span className="text-nowrap">{fmt.dateTime(c.committedAt)}</span> },
          { key: 'repository', label: 'Repository', sortValue: (c) => c.repository?.name, render: (c) => <span className="d-inline-flex align-items-center gap-1"><Github size={14} /><EntityLink entity="repositories" record={c.repository} /></span> },
          { key: 'message', label: 'Commit message', sortable: false },
          { key: 'sha', label: 'SHA', render: (c) => (c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="mono d-inline-flex gap-1 align-items-center">{c.sha}<ExternalLink size={11} /></a> : <span className="mono">{c.sha}</span>) },
        ]} />
      )}
    </SectionCard>
  );
  const heatmapCard = (
    <SectionCard icon={CalendarDays} title="Commit Heatmap" subtitle="Daily commits over the last 12 months; darker means more." badge={badge}>
      <Heatmap cells={yearHeat} />
    </SectionCard>
  );

  const syncButtons = (
    <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-auto">
      <button type="button" className="btn btn-secondary btn-sm d-inline-flex align-items-center gap-1" disabled={syncing} onClick={handleSyncAll}>
        <RefreshCw size={14} className={syncing ? 'bh-spin' : ''} />
        {syncing ? 'Syncing…' : 'Sync now'}
      </button>
      {syncing && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => syncController.current?.abort()}>
          Cancel
        </button>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title="Progress & Review" description="Monitor development progress, commit activity, branches, and pull requests across all projects."
        actions={(
          <>
            <select className="bh-select-pill" value={appId} onChange={(e) => setAppId(e.target.value)} aria-label="Application">
              <option value="">All projects</option>
              {applicationOptions(data).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <SelectMenu ariaLabel="Period" value={periodKey} onChange={setPeriodKey} options={PERIODS.map((p) => ({ value: p.key, label: `Last ${p.label}` }))} />
          </>
        )} />
      {source.kind === 'sample' ? (
        <div className="bh-sample-banner mb-4 align-items-center justify-content-between flex-wrap">
          <div className="d-flex align-items-start gap-2 flex-grow-1 min-w-0">
            <FlaskConical size={18} color="var(--bh-warning)" className="flex-shrink-0 mt-1" />
            <div><strong>{source.label}.</strong> {source.description} <Link to="/settings?section=integrations">Settings → Integrations</Link></div>
          </div>
          {syncButtons}
        </div>
      ) : (
        <div className="bh-sample-banner mb-4 align-items-center justify-content-between flex-wrap" style={{ background: 'var(--bh-info-soft)', borderColor: 'rgba(47,111,178,.3)' }}>
          <div className="d-flex align-items-start gap-2 flex-grow-1 min-w-0">
            <Info size={18} color="var(--bh-info)" className="flex-shrink-0 mt-1" />
            <div><strong>{source.label}.</strong> {source.description} <Link to="/settings?section=integrations">Sync commits in Settings → Integrations</Link>.</div>
          </div>
          {syncButtons}
        </div>
      )}
      <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 168px), 1fr))', gap: 14 }}>
        {metrics.map((m) => <StatCard key={m.label} {...m} />)}
      </div>
      <DetailTabs tabs={SECTIONS} active={section} onChange={setSection} />

      {section === 'overview' && (
        <div className="row g-4">
          <div className="col-xl-7">{activityCard}</div>
          <div className="col-xl-5">{distributionCard}</div>
          <div className="col-xl-8">{projectTable}</div>
          <div className="col-xl-4 d-flex flex-column gap-4">{summaryCard}{contributorsCard}</div>
        </div>
      )}

      {section === 'project' && (
        <div className="row g-4">
          <div className="col-12">
            <SectionCard icon={FolderGit2} title="Project Commit Trend" subtitle={`Top ${trend.length} projects · by ${grouping}`} badge={badge}>
              {trend.length ? (
                <>
                  <LineChart labels={s.series.map((b) => label(b.date))} tooltipLabels={s.series.map((b) => tip(b.date))} series={trend} height={250} />
                  <div className="bh-legend mt-2">{trend.map((x) => <span key={x.name}><span className="bh-legend-swatch" style={{ background: x.color }} />{x.name}</span>)}</div>
                </>
              ) : <EmptyState title="No commits in this period" />}
            </SectionCard>
          </div>
          <div className="col-12">{projectTable}</div>
        </div>
      )}

      {section === 'repository' && (
        <div className="row g-4">
          <div className="col-12">
            <SectionCard icon={GitBranch} title="Repository Activity" subtitle="Commits per repository in the period" badge={badge}>
              <BarChart gradient maxBar={40} data={[...s.byRepo].filter((r) => r.commits > 0).sort((a, b) => b.commits - a.commits).map((r) => ({ label: r.repository.name.length > 14 ? `${r.repository.name.slice(0, 13)}…` : r.repository.name, tooltip: r.repository.name, value: r.commits }))} valueLabel="commits" maxTicks={14} />
            </SectionCard>
          </div>
          <div className="col-12"><SectionCard icon={AppWindow} title="Repository Statistics" noBody><DataTable rows={s.byRepo} rowKey={(r) => r.repository.id} initialSort={{ key: 'commits', dir: 'desc' }} columns={visibleColumns(repoColumns)} noun="repositories" /></SectionCard></div>
        </div>
      )}

      {section === 'contributor' && (caps.contributors ? (
        <div className="row g-4">
          <div className="col-xl-5">{contributorsCard}</div>
          <div className="col-xl-7">
            <SectionCard icon={Users} title="Contributors" noBody>
              <DataTable rows={s.contributors} rowKey={(c) => c.name} initialSort={{ key: 'commits', dir: 'desc' }} noun="contributors" columns={[
                { key: 'name', label: 'Contributor', render: (c) => <span className="d-inline-flex align-items-center gap-2"><Avatar name={c.name.replace('.', ' ')} size={26} round /><span className="mono fw-semibold">{c.name}</span></span> },
                { key: 'commits', label: 'Commits', align: 'right' },
                { key: 'repositories', label: 'Repositories', align: 'right' },
                { key: 'share', label: 'Share', sortValue: (c) => c.commits, render: (c) => <ProgressBar value={share(c.commits)} label="Share" /> },
              ]} />
            </SectionCard>
          </div>
        </div>
      ) : <div className="bh-card">{notRecorded('Commit authors')}</div>)}

      {section === 'prs' && (caps.prs ? (
        <div className="row g-4">
          <div className="col-xl-4">
            <SectionCard icon={GitPullRequest} title="Pull Request Status" badge={badge}>
              <DonutChart data={prDonut} centerLabel="Pull requests" size={160} thickness={24} />
              <div className="border-top pt-3 mt-4 d-flex flex-column gap-3">
                <div>
                  <div className="d-flex justify-content-between align-items-center small mb-1">
                    <span className="text-muted fw-semibold">Merge Rate</span>
                    <strong className="text-success">{prMergeRate}%</strong>
                  </div>
                  <ProgressBar value={prMergeRate} color="var(--bh-success)" label="PR merge rate" />
                </div>
                <div className="d-flex flex-column gap-2 small">
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Open PRs</span>
                    <strong>{s.totals.openPrs}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Merged PRs</span>
                    <strong>{s.totals.mergedPrs}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Closed (Unmerged)</span>
                    <strong>{s.totals.closedPrs}</strong>
                  </div>
                </div>
                {topPrAuthors.length > 0 && (
                  <div className="border-top pt-3">
                    <div className="small text-muted fw-semibold mb-2">Top PR Authors</div>
                    <div className="d-flex flex-column gap-2">
                      {topPrAuthors.map(([author, count]) => (
                        <div key={author} className="d-flex align-items-center gap-2 small">
                          <Avatar name={author.replace('.', ' ')} size={22} round />
                          <span className="flex-grow-1 text-truncate mono">{author}</span>
                          <span className="bh-chip">{count} PR</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
          <div className="col-xl-8">
            <SectionCard icon={GitPullRequest} title="Pull Requests" subtitle={`${filteredPrs.length} pull requests`} noBody>
              <FilterBar
                search={prSearch}
                onSearch={setPrSearch}
                placeholder="Search PR #, repository, status or author…"
                active={!!prSearch}
                onClear={() => setPrSearch('')}
              />
              <DataTable rows={filteredPrs} pageSize={5} rowKey={(p) => p.key} initialSort={{ key: 'createdAt', dir: 'desc' }} noun="pull requests" columns={[
                { key: 'number', label: 'PR', render: (p) => (p.url ? <a href={p.url} target="_blank" rel="noreferrer" className="mono d-inline-flex align-items-center gap-1" title={p.title || ''}>#{p.number}<ExternalLink size={11} /></a> : <span className="mono" title={p.title || ''}>#{p.number}</span>) },
                { key: 'repository', label: 'Repository', sortValue: (p) => p.repository.name, render: (p) => <EntityLink entity="repositories" record={p.repository} /> },
                { key: 'status', label: 'Status', render: (p) => <StatusBadge value={p.status} /> },
                { key: 'author', label: 'Author', render: (p) => <span className="mono">{p.author}</span> },
                { key: 'createdAt', label: 'Opened', sortValue: (p) => p.createdAt.getTime(), render: (p) => fmt.date(p.createdAt) },
              ]} />
            </SectionCard>
          </div>
        </div>
      ) : <div className="bh-card">{notRecorded('Pull requests')}</div>)}

      {section === 'branches' && (caps.branches ? (
        <div className="row g-4">
          <div className="col-xl-4">
            <SectionCard icon={ListTree} title="Branch Distribution" badge={badge}>
              <DonutChart data={branchDonut} centerLabel="Branches" size={160} thickness={24} />
              <div className="border-top pt-3 mt-4 d-flex flex-column gap-3">
                <div className="d-flex flex-column gap-2 small">
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Primary & Release</span>
                    <strong>{branchPrimaryCount} branches</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="text-muted">Working (Dev / Feature / Fix)</span>
                    <strong>{branchDevCount} branches</strong>
                  </div>
                </div>
                {topBranchRepos.length > 0 && (
                  <div className="border-top pt-3">
                    <div className="small text-muted fw-semibold mb-2">Most Active Repositories</div>
                    <div className="d-flex flex-column gap-2">
                      {topBranchRepos.map((r) => (
                        <div key={r.repository.id} className="d-flex align-items-center gap-2 small">
                          <Github size={14} className="text-muted flex-shrink-0" />
                          <span className="flex-grow-1 text-truncate">{r.repository.name}</span>
                          <span className="bh-chip">{r.branches} branches</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>
          </div>
          <div className="col-xl-8">
            <SectionCard icon={GitBranch} title="Active Branches" subtitle={`${filteredBranches.length} active branches`} noBody>
              <FilterBar
                search={branchSearch}
                onSearch={setBranchSearch}
                placeholder="Search branch name, type or repository…"
                active={!!branchSearch}
                onClear={() => setBranchSearch('')}
              />
              <DataTable rows={filteredBranches} pageSize={5} rowKey={(b) => b.key} initialSort={{ key: 'lastCommitAt', dir: 'desc' }} noun="branches" columns={[
                { key: 'name', label: 'Branch', render: (b) => <span className="mono">{b.name}</span> },
                { key: 'kind', label: 'Type', render: (b) => titleCase(b.kind) },
                { key: 'repository', label: 'Repository', sortValue: (b) => b.repository.name, render: (b) => <EntityLink entity="repositories" record={b.repository} /> },
                { key: 'lastCommitAt', label: 'Last Commit', sortValue: (b) => b.lastCommitAt.getTime(), render: (b) => fmt.date(b.lastCommitAt) },
              ]} />
            </SectionCard>
          </div>
        </div>
      ) : <div className="bh-card">{notRecorded('Branches')}</div>)}

      {section === 'commits' && (
        <div className="row g-4">
          <div className="col-12">{activityCard}</div>
          <div className="col-12">{commitTable}</div>
          <div className="col-12">{heatmapCard}</div>
        </div>
      )}
    </>
  );
}

