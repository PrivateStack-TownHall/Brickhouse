import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Box, Code2, Layers, Server, Plus, BarChart3, Zap, Clock3, ArrowRight, ShieldCheck, ShieldAlert, Building2,
  AppWindow, GitBranch, Boxes, Rocket, Cpu, BarChartBig,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import SectionCard from '../../components/common/SectionCard';
import Trend, { pctChange } from '../../components/common/Trend';
import SelectMenu from '../../components/common/SelectMenu';
import QuickLinkGrid from '../../components/common/QuickLinkGrid';
import Avatar from '../../components/common/Avatar';
import IdChip from '../../components/common/IdChip';
import StackedBar from '../../components/charts/StackedBar';
import BarChart from '../../components/charts/BarChart';
import StatusBadge from '../../components/badges/StatusBadge';
import GitSourceBadge from '../../components/badges/GitSourceBadge';
import Table from '../../components/tables/Table';
import RowActions from '../../components/tables/RowActions';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { LIFECYCLES } from '../../services/schema';
import { LIFECYCLE_BAR } from '../../components/charts/palette';
import { companyOf, relationCount } from '../../services/query.service';
import { validateDataset } from '../../services/validation.service';
import { buildGitData, summarizeGit } from '../../services/git-analytics.service';
import { shortMonth, titleCase } from '../../helpers';

const PERIODS = [{ value: 7, label: 'Last 7 Days' }, { value: 30, label: 'Last 30 Days' }, { value: 90, label: 'Last 90 Days' }];
const MONTH_RANGES = [{ value: 6, label: 'Last 6 Months' }, { value: 12, label: 'Last 12 Months' }];
const DAY = 86400000;

/** Records created in the last 30 days (shown as the trend on headline cards). */
const recentCount = (rows) => rows.filter((r) => r.createdAt && Date.now() - new Date(r.createdAt).getTime() <= 30 * DAY).length;

