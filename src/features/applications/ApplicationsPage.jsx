import { useMemo } from 'react';
import { Building2, Layers, CalendarClock } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Plus, AppWindow, Lightbulb, Code2, FlaskConical, CheckCircle2, Wrench, Archive } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import FilterDropdown from '../../components/tables/FilterDropdown';
import DataView from '../../components/data/DataView';
import IdChip from '../../components/common/IdChip';
import Avatar from '../../components/common/Avatar';
import RowActions from '../../components/tables/RowActions';
import StatusBadge from '../../components/badges/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { useRegistry } from '../../hooks/useRegistry';
import { useFilters } from '../../hooks/useFilters';
import { useFormat } from '../../hooks/useFormat';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { byId, matchesSearch } from '../../services/query.service';
import { LIFECYCLES } from '../../services/schema';
import { companyOptions } from '../../utils/options';

const LIFECYCLE_ICONS = { planning: [Lightbulb, 'navy'], development: [Code2, 'info'], testing: [FlaskConical, 'warning'], active: [CheckCircle2, 'success'], maintenance: [Wrench, 'orange'], archived: [Archive, 'gray'] };

export default function ApplicationsPage() {
  const { data } = useRegistry();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const f = useFilters({ company: '', category: '', type: '', lifecycle: '' });

  const rows = useMemo(() => data.applications.filter((a) => matchesSearch(a, f.search)
    && (!f.filters.company || a.ownerId === f.filters.company)
    && (!f.filters.category || a.category === f.filters.category)
    && (!f.filters.type || a.type === f.filters.type)
    && (!f.filters.lifecycle || a.lifecycle === f.filters.lifecycle)), [data.applications, f.search, f.filters]);

  const count = (l) => data.applications.filter((a) => a.lifecycle === l).length;
  const summary = [
    { key: 'total', label: 'Total Applications', value: data.applications.length, icon: AppWindow, tone: 'orange', onClick: () => f.setFilter('lifecycle', ''), active: !f.filters.lifecycle && f.active === false },
    ...LIFECYCLES.map((l) => ({
      key: l, label: l[0].toUpperCase() + l.slice(1), value: count(l), icon: LIFECYCLE_ICONS[l][0], tone: LIFECYCLE_ICONS[l][1],
      onClick: () => f.setFilter('lifecycle', f.filters.lifecycle === l ? '' : l), active: f.filters.lifecycle === l,
    })),
  ];

  const columns = [
    { key: 'id', label: 'Application ID', render: (a) => <IdChip id={a.id} />, width: 120 },
    { key: 'name', label: 'Application Name', render: (a) => <div className="d-flex align-items-center gap-2"><Avatar name={a.name} seed={a.id} size={34} /><div><Link to={`/applications/${a.id}`} className="cell-strong">{a.name}</Link><div className="text-subtle" style={{ fontSize: 12 }}>{a.code}</div></div></div> },
    { key: 'company', label: 'Company', sortValue: (a) => byId(data, 'companies', a.ownerId)?.name, render: (a) => (byId(data, 'companies', a.ownerId) ? <span className="d-inline-flex align-items-center gap-1"><Building2 size={14} className="text-muted" />{byId(data, 'companies', a.ownerId).name}</span> : <span className="text-danger">Missing</span>) },
    { key: 'category', label: 'Category' },
    { key: 'type', label: 'Type' },
    { key: 'lifecycle', label: 'Lifecycle', sortValue: (a) => LIFECYCLES.indexOf(a.lifecycle), render: (a) => <StatusBadge value={a.lifecycle} /> },
    { key: 'updatedAt', label: 'Updated', render: (a) => <span style={{ whiteSpace: 'nowrap' }}>{fmt.friendly(a.updatedAt)}</span> },
    { key: 'actions', label: '', sortable: false, align: 'right', render: (a) => <RowActions label={a.name} viewTo={`/applications/${a.id}`} editTo={`/applications/${a.id}/edit`} onDelete={() => requestDelete('applications', a.id)} /> },
  ];

  const card = (a) => ({
    title: a.name, id: a.id, to: `/applications/${a.id}`, subtitle: a.code, description: a.description, tags: a.tags,
    status: <StatusBadge value={a.lifecycle} />,
    meta: [{ icon: Building2, text: byId(data, 'companies', a.ownerId)?.name }, { icon: Layers, text: a.type }, { icon: CalendarClock, text: `Updated ${fmt.friendly(a.updatedAt)}` }],
    actions: { viewTo: `/applications/${a.id}`, editTo: `/applications/${a.id}/edit`, onDelete: () => requestDelete('applications', a.id) },
  });
  return (
    <>
      <PageHeader title="Applications" description="Every application operated within VSG Group, its owning company and lifecycle."
        actions={<Link to="/applications/new" className="btn btn-primary"><Plus size={16} />Add Application</Link>} />
      <SummaryCards items={summary} min={150} />
      <DataView viewKey="applications" noun="applications" columns={columns} rows={rows} card={card} initialSort={{ key: 'id', dir: 'asc' }} onRowClick={(a) => navigate(`/applications/${a.id}`)}
          empty={data.applications.length === 0 ? <EmptyState icon={AppWindow} title="No applications registered" message="Register the first application to start building the registry." action={<Link to="/applications/new" className="btn btn-primary"><Plus size={16} />Add Application</Link>} /> : undefined}
        search={f.search} onSearch={f.setSearch} searchPlaceholder="Search name, ID, code, tags…" filtersActive={f.active} onClearFilters={f.clear}
        filters={(
          <>
          <FilterDropdown label="Companies" value={f.filters.company} onChange={(v) => f.setFilter('company', v)} options={companyOptions(data)} />
          <FilterDropdown label="Categories" value={f.filters.category} onChange={(v) => f.setFilter('category', v)} options={data.categories.applicationCategories} format={(x) => x} />
          <FilterDropdown label="Types" value={f.filters.type} onChange={(v) => f.setFilter('type', v)} options={data.categories.applicationTypes} format={(x) => x} />
          <FilterDropdown label="Lifecycles" value={f.filters.lifecycle} onChange={(v) => f.setFilter('lifecycle', v)} options={LIFECYCLES} />
          </>
        )} />
      {deleteDialog}
    </>
  );
}
