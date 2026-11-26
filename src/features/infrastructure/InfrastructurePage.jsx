import { useMemo, useState } from 'react';
import { Layers, MapPin, AppWindow } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Plus, Server, Cpu, Database, HardDrive, Network, ShieldCheck } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import FilterDropdown from '../../components/tables/FilterDropdown';
import DataView from '../../components/data/DataView';
import IdChip from '../../components/common/IdChip';
import Avatar from '../../components/common/Avatar';
import RowActions from '../../components/tables/RowActions';
import StatusBadge from '../../components/badges/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import HBarList from '../../components/charts/HBarList';
import { useRegistry } from '../../hooks/useRegistry';
import { useFilters } from '../../hooks/useFilters';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { infrastructureUsage, matchesSearch } from '../../services/query.service';
import { INFRASTRUCTURE_STATUSES } from '../../services/schema';
import { applicationOptions } from '../../utils/options';
import { resolveLogo } from '../../assets/logos';
import InfrastructureFormModal from './InfrastructureFormModal';

const GROUPS = {
  compute: { label: 'Compute', categories: ['Compute', 'Hosting'], icon: Cpu, tone: 'info', hint: 'Compute & hosting' },
  database: { label: 'Database', categories: ['Database'], icon: Database, tone: 'success' },
  storage: { label: 'Storage', categories: ['Storage'], icon: HardDrive, tone: 'warning' },
  network: { label: 'Network', categories: ['Network', 'CDN'], icon: Network, tone: 'navy', hint: 'Network & CDN' },
  security: { label: 'Security', categories: ['Security'], icon: ShieldCheck, tone: 'danger' },
};