export default function OverviewPage() {
  const { data, health } = useRegistry();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const [period, setPeriod] = useState(30);
  const [months, setMonths] = useState(6);

  const gitData = useMemo(() => buildGitData(data), [data]);
  const git = useMemo(() => summarizeGit(gitData, { days: period, grouping: 'day' }), [gitData, period]);
  const previousCommits = useMemo(() => summarizeGit(gitData, { days: period * 2, grouping: 'month' }).totals.commits - git.totals.commits, [gitData, period, git]);
  const issues = useMemo(() => validateDataset(data), [data]);
  const errors = issues.filter((i) => i.severity === 'error');
  const inaccessible = data.repositories.filter((r) => r.accessStatus === 'inaccessible').length;

  const headline = [
    { label: 'Applications', value: data.applications.length, icon: Box, tone: 'orange', to: '/applications', rows: data.applications },
    { label: 'Repositories', value: data.repositories.length, icon: Code2, tone: 'info', to: '/repositories', rows: data.repositories },
    { label: 'APIs & Services', value: data.apis.length, icon: Layers, tone: 'warning', to: '/apis', rows: data.apis },
    { label: 'Infrastructure Assets', value: data.infrastructure.length, icon: Server, tone: 'navy', to: '/infrastructure', rows: data.infrastructure },
    { label: 'Deployments', value: data.deployments.length, icon: Rocket, tone: 'success', to: '/deployments', rows: data.deployments },
  ];
  const lifecycle = LIFECYCLES.map((l) => ({ key: l, label: titleCase(l), value: data.applications.filter((a) => a.lifecycle === l).length, color: LIFECYCLE_BAR[l][0], text: LIFECYCLE_BAR[l][1] }));
  const recent = [...data.applications].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 5);
  const bars = git.series.map((b) => ({
    value: b.value,
    label: period === 7 ? new Date(b.date).toLocaleDateString('en', { weekday: 'short' }) : `${shortMonth(b.date)} ${new Date(b.date).getDate()}`,
    tooltip: fmt.date(b.date),
  }));
  const registrations = useMemo(() => {
    const now = new Date();
    return Array.from({ length: months }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
      const value = data.applications.filter((a) => {
        const c = new Date(a.createdAt);
        return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
      }).length;
      return { label: shortMonth(d), tooltip: `${shortMonth(d)} ${d.getFullYear()}`, value };
    });
  }, [data.applications, months]);
  const healthy = health.persistence && health.status !== 'error' && errors.length === 0;

  const columns = [
    { key: 'id', label: 'ID', render: (a) => <IdChip id={a.id} /> },
    { key: 'name', label: 'Application', render: (a) => <div className="d-flex align-items-center gap-2"><Avatar name={a.name} seed={a.id} size={30} /><Link to={`/applications/${a.id}`} className="cell-strong" onClick={(e) => e.stopPropagation()}>{a.name}</Link></div> },
    { key: 'company', label: 'Company', render: (a) => <span className="d-inline-flex align-items-center gap-1 text-nowrap"><Building2 size={14} className="text-muted" />{companyOf(data, a)?.name || '—'}</span> },
    { key: 'lifecycle', label: 'Lifecycle', render: (a) => <StatusBadge value={a.lifecycle} /> },
    { key: 'updatedAt', label: 'Updated', render: (a) => <span className="text-nowrap">{fmt.friendly(a.updatedAt)}</span> },
    { key: 'actions', label: '', render: (a) => <RowActions compact label={a.name} editTo={`/applications/${a.id}/edit`} viewTo={`/applications/${a.id}`} onDelete={() => requestDelete('applications', a.id)} /> },
  ];

  return (
    <>
      <PageHeader title="Ecosystem Overview" description={`A single source of truth for your ${data.settings.general.organization} digital assets.`}
        actions={<Link to="/applications/new" className="btn btn-primary"><Plus size={18} />Add Application</Link>} />

      <div className="bh-headline-grid mb-4">
        {headline.map((h) => (
          <StatCard key={h.label} size="lg" label={h.label} value={h.value} icon={h.icon} tone={h.tone} onClick={() => navigate(h.to)}
            trend={<Trend delta={recentCount(h.rows)} label="added in last 30 days" />} />
        ))}
      </div>

      <div className="row g-4 mb-4">
        <div className="col-12">
          <SectionCard icon={Code2} title="Commit Activity" subtitle="Number of code commits per day across all repositories." badge={<GitSourceBadge source={gitData.source} />}
            actions={<SelectMenu ariaLabel="Commit period" value={period} onChange={setPeriod} options={PERIODS} />}>
            <div className="d-flex align-items-end gap-4 mb-2 flex-wrap">
              <div>
                <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{git.totals.commits}</div>
                <div className="text-muted small mt-1">Total Commits</div>
              </div>
              <div className="pb-1"><Trend delta={pctChange(git.totals.commits, previousCommits)} percent label={pctChange(git.totals.commits, previousCommits) === null ? 'no commits in previous period' : `vs. previous ${period} days`} /></div>
            </div>
            <BarChart data={bars} gradient valueLabel="commits" ariaLabel="Commits per day" maxTicks={period === 7 ? 7 : 14} height={200} maxBar={24} />
            <div className="d-flex justify-content-between align-items-center mt-2 small text-subtle">
              <span>{gitData.source.kind === 'recorded' ? `${gitData.source.synced ? 'Synced' : 'Recorded'} snapshot, not full history` : 'Illustrative — no commits recorded'}</span>
              <Link to="/progress" className="d-inline-flex align-items-center gap-1">Progress & Review <ArrowRight size={13} /></Link>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-xl-7">
          <SectionCard icon={Clock3} title="Recently Updated Applications" subtitle="Latest changes to registered applications." noBody
            actions={<Link to="/applications" className="btn btn-secondary btn-sm">View All <ArrowRight size={14} /></Link>}>
            <div className="px-3 pb-3"><Table compact columns={columns} rows={recent} onRowClick={(a) => navigate(`/applications/${a.id}`)} /></div>
          </SectionCard>
        </div>
        <div className="col-xl-5">
          <SectionCard icon={Zap} title="Quick Access" subtitle="Jump to the most used registry pages.">
            <QuickLinkGrid items={[
              { to: '/applications', label: 'Applications', icon: AppWindow },
              { to: '/repositories', label: 'Repositories', icon: GitBranch },
              { to: '/components', label: 'Components', icon: Boxes },
              { to: '/deployments', label: 'Deployments', icon: Rocket },
              { to: '/technologies', label: 'Technology Stack', icon: Cpu },
              { to: '/infrastructure', label: 'Infrastructure', icon: Server },
            ]} />
          </SectionCard>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-xl-5">
          <SectionCard icon={ShieldCheck} title="Registry Health" subtitle="Overall status of your application registry."
            actions={<Link to="/data" className="btn btn-ghost btn-sm">Details <ArrowRight size={14} /></Link>}>
            <div className="d-flex gap-3 align-items-center mb-3">
              <span className={`bh-stat-icon bh-tone-${healthy ? 'success' : 'danger'}`} style={{ width: 52, height: 52, borderRadius: '50%' }}>{healthy ? <ShieldCheck size={26} /> : <ShieldAlert size={26} />}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{healthy ? <>All systems <span style={{ color: 'var(--bh-success)' }}>nominal</span></> : `${errors.length || 1} issue${errors.length > 1 ? 's' : ''} need attention`}</div>
                <div className="text-muted small">Data stored locally · Last backup: {data.meta?.lastBackupAt ? fmt.friendly(data.meta.lastBackupAt) : 'never'}</div>
              </div>
            </div>
            <div className="d-flex flex-column gap-1 small">
              <HealthRow ok={health.persistence && health.status !== 'error'} label="Local Storage" value={health.persistence ? 'Saving changes' : 'Not saving'} />
              <HealthRow ok={errors.length === 0} label="Relationship integrity" value={errors.length ? `${errors.length} error(s)` : `${relationCount(data)} links valid`} />
              <HealthRow ok={inaccessible === 0} warn label="Repository access" value={inaccessible ? `${inaccessible} inaccessible (404)` : 'All accessible'} to={inaccessible ? '/repositories' : undefined} />
              <HealthRow ok={!!data.meta?.lastBackupAt} warn label="Backup" value={data.meta?.lastBackupAt ? fmt.date(data.meta.lastBackupAt) : 'No backup yet'} to="/data" />
            </div>
          </SectionCard>
        </div>
        <div className="col-xl-7">
          <SectionCard icon={BarChartBig} title="Registration Trend" subtitle="Applications registered per month (record creation date)."
            actions={<SelectMenu ariaLabel="Registration range" value={months} onChange={setMonths} options={MONTH_RANGES} />}>
            <BarChart data={registrations} gradient valueLabel="applications registered" ariaLabel="Applications registered per month" height={210} maxBar={64} maxTicks={12} />
          </SectionCard>
        </div>
      </div>
      {deleteDialog}
    </>
  );
}

function HealthRow({ ok, warn, label, value, to }) {
  const color = ok ? 'var(--bh-success)' : warn ? 'var(--bh-warning)' : 'var(--bh-danger)';
  return (
    <div className="d-flex justify-content-between align-items-center py-1" style={{ borderTop: '1px dashed var(--bh-border)' }}>
      <span className="d-inline-flex align-items-center gap-2"><span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />{label}</span>
      {to ? <Link to={to} className="fw-semibold">{value}</Link> : <span className="fw-semibold">{value}</span>}
    </div>
  );
}
