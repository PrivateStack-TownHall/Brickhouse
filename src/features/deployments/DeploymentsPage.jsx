import { useMemo, useState } from 'react';
import { Server, Tag, CalendarClock } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Plus, Rocket, Globe2, FlaskConical, Code2, CheckCircle2, XCircle, PauseCircle } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import DetailTabs from '../../components/common/DetailTabs';
import FilterDropdown from '../../components/tables/FilterDropdown';
import DataView from '../../components/data/DataView';
import IdChip from '../../components/common/IdChip';
import Avatar from '../../components/common/Avatar';
import RowActions from '../../components/tables/RowActions';
import StatusBadge from '../../components/badges/StatusBadge';
import EntityLink from '../../components/common/EntityLink';
import EmptyState from '../../components/common/EmptyState';
import { useRegistry } from '../../hooks/useRegistry';
import { useFilters } from '../../hooks/useFilters';
import { useFormat } from '../../hooks/useFormat';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { byId, matchesSearch, applicationOfDeployment } from '../../services/query.service';
import { DEPLOYMENT_STATUSES } from '../../services/schema';
import { applicationOptions } from '../../utils/options';

export default function DeploymentsPage() {
  const { data } = useRegistry();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const [env, setEnv] = useState('all');
  const f = useFilters({ status: '', application: '', platform: '' });
  const appOf = useMemo(() => Object.fromEntries(data.deployments.map((d) => [d.id, applicationOfDeployment(data, d)])), [data]);
  const platforms = [...new Set(data.deployments.map((d) => d.platform).filter(Boolean))].sort();

  const rows = data.deployments.filter((d) => (env === 'all' || d.environment === env)
    && matchesSearch(d, f.search, ['id', 'name', 'code', 'notes', 'branch', 'version', 'platform', 'deploymentUrl'])
    && (!f.filters.status || d.status === f.filters.status)
    && (!f.filters.application || appOf[d.id]?.id === f.filters.application)
    && (!f.filters.platform || d.platform === f.filters.platform));
  const n = (pred) => data.deployments.filter(pred).length;
  const summary = [
    { label: 'Total Deployments', value: data.deployments.length, icon: Rocket, tone: 'orange', onClick: () => { setEnv('all'); f.setFilter('status', ''); } },
    { label: 'Production', value: n((d) => d.environment === 'production'), icon: Globe2, tone: 'success', onClick: () => setEnv('production'), active: env === 'production' },
    { label: 'Staging', value: n((d) => d.environment === 'staging'), icon: FlaskConical, tone: 'warning', onClick: () => setEnv('staging'), active: env === 'staging' },
    { label: 'Development', value: n((d) => d.environment === 'development'), icon: Code2, tone: 'info', onClick: () => setEnv('development'), active: env === 'development' },
    { label: 'Active', value: n((d) => d.status === 'active'), icon: CheckCircle2, tone: 'success', onClick: () => f.setFilter('status', f.filters.status === 'active' ? '' : 'active'), active: f.filters.status === 'active' },
    { label: 'Failed', value: n((d) => d.status === 'failed'), icon: XCircle, tone: 'danger', onClick: () => f.setFilter('status', f.filters.status === 'failed' ? '' : 'failed'), active: f.filters.status === 'failed' },
    { label: 'Inactive', value: n((d) => d.status === 'inactive'), icon: PauseCircle, tone: 'gray', onClick: () => f.setFilter('status', f.filters.status === 'inactive' ? '' : 'inactive'), active: f.filters.status === 'inactive' },
  ];
  const tabs = ['all', 'production', 'staging', 'development', 'preview'].map((k) => ({ key: k, label: k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1), count: k === 'all' ? data.deployments.length : n((d) => d.environment === k) }));
  const columns = [
    { key: 'id', label: 'Deployment ID', render: (d) => <IdChip id={d.id} /> },
    { key: 'name', label: 'Deployment Name', render: (d) => <div className="d-flex align-items-center gap-2"><Avatar name={d.name} seed={d.id} size={32} /><div className="min-w-0"><Link to={`/deployments/${d.id}`} className="cell-strong">{d.name}</Link><div className="text-subtle mono" style={{ fontSize: 11.5 }}>{d.branch} · {d.version}</div></div></div> },
    { key: 'component', label: 'Component', sortValue: (d) => byId(data, 'components', d.componentId)?.name, render: (d) => <EntityLink entity="components" record={byId(data, 'components', d.componentId)} /> },
    { key: 'application', label: 'Application', sortValue: (d) => appOf[d.id]?.name, render: (d) => <EntityLink entity="applications" record={appOf[d.id]} /> },
    { key: 'environment', label: 'Environment', render: (d) => <StatusBadge value={d.environment} dot={false} /> },
    { key: 'platform', label: 'Provider' },
    { key: 'deploymentUrl', label: 'Deployment URL', render: (d) => (d.deploymentUrl ? <a href={d.deploymentUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-truncate d-inline-block" style={{ maxWidth: 170 }}>{d.deploymentUrl.replace(/^https?:\/\//, '')}</a> : <span className="text-subtle">—</span>) },
    { key: 'status', label: 'Status', render: (d) => <StatusBadge value={d.status} /> },
    { key: 'updatedAt', label: 'Last Updated', sortValue: (d) => d.lastDeployedAt || d.updatedAt, render: (d) => fmt.date(d.lastDeployedAt || d.updatedAt) },
    { key: 'actions', label: '', sortable: false, render: (d) => <RowActions label={d.name} viewTo={`/deployments/${d.id}`} editTo={`/deployments/${d.id}/edit`} onDelete={() => requestDelete('deployments', d.id)} /> },
  ];
  const card = (d) => ({
    title: d.name, id: d.id, to: `/deployments/${d.id}`, subtitle: byId(data, 'components', d.componentId)?.name || appOf[d.id]?.name, description: d.notes,
    status: <StatusBadge value={d.status} />,
    meta: [{ icon: Globe2, text: d.environment }, { icon: Server, text: d.platform }, { icon: Tag, text: d.version }, { icon: CalendarClock, text: fmt.friendly(d.lastDeployedAt || d.updatedAt) }],
    actions: { viewTo: `/deployments/${d.id}`, editTo: `/deployments/${d.id}/edit`, onDelete: () => requestDelete('deployments', d.id) },
  });
  return (
    <>
      <PageHeader title="Deployments" description="Manually maintained records of where components run. BRICKHOUSE does not monitor deployments live."
        actions={<Link to="/deployments/new" className="btn btn-primary"><Plus size={16} />Add Deployment</Link>} />
      <SummaryCards items={summary} min={145} />
      <DetailTabs tabs={tabs} active={env} onChange={setEnv} />
      <DataView viewKey="deployments" noun="deployments" columns={columns} rows={rows} card={card} initialSort={{ key: 'id', dir: 'asc' }} onRowClick={(d) => navigate(`/deployments/${d.id}`)}
          empty={data.deployments.length === 0 ? <EmptyState icon={Rocket} title="No deployments recorded" action={<Link to="/deployments/new" className="btn btn-primary"><Plus size={16} />Add Deployment</Link>} /> : undefined}
        search={f.search} onSearch={f.setSearch} searchPlaceholder="Search name, ID, branch, version…" filtersActive={f.active} onClearFilters={f.clear}
        filters={(
          <>
          <FilterDropdown label="Statuses" value={f.filters.status} onChange={(v) => f.setFilter('status', v)} options={DEPLOYMENT_STATUSES} />
          <FilterDropdown label="Applications" value={f.filters.application} onChange={(v) => f.setFilter('application', v)} options={applicationOptions(data)} />
          <FilterDropdown label="Providers" value={f.filters.platform} onChange={(v) => f.setFilter('platform', v)} options={platforms} format={(x) => x} />
          </>
        )} />
      {deleteDialog}
    </>
  );
}