export default function InfrastructurePage() {
  const { data } = useRegistry();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const [modal, setModal] = useState(null);
  const f = useFilters({ provider: '', category: '', resourceType: '', application: '', status: '', group: '' });
  const usage = useMemo(() => Object.fromEntries(data.infrastructure.map((i) => [i.id, infrastructureUsage(data, i.id)])), [data]);
  const providers = [...new Set(data.infrastructure.map((i) => i.provider))].sort();
  const types = [...new Set(data.infrastructure.map((i) => i.resourceType).filter(Boolean))].sort();
  const rows = data.infrastructure.filter((i) => matchesSearch(i, f.search, ['id', 'name', 'provider', 'resourceType', 'region', 'description'])
    && (!f.filters.provider || i.provider === f.filters.provider)
    && (!f.filters.category || i.category === f.filters.category)
    && (!f.filters.resourceType || i.resourceType === f.filters.resourceType)
    && (!f.filters.status || i.status === f.filters.status)
    && (!f.filters.application || usage[i.id].applications.some((a) => a.record.id === f.filters.application))
    && (!f.filters.group || GROUPS[f.filters.group].categories.includes(i.category)));
  const summary = [
    { key: 'total', label: 'Total Infrastructure', value: data.infrastructure.length, icon: Server, tone: 'orange' },
    ...Object.entries(GROUPS).map(([k, g]) => ({ key: k, label: g.label, hint: g.hint, icon: g.icon, tone: g.tone, value: data.infrastructure.filter((i) => g.categories.includes(i.category)).length, onClick: () => f.setFilter('group', f.filters.group === k ? '' : k), active: f.filters.group === k })),
  ];
  const byProvider = providers.map((p) => ({ label: p, value: data.infrastructure.filter((i) => i.provider === p).length })).sort((a, b) => b.value - a.value);
  const usedBy = (i) => usage[i.id].components.length + usage[i.id].deployments.length + usage[i.id].apis.length;
  const columns = [
    { key: 'id', label: 'Infrastructure ID', render: (i) => <IdChip id={i.id} /> },
    { key: 'name', label: 'Infrastructure Name', render: (i) => <div className="d-flex align-items-center gap-2"><Avatar name={i.name} seed={i.id} src={i.logoUrl || resolveLogo(i.provider)} size={32} /><Link to={`/infrastructure/${i.id}`} className="cell-strong">{i.name}</Link></div> },
    { key: 'provider', label: 'Provider' },
    { key: 'category', label: 'Category' },
    { key: 'resourceType', label: 'Resource Type', render: (i) => i.resourceType || '—' },
    { key: 'region', label: 'Region', render: (i) => i.region || '—' },
    { key: 'dashboardUrl', label: 'Dashboard URL', render: (i) => (i.dashboardUrl ? <a href={i.dashboardUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open</a> : <span className="text-subtle">—</span>) },
    { key: 'usedBy', label: 'Used By', sortValue: usedBy, render: (i) => (usedBy(i) ? `${usage[i.id].applications.length} app(s) · ${usedBy(i)} link(s)` : <span className="text-subtle">Not used</span>) },
    { key: 'status', label: 'Status', render: (i) => <StatusBadge value={i.status} /> },
    { key: 'actions', label: '', sortable: false, render: (i) => <RowActions label={i.name} viewTo={`/infrastructure/${i.id}`} onEdit={() => setModal(i)} onDelete={() => requestDelete('infrastructure', i.id)} /> },
  ];
  const card = (i) => ({
    title: i.name, id: i.id, to: `/infrastructure/${i.id}`, avatarSrc: i.logoUrl || resolveLogo(i.provider), subtitle: i.provider, description: i.description, status: <StatusBadge value={i.status} />,
    meta: [{ icon: Layers, text: `${i.category} · ${i.resourceType}` }, { icon: MapPin, text: i.region }, { icon: AppWindow, text: `${usage[i.id].applications.length} apps` }],
    actions: { viewTo: `/infrastructure/${i.id}`, onEdit: () => setModal(i), onDelete: () => requestDelete('infrastructure', i.id) },
  });
  return (
    <>
      <PageHeader title="Infrastructure" description="The Infrastructure Master Catalog: registered resources at each provider. No live utilization or health data is shown."
        actions={<button type="button" className="btn btn-primary" onClick={() => setModal('new')}><Plus size={16} />Add Infrastructure</button>} />
      <SummaryCards items={summary} min={160} />
      <div className="row g-4">
        <div className="col-xl-9">
          <DataView viewKey="infrastructure" noun="resources" columns={columns} rows={rows} card={card} initialSort={{ key: 'id', dir: 'asc' }} onRowClick={(i) => navigate(`/infrastructure/${i.id}`)}
              empty={data.infrastructure.length === 0 ? <EmptyState icon={Server} title="No infrastructure registered" /> : undefined}
            search={f.search} onSearch={f.setSearch} searchPlaceholder="Search resource, provider, region…" filtersActive={f.active} onClearFilters={f.clear}
            filters={(
              <>
              <FilterDropdown label="Providers" value={f.filters.provider} onChange={(v) => f.setFilter('provider', v)} options={providers} format={(x) => x} />
              <FilterDropdown label="Categories" value={f.filters.category} onChange={(v) => f.setFilter('category', v)} options={data.categories.infrastructureCategories} format={(x) => x} />
              <FilterDropdown label="Resource types" value={f.filters.resourceType} onChange={(v) => f.setFilter('resourceType', v)} options={types} format={(x) => x} />
              <FilterDropdown label="Applications" value={f.filters.application} onChange={(v) => f.setFilter('application', v)} options={applicationOptions(data)} />
              <FilterDropdown label="Statuses" value={f.filters.status} onChange={(v) => f.setFilter('status', v)} options={INFRASTRUCTURE_STATUSES} />
              </>
            )} />
        </div>
        <div className="col-xl-3">
          <div className="bh-card">
            <div className="bh-card-header"><div><h3 className="bh-card-title">Resources by provider</h3><p className="bh-card-sub">One provider can host many resources</p></div></div>
            <div className="bh-card-body"><HBarList data={byProvider} color="var(--bh-navy)" /></div>
          </div>
        </div>
      </div>
      {modal && <InfrastructureFormModal resource={modal === 'new' ? null : modal} onClose={() => setModal(null)} onCreated={(id) => navigate(`/infrastructure/${id}`)} />}
      {deleteDialog}
    </>
  );
}
