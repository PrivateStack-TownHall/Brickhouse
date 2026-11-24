import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Code2, GitBranch, GitPullRequest, GitMerge, Clock3, Users, FlaskConical, BarChart3, FolderGit2, User, ListTree, Info,
  ExternalLink, Layers, Github, PieChart, Target, Trophy, GitCommitHorizontal, CalendarDays, AppWindow,
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
import RowActions from '../../components/tables/RowActions';
import EntityLink from '../../components/common/EntityLink';
import StatusBadge from '../../components/badges/StatusBadge';
import GitSourceBadge from '../../components/badges/GitSourceBadge';
import { seriesColor } from '../../components/charts/palette';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { PERIODS, buildGitData, summarizeGit, byApplication, bucketKey } from '../../services/git-analytics.service';
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
  const { data } = useRegistry();
  const fmt = useFormat();
  const [section, setSection] = useState('overview');
  const [periodKey, setPeriodKey] = useState('30d');
  const period = PERIODS.find((p) => p.key === periodKey);
  const [groupingPref, setGrouping] = useState('day');
  const grouping = period.groupings.includes(groupingPref) ? groupingPref : period.groupings[0];
  const [appId, setAppId] = useState('');

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
  const allPrs = s.byRepo.flatMap((r) => r.prList.map((p) => ({ ...p, repository: r.repository, key: `${r.repository.id}#${p.number}`, createdAt: s.dayIndexToDate(p.idx) })));
  const allBranches = s.byRepo.flatMap((r) => r.branchList.map((b) => ({ ...b, repository: r.repository, key: `${r.repository.id}:${b.name}`, lastCommitAt: s.dayIndexToDate(b.lastIdx) })));
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
    { key: 'rank', label: '#', sortable: false, width: 40, render: (p, i) => i + 1 },
    { key: 'project', label: 'Project', sortValue: (p) => p.application.name, render: (p) => (
      <div className="d-flex align-items-center gap-2"><Avatar name={p.application.name} seed={p.application.id} size={30} />
        {p.application.id === '—' ? 'Unassigned' : <EntityLink entity="applications" record={p.application} className="bh-nowrap" />}</div>
    ) },
    { key: 'repository', label: 'Repository', sortable: false, render: (p) => (
      <div className="d-flex flex-column gap-1">{p.repositories.map((r) => <span key={r.id} className="d-inline-flex align-items-center gap-1 small bh-nowrap"><Github size={13} />{r.name}</span>)}</div>
    ) },
    { key: 'commits', label: 'Commits', sub: `(${period.label})`, align: 'right', render: (p) => {
      const prevN = p.repositories.reduce((a, r) => a + ((prevByRepo.get(r.id) || 0) - (s.byRepo.find((x) => x.repository.id === r.id)?.commits || 0)), 0);
      return <div className="text-nowrap"><strong>{p.commits}</strong>{prev && <div><Trend delta={pctChange(p.commits, prevN)} percent /></div>}</div>;
    } },
    { key: 'branches', label: 'Branches', align: 'right', render: (p) => na(caps.branches, p.branches) },
    { key: 'prs', label: 'PRs', sub: 'Total', align: 'right', render: (p) => na(caps.prs, p.prs) },
    { key: 'openPrs', label: 'PRs', sub: 'Open', align: 'right', render: (p) => na(caps.prs, p.openPrs) },
    { key: 'mergedPrs', label: 'PRs', sub: 'Merged', align: 'right', render: (p) => na(caps.prs, p.mergedPrs) },
    { key: 'contributors', label: 'Contributors', align: 'right', render: (p) => na(caps.contributors, p.contributors) },
    { key: 'share', label: 'Share', sortValue: (p) => p.commits, render: (p) => <div style={{ minWidth: 120 }}><ProgressBar value={share(p.commits)} color={seriesColor(activeProjects.indexOf(p) >= 0 && activeProjects.indexOf(p) < 8 ? activeProjects.indexOf(p) : 0)} label="Share of commits" /></div> },
    { key: 'lastCommitAt', label: 'Last Commit', render: (p) => <span className="text-nowrap">{p.lastCommitAt ? fmt.relative(p.lastCommitAt) : '—'}</span> },
    { key: 'actions', label: '', sortable: false, render: (p) => (p.application.id === '—' ? null : (
      <RowActions label={p.application.name} viewTo={`/applications/${p.application.id}`} editTo={`/applications/${p.application.id}/edit`}
        extra={p.repositories.map((r) => ({ label: `Open ${r.name}`, icon: GitBranch, to: `/repositories/${r.id}` }))} />
    )) },
  ];
  const repoColumns = [
    { key: 'repository', label: 'Repository', sortValue: (r) => r.repository.name, render: (r) => <span className="d-inline-flex align-items-center gap-2"><Github size={15} /><EntityLink entity="repositories" record={r.repository} /></span> },
    { key: 'apps', label: 'Application', sortable: false, render: (r) => r.applications.map((a) => a.name).join(', ') || '—' },
    { key: 'commits', label: 'Commits', align: 'right' },
    { key: 'branches', label: 'Branches', align: 'right', render: (r) => na(caps.branches, r.branches) },
    { key: 'prs', label: 'Total PR', align: 'right', render: (r) => na(caps.prs, r.prs) },
    { key: 'contributors', label: 'Contributors', align: 'right', render: (r) => na(caps.contributors, r.contributors) },
    { key: 'share', label: 'Share', sortValue: (r) => r.commits, render: (r) => <div style={{ minWidth: 120 }}><ProgressBar value={share(r.commits)} label="Share of commits" /></div> },
    { key: 'lastCommitAt', label: 'Last Commit', render: (r) => fmt.date(r.lastCommitAt) },
  ];

  // Columns for data the source does not contain are hidden instead of showing a row of dashes.
  const NEEDS = { branches: 'branches', prs: 'prs', openPrs: 'prs', mergedPrs: 'prs', contributors: 'contributors' };
  const visibleColumns = (cols) => cols.filter((c) => !NEEDS[c.key] || caps[NEEDS[c.key]]);

  const activityCard = (
    <SectionCard icon={BarChart3} title="Commit Activity" subtitle="Number of commits over time." badge={badge}
      actions={period.groupings.length > 1 && <SelectMenu ariaLabel="Group by" value={grouping} onChange={setGrouping} options={period.groupings.map((g) => ({ value: g, label: `By ${g}` }))} />}>
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
      <DataTable rows={projects} rowKey={(p) => p.application.id} initialSort={{ key: 'commits', dir: 'desc' }} columns={visibleColumns(projectColumns)} noun="projects" footerNote="shared repositories count for each project" />
    </SectionCard>
  );
  const summaryCard = (
    <SectionCard icon={PieChart} title="Development Summary" subtitle={period.label} badge={badge}>
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
    <SectionCard icon={Trophy} title="Top Contributors" subtitle={`By number of commits (${period.label.toLowerCase()}).`} badge={badge}>
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
        <div className="bh-sample-banner mb-4">
          <FlaskConical size={18} color="var(--bh-warning)" className="flex-shrink-0 mt-1" />
          <div><strong>{source.label}.</strong> {source.description} <Link to="/settings?section=integrations">Settings → Integrations</Link></div>
        </div>
      ) : (
        <div className="bh-sample-banner mb-4" style={{ background: 'var(--bh-info-soft)', borderColor: 'rgba(47,111,178,.3)' }}>
          <Info size={18} color="var(--bh-info)" className="flex-shrink-0 mt-1" />
          <div><strong>{source.label}.</strong> {source.description} <Link to="/settings?section=integrations">Sync commits in Settings → Integrations</Link>.</div>
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
          <div className="col-xl-4"><SectionCard icon={GitPullRequest} title="Pull Request Status" badge={badge}><DonutChart data={prDonut} centerLabel="Pull requests" size={160} thickness={24} /></SectionCard></div>
          <div className="col-xl-8">
            <SectionCard icon={GitPullRequest} title="Pull Requests" noBody>
              <DataTable rows={allPrs} rowKey={(p) => p.key} initialSort={{ key: 'createdAt', dir: 'desc' }} noun="pull requests" columns={[
                { key: 'number', label: 'PR', render: (p) => <span className="mono">#{p.number}</span> },
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
          <div className="col-xl-4"><SectionCard icon={ListTree} title="Branch Distribution" badge={badge}><DonutChart data={branchDonut} centerLabel="Branches" size={160} thickness={24} /></SectionCard></div>
          <div className="col-xl-8">
            <SectionCard icon={GitBranch} title="Active Branches" noBody>
              <DataTable rows={allBranches} rowKey={(b) => b.key} initialSort={{ key: 'lastCommitAt', dir: 'desc' }} noun="branches" columns={[
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

