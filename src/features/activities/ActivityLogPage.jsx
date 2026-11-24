import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Plus, Pencil, Trash2, RefreshCcw, Link2, Settings2, History, Lock } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import FilterBar from '../../components/tables/FilterBar';
import FilterDropdown from '../../components/tables/FilterDropdown';
import DataTable from '../../components/tables/DataTable';
import EmptyState from '../../components/common/EmptyState';
import { useRegistry } from '../../hooks/useRegistry';
import { useFilters } from '../../hooks/useFilters';
import { useFormat } from '../../hooks/useFormat';
import { ACTIVITY_CATEGORIES } from '../../services/activity.service';
import { entityForId, routeFor } from '../../services/schema';
import { matchesSearch } from '../../services/query.service';
import { applicationOptions } from '../../utils/options';

const CAT_STYLE = { create: [Plus, 'success'], update: [Pencil, 'info'], delete: [Trash2, 'danger'], lifecycle: [RefreshCcw, 'warning'], relationship: [Link2, 'orange'], system: [Settings2, 'gray'] };

export default function ActivityLogPage() {
  const { data } = useRegistry();
  const fmt = useFormat();
  const f = useFilters({ category: '', resourceType: '', application: '' });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const resourceTypes = useMemo(() => [...new Set(data.activities.map((a) => a.resourceType))].sort(), [data.activities]);
  const rows = data.activities.filter((a) => matchesSearch(a, f.search, ['id', 'action', 'description', 'resourceId', 'actor'])
    && (!f.filters.category || a.category === f.filters.category)
    && (!f.filters.resourceType || a.resourceType === f.filters.resourceType)
    && (!f.filters.application || a.applicationId === f.filters.application || a.resourceId === f.filters.application)
    && (!from || a.timestamp >= new Date(`${from}T00:00:00`).toISOString())
    && (!to || a.timestamp <= new Date(`${to}T23:59:59.999`).toISOString()));
  const summary = Object.entries(ACTIVITY_CATEGORIES).map(([k, label]) => ({
    key: k, label, value: data.activities.filter((a) => a.category === k).length, icon: CAT_STYLE[k][0], tone: CAT_STYLE[k][1],
    onClick: () => f.setFilter('category', f.filters.category === k ? '' : k), active: f.filters.category === k,
  }));
  const exists = (id) => {
    const e = entityForId(id);
    return e && data[e]?.some((r) => r.id === id) ? routeFor(e, id) : null;
  };
  const columns = [
    { key: 'id', label: 'Activity ID', render: (a) => <span className="bh-id">{a.id}</span> },
    { key: 'timestamp', label: 'Timestamp', render: (a) => <span style={{ whiteSpace: 'nowrap' }}>{fmt.dateTime(a.timestamp)}</span> },
    { key: 'actor', label: 'Actor' },
    { key: 'action', label: 'Action', render: (a) => { const [Icon, tone] = CAT_STYLE[a.category] || CAT_STYLE.system; return <span className={`bh-badge bh-tone-${tone}`}><Icon size={12} />{a.action}</span>; } },
    { key: 'resourceType', label: 'Resource Type' },
    { key: 'resourceId', label: 'Resource ID', render: (a) => { if (!a.resourceId) return <span className="text-subtle">—</span>; const to = exists(a.resourceId); return to ? <Link to={to} className="bh-id">{a.resourceId}</Link> : <span className="bh-id" title="Record no longer exists or has no page">{a.resourceId}</span>; } },
    { key: 'description', label: 'Description', sortable: false, render: (a) => <span className="text-muted">{a.description}</span> },
  ];
  const dateActive = from || to;
  return (
    <>
      <PageHeader title="Activity Log" description="Every change made inside BRICKHOUSE. Activity Log tracks registry changes; Git activity lives in Progress & Review."
        meta={<span className="bh-badge bh-tone-gray"><Lock size={12} />Append-only</span>} />
      <SummaryCards items={summary} min={160} />
      <div className="bh-card">
        <FilterBar search={f.search} onSearch={f.setSearch} placeholder="Search action, description, resource ID…" active={f.active || dateActive} onClear={() => { f.clear(); setFrom(''); setTo(''); }}>
          <div className="d-flex align-items-center gap-1">
            <input type="date" className="form-control" style={{ width: 150 }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <span className="text-subtle">–</span>
            <input type="date" className="form-control" style={{ width: 150 }} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </div>
          <FilterDropdown label="Activity types" value={f.filters.category} onChange={(v) => f.setFilter('category', v)} options={Object.entries(ACTIVITY_CATEGORIES).map(([value, label]) => ({ value, label }))} />
          <FilterDropdown label="Resource types" value={f.filters.resourceType} onChange={(v) => f.setFilter('resourceType', v)} options={resourceTypes} format={(x) => x} />
          <FilterDropdown label="Applications" value={f.filters.application} onChange={(v) => f.setFilter('application', v)} options={applicationOptions(data)} />
        </FilterBar>
        <DataTable columns={columns} rows={rows} pageSize={15} initialSort={{ key: 'timestamp', dir: 'desc' }}
          empty={data.activities.length === 0 ? <EmptyState icon={History} title="No activity yet" /> : undefined} />
      </div>
    </>
  );
}
