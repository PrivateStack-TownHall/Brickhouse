import { useMemo } from 'react';
import { Layers, GitBranch, Tag } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Plus, Boxes, Monitor, ServerCog, Plug, Library, Palette, Shapes } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
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
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { byId, linked, matchesSearch } from '../../services/query.service';
import { LIFECYCLES } from '../../services/schema';
import { applicationOptions, companyOptions, technologyOptions } from '../../utils/options';

// Summary buckets: layer-based (Frontend/Backend) and type-based (Service/Library/UI).
const isOther = (c) => !['Frontend', 'Backend'].includes(c.layer) && !['Service', 'Library', 'UI'].includes(c.type);

export default function ComponentsPage() {
  const { data } = useRegistry();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const f = useFilters({ application: '', company: '', type: '', layer: '', status: '', technology: '', bucket: '' });
  const rel = useMemo(() => Object.fromEntries(data.components.map((c) => [c.id, {
    repos: linked(data, 'componentRepositories', 'from', c.id).map((x) => x.record),
    techs: linked(data, 'componentTechnologies', 'from', c.id).map((x) => x.record),
    app: byId(data, 'applications', c.applicationId),
  }])), [data]);

  const bucket = {
    frontend: (c) => c.layer === 'Frontend', backend: (c) => c.layer === 'Backend', service: (c) => c.type === 'Service',
    library: (c) => c.type === 'Library', ui: (c) => c.type === 'UI', other: isOther,
  };
  const rows = data.components.filter((c) => matchesSearch(c, f.search, ['id', 'name', 'code', 'description', 'capabilities'])
    && (!f.filters.application || c.applicationId === f.filters.application)
    && (!f.filters.company || rel[c.id].app?.ownerId === f.filters.company)
    && (!f.filters.type || c.type === f.filters.type)
    && (!f.filters.layer || c.layer === f.filters.layer)
    && (!f.filters.status || c.lifecycle === f.filters.status)
    && (!f.filters.technology || rel[c.id].techs.some((t) => t.id === f.filters.technology))
    && (!f.filters.bucket || bucket[f.filters.bucket](c)));
  const bucketCard = (key, label, icon, tone) => ({ key, label, icon, tone, value: data.components.filter(bucket[key]).length, onClick: () => f.setFilter('bucket', f.filters.bucket === key ? '' : key), active: f.filters.bucket === key });
  const summary = [
    { key: 'total', label: 'Total Components', value: data.components.length, icon: Boxes, tone: 'orange' },
    bucketCard('frontend', 'Frontend', Monitor, 'info'), bucketCard('backend', 'Backend', ServerCog, 'navy'), bucketCard('service', 'API / Service', Plug, 'success'),
    bucketCard('library', 'Library', Library, 'warning'), bucketCard('ui', 'UI', Palette, 'danger'), bucketCard('other', 'Other', Shapes, 'gray'),
  ];
  const columns = [
    { key: 'id', label: 'Component ID', render: (c) => <IdChip id={c.id} /> },
    { key: 'name', label: 'Component Name', render: (c) => <div className="d-flex align-items-center gap-2"><Avatar name={c.name} seed={c.id} size={32} /><div className="min-w-0"><Link to={`/components/${c.id}`} className="cell-strong">{c.name}</Link><div className="text-subtle mono" style={{ fontSize: 11.5 }}>{c.code} · v{c.version}</div></div></div> },
    { key: 'application', label: 'Application', sortValue: (c) => rel[c.id].app?.name, render: (c) => <EntityLink entity="applications" record={rel[c.id].app} /> },
    { key: 'type', label: 'Type' },
    { key: 'layer', label: 'Layer' },
    { key: 'repository', label: 'Repository', sortValue: (c) => rel[c.id].repos[0]?.name, render: (c) => rel[c.id].repos.map((r) => r.name).join(', ') || <span className="text-subtle">—</span> },
    { key: 'technologies', label: 'Technologies', sortable: false, render: (c) => <div className="d-flex flex-wrap gap-1" style={{ maxWidth: 240 }}>{rel[c.id].techs.slice(0, 3).map((t) => <span key={t.id} className="bh-chip">{t.name}</span>)}{rel[c.id].techs.length > 3 && <span className="bh-chip">+{rel[c.id].techs.length - 3}</span>}</div> },
    { key: 'lifecycle', label: 'Status', sortValue: (c) => LIFECYCLES.indexOf(c.lifecycle), render: (c) => <StatusBadge value={c.lifecycle} /> },
    { key: 'actions', label: '', sortable: false, render: (c) => <RowActions label={c.name} viewTo={`/components/${c.id}`} editTo={`/components/${c.id}/edit`} onDelete={() => requestDelete('components', c.id)} /> },
  ];
  const card = (c) => ({
    title: c.name, id: c.id, to: `/components/${c.id}`, subtitle: rel[c.id].app?.name, description: c.description,
    tags: rel[c.id].techs.map((t) => t.name), status: <StatusBadge value={c.lifecycle} />,
    meta: [{ icon: Layers, text: `${c.layer} · ${c.type}` }, { icon: GitBranch, text: rel[c.id].repos.map((r) => r.name).join(', ') }, { icon: Tag, text: c.version && `v${c.version}` }],
    actions: { viewTo: `/components/${c.id}`, editTo: `/components/${c.id}/edit`, onDelete: () => requestDelete('components', c.id) },
  });
  return (
    <>
      <PageHeader title="Components" description="Modules, services, libraries and UI that make up each application."
        actions={<Link to="/components/new" className="btn btn-primary"><Plus size={16} />Add Component</Link>} />
      <SummaryCards items={summary} min={150} />
      <DataView viewKey="components" noun="components" columns={columns} rows={rows} card={card} initialSort={{ key: 'id', dir: 'asc' }} onRowClick={(c) => navigate(`/components/${c.id}`)}
          empty={data.components.length === 0 ? <EmptyState icon={Boxes} title="No components registered" action={<Link to="/components/new" className="btn btn-primary"><Plus size={16} />Add Component</Link>} /> : undefined}
        search={f.search} onSearch={f.setSearch} searchPlaceholder="Search name, ID, code, capabilities…" filtersActive={f.active} onClearFilters={f.clear}
        filters={(
          <>
          <FilterDropdown label="Applications" value={f.filters.application} onChange={(v) => f.setFilter('application', v)} options={applicationOptions(data)} />
          <FilterDropdown label="Companies" value={f.filters.company} onChange={(v) => f.setFilter('company', v)} options={companyOptions(data)} />
          <FilterDropdown label="Types" value={f.filters.type} onChange={(v) => f.setFilter('type', v)} options={data.categories.componentTypes} format={(x) => x} />
          <FilterDropdown label="Layers" value={f.filters.layer} onChange={(v) => f.setFilter('layer', v)} options={data.categories.componentLayers} format={(x) => x} />
          <FilterDropdown label="Statuses" value={f.filters.status} onChange={(v) => f.setFilter('status', v)} options={LIFECYCLES} />
          <FilterDropdown label="Technologies" value={f.filters.technology} onChange={(v) => f.setFilter('technology', v)} options={technologyOptions(data)} />
          </>
        )} />
      {deleteDialog}
    </>
  );
}
