import { useMemo, useState } from 'react';
import { Globe, AppWindow } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Plus, Cpu, Layers, Library, Wrench, Terminal, Database } from 'lucide-react';
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
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { technologyUsage, matchesSearch } from '../../services/query.service';
import { TECHNOLOGY_STATUSES } from '../../services/schema';
import { applicationOptions, componentOptions } from '../../utils/options';
import TechnologyFormModal from './TechnologyFormModal';

export const TECH_GROUPS = {
  frameworks: { label: 'Frameworks', categories: ['Frontend Framework', 'Backend Framework'] },
  libraries: { label: 'Libraries', categories: ['Library', 'ORM', 'Styling'] },
  tools: { label: 'Tools', categories: ['DevOps', 'Testing'] },
  platforms: { label: 'Platforms', categories: ['Programming Language', 'Other'] },
  databases: { label: 'Databases', categories: ['Database'] },
};

export default function TechnologiesPage() {
  const { data } = useRegistry();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const [modal, setModal] = useState(null);
  const f = useFilters({ category: '', status: '', application: '', component: '', group: '' });
  const usage = useMemo(() => Object.fromEntries(data.technologies.map((t) => [t.id, technologyUsage(data, t.id)])), [data]);
  const rows = data.technologies.filter((t) => matchesSearch(t, f.search, ['id', 'name', 'category', 'description'])
    && (!f.filters.category || t.category === f.filters.category)
    && (!f.filters.status || t.status === f.filters.status)
    && (!f.filters.application || usage[t.id].applications.some((a) => a.record.id === f.filters.application))
    && (!f.filters.component || usage[t.id].components.some((c) => c.record.id === f.filters.component))
    && (!f.filters.group || TECH_GROUPS[f.filters.group].categories.includes(t.category)));
  const icons = { frameworks: [Layers, 'info'], libraries: [Library, 'success'], tools: [Wrench, 'warning'], platforms: [Terminal, 'navy'], databases: [Database, 'danger'] };
  const summary = [
    { key: 'total', label: 'Total Technologies', value: data.technologies.length, icon: Cpu, tone: 'orange' },
    ...Object.entries(TECH_GROUPS).map(([k, g]) => ({
      key: k, label: g.label, icon: icons[k][0], tone: icons[k][1], value: data.technologies.filter((t) => g.categories.includes(t.category)).length,
      hint: k === 'platforms' ? 'Languages & runtimes' : undefined, onClick: () => f.setFilter('group', f.filters.group === k ? '' : k), active: f.filters.group === k,
    })),
  ];
  const columns = [
    { key: 'id', label: 'Technology ID', render: (t) => <IdChip id={t.id} /> },
    { key: 'name', label: 'Technology Name', render: (t) => <div className="d-flex align-items-center gap-2"><Avatar name={t.name} seed={t.id} size={32} /><Link to={`/technologies/${t.id}`} className="cell-strong">{t.name}</Link></div> },
    { key: 'category', label: 'Category' },
    { key: 'websiteUrl', label: 'Website', render: (t) => (t.websiteUrl ? <a href={t.websiteUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{t.websiteUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}</a> : '—') },
    { key: 'usedBy', label: 'Used By', sortValue: (t) => usage[t.id].components.length, render: (t) => (usage[t.id].components.length || usage[t.id].applications.length
      ? <span>{usage[t.id].applications.length} app{usage[t.id].applications.length === 1 ? '' : 's'} · {usage[t.id].components.length} component{usage[t.id].components.length === 1 ? '' : 's'}</span>
      : <span className="text-subtle">Not used yet</span>) },
    { key: 'status', label: 'Status', render: (t) => <StatusBadge value={t.status} /> },
    { key: 'actions', label: '', sortable: false, render: (t) => <RowActions label={t.name} viewTo={`/technologies/${t.id}`} onEdit={() => setModal(t)} onDelete={() => requestDelete('technologies', t.id)} /> },
  ];
  const card = (t) => ({
    title: t.name, id: t.id, to: `/technologies/${t.id}`, subtitle: t.category, description: t.description, status: <StatusBadge value={t.status} />,
    meta: [{ icon: Globe, text: t.websiteUrl && t.websiteUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] }, { icon: AppWindow, text: `${usage[t.id].applications.length} apps · ${usage[t.id].components.length} components` }],
    actions: { viewTo: `/technologies/${t.id}`, onEdit: () => setModal(t), onDelete: () => requestDelete('technologies', t.id) },
  });
  return (
    <>
      <PageHeader title="Technology Stack" description="The Technology Master Catalog. Entries stay listed even when unused; versions are recorded per usage."
        actions={<button type="button" className="btn btn-primary" onClick={() => setModal('new')}><Plus size={16} />Add Technology</button>} />
      <SummaryCards items={summary} min={160} />
      <DataView viewKey="technologies" noun="technologies" columns={columns} rows={rows} card={card} initialSort={{ key: 'id', dir: 'asc' }} onRowClick={(t) => navigate(`/technologies/${t.id}`)}
          empty={data.technologies.length === 0 ? <EmptyState icon={Cpu} title="The catalog is empty" /> : undefined}
        search={f.search} onSearch={f.setSearch} searchPlaceholder="Search technology, category…" filtersActive={f.active} onClearFilters={f.clear}
        filters={(
          <>
          <FilterDropdown label="Categories" value={f.filters.category} onChange={(v) => f.setFilter('category', v)} options={data.categories.technologyCategories} format={(x) => x} />
          <FilterDropdown label="Statuses" value={f.filters.status} onChange={(v) => f.setFilter('status', v)} options={TECHNOLOGY_STATUSES} />
          <FilterDropdown label="Applications" value={f.filters.application} onChange={(v) => f.setFilter('application', v)} options={applicationOptions(data)} />
          <FilterDropdown label="Components" value={f.filters.component} onChange={(v) => f.setFilter('component', v)} options={componentOptions(data)} />
          </>
        )} />
      {modal && <TechnologyFormModal technology={modal === 'new' ? null : modal} onClose={() => setModal(null)} onCreated={(id) => navigate(`/technologies/${id}`)} />}
      {deleteDialog}
    </>
  );
}
