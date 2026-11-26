import { useMemo } from 'react';
import { AppWindow, Route } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Plus, Plug, Webhook, Network, Workflow, Building, Globe } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import FilterDropdown from '../../components/tables/FilterDropdown';
import DataView from '../../components/data/DataView';
import IdChip from '../../components/common/IdChip';
import RecordIdentity from '../../components/common/RecordIdentity';
import RowActions from '../../components/tables/RowActions';
import StatusBadge from '../../components/badges/StatusBadge';
import EntityLink from '../../components/common/EntityLink';
import EmptyState from '../../components/common/EmptyState';
import { useRegistry } from '../../hooks/useRegistry';
import { useFilters } from '../../hooks/useFilters';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { providerOfApi, consumersOfApi, matchesSearch } from '../../services/query.service';
import { LIFECYCLES } from '../../services/schema';
import { applicationOptions, companyOptions } from '../../utils/options';

export default function ApisPage() {
  const { data } = useRegistry();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const f = useFilters({ company: '', application: '', serviceType: '', protocol: '', authentication: '', status: '', exposure: '' });
  const rel = useMemo(() => Object.fromEntries(data.apis.map((a) => [a.id, { provider: providerOfApi(data, a.id), consumers: consumersOfApi(data, a.id).map((x) => x.record) }])), [data]);
  const rows = data.apis.filter((a) => matchesSearch(a, f.search, ['id', 'name', 'code', 'description', 'tags', 'baseUrl'])
    && (!f.filters.company || rel[a.id].provider?.ownerId === f.filters.company || rel[a.id].consumers.some((c) => c.ownerId === f.filters.company))
    && (!f.filters.application || rel[a.id].provider?.id === f.filters.application || rel[a.id].consumers.some((c) => c.id === f.filters.application))
    && (!f.filters.serviceType || a.serviceType === f.filters.serviceType)
    && (!f.filters.protocol || a.protocol === f.filters.protocol)
    && (!f.filters.authentication || a.authentication === f.filters.authentication)
    && (!f.filters.status || a.lifecycle === f.filters.status)
    && (!f.filters.exposure || a.exposure === f.filters.exposure));
  const n = (pred) => data.apis.filter(pred).length;
  const tog = (k, v) => f.setFilter(k, f.filters[k] === v ? '' : v);
  const summary = [
    { label: 'Total Services', value: data.apis.length, icon: Plug, tone: 'orange' },
    { label: 'API Services', value: n((a) => a.serviceType === 'API Service'), icon: Webhook, tone: 'info', onClick: () => tog('serviceType', 'API Service'), active: f.filters.serviceType === 'API Service' },
    { label: 'Microservices', value: n((a) => a.serviceType === 'Microservice'), icon: Network, tone: 'success', onClick: () => tog('serviceType', 'Microservice'), active: f.filters.serviceType === 'Microservice' },
    { label: 'Integrations', value: n((a) => a.serviceType === 'Integration'), icon: Workflow, tone: 'warning', onClick: () => tog('serviceType', 'Integration'), active: f.filters.serviceType === 'Integration' },
    { label: 'Internal Services', value: n((a) => a.exposure !== 'external'), icon: Building, tone: 'navy', onClick: () => tog('exposure', 'internal'), active: f.filters.exposure === 'internal' },
    { label: 'External Services', value: n((a) => a.exposure === 'external'), icon: Globe, tone: 'gray', onClick: () => tog('exposure', 'external'), active: f.filters.exposure === 'external' },
  ];
  const columns = [
    { key: 'id', label: 'API ID', render: (a) => <IdChip id={a.id} /> },
    { key: 'name', label: 'API / Service Name', render: (a) => <RecordIdentity name={a.name} seed={a.id} to={`/apis/${a.id}`} subtitle={`${rel[a.id].consumers.length} consumer(s) · ${data.endpoints.filter((e) => e.apiId === a.id).length} endpoint(s)`} /> },
    { key: 'provider', label: 'Provider Application', sortValue: (a) => rel[a.id].provider?.name, render: (a) => (rel[a.id].provider ? <EntityLink entity="applications" record={rel[a.id].provider} /> : <span className="text-subtle">{a.exposure === 'external' ? 'External' : '—'}</span>) },
    { key: 'serviceType', label: 'Service Type' },
    { key: 'protocol', label: 'Protocol', render: (a) => <span className="bh-chip">{a.protocol}</span> },
    { key: 'baseUrl', label: 'Base URL', render: (a) => (a.baseUrl ? <span className="mono text-truncate d-inline-block" style={{ maxWidth: 180 }}>{a.baseUrl}</span> : <span className="text-subtle">—</span>) },
    { key: 'version', label: 'Version' },
    { key: 'authentication', label: 'Authentication' },
    { key: 'lifecycle', label: 'Status', render: (a) => <StatusBadge value={a.lifecycle} /> },
    { key: 'actions', label: '', sortable: false, render: (a) => <RowActions label={a.name} viewTo={`/apis/${a.id}`} editTo={`/apis/${a.id}/edit`} onDelete={() => requestDelete('apis', a.id)} /> },
  ];
  const cat = data.categories;
  const card = (a) => ({
    title: a.name, id: a.id, to: `/apis/${a.id}`, subtitle: a.code, description: a.description, tags: a.tags || [],
    status: <StatusBadge value={a.lifecycle} />,
    meta: [{ icon: Workflow, text: `${a.protocol} · ${a.authentication}` }, { icon: AppWindow, text: rel[a.id].provider?.name || (a.exposure === 'external' ? 'External' : '') }, { icon: Route, text: `${data.endpoints.filter((e) => e.apiId === a.id).length} endpoints` }],
    actions: { viewTo: `/apis/${a.id}`, editTo: `/apis/${a.id}/edit`, onDelete: () => requestDelete('apis', a.id) },
  });
  return (
    <>
      <PageHeader title="APIs & Services" description="Which applications provide and consume each API, integration and service."
        actions={<Link to="/apis/new" className="btn btn-primary"><Plus size={16} />Add API & Service</Link>} />
      <SummaryCards items={summary} min={160} />
      <DataView viewKey="apis" noun="APIs & services" columns={columns} rows={rows} card={card} initialSort={{ key: 'id', dir: 'asc' }} onRowClick={(a) => navigate(`/apis/${a.id}`)}
          empty={data.apis.length === 0 ? <EmptyState icon={Plug} title="No APIs or services registered" action={<Link to="/apis/new" className="btn btn-primary"><Plus size={16} />Add API & Service</Link>} /> : undefined}
        search={f.search} onSearch={f.setSearch} searchPlaceholder="Search name, ID, base URL, tags…" filtersActive={f.active} onClearFilters={f.clear}
        filters={(
          <>
          <FilterDropdown label="Companies" value={f.filters.company} onChange={(v) => f.setFilter('company', v)} options={companyOptions(data)} />
          <FilterDropdown label="Applications" value={f.filters.application} onChange={(v) => f.setFilter('application', v)} options={applicationOptions(data)} />
          <FilterDropdown label="Service types" value={f.filters.serviceType} onChange={(v) => f.setFilter('serviceType', v)} options={cat.serviceTypes} format={(x) => x} />
          <FilterDropdown label="Protocols" value={f.filters.protocol} onChange={(v) => f.setFilter('protocol', v)} options={cat.protocols} format={(x) => x} />
          <FilterDropdown label="Authentication" value={f.filters.authentication} onChange={(v) => f.setFilter('authentication', v)} options={cat.authenticationMethods} format={(x) => x} />
          <FilterDropdown label="Statuses" value={f.filters.status} onChange={(v) => f.setFilter('status', v)} options={LIFECYCLES} />
          </>
        )} />
      {deleteDialog}
    </>
  );
}
