import { useMemo } from 'react';
import { Layers, AppWindow } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Plus, GitBranch, Github, Gitlab, Lock, Globe, Box, ShieldAlert } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import FilterDropdown from '../../components/tables/FilterDropdown';
import DataView from '../../components/data/DataView';
import IdChip from '../../components/common/IdChip';
import Avatar from '../../components/common/Avatar';
import RecordIdentity from '../../components/common/RecordIdentity';
import { appLogoSrc } from '../../assets/logos';
import RowActions from '../../components/tables/RowActions';
import StatusBadge from '../../components/badges/StatusBadge';
import AccessBadge from '../../components/badges/AccessBadge';
import EmptyState from '../../components/common/EmptyState';
import { useRegistry } from '../../hooks/useRegistry';
import { useFilters } from '../../hooks/useFilters';
import { useFormat } from '../../hooks/useFormat';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { applicationsOfRepo, matchesSearch } from '../../services/query.service';
import { VISIBILITIES, ACCESS_STATUSES } from '../../services/schema';
import { applicationOptions, companyOptions } from '../../utils/options';

export default function RepositoriesPage() {
  const { data } = useRegistry();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const f = useFilters({ provider: '', type: '', visibility: '', access: '', application: '', company: '' });
  const appsOf = useMemo(() => Object.fromEntries(data.repositories.map((r) => [r.id, applicationsOfRepo(data, r.id).map((x) => x.record)])), [data]);

  const rows = data.repositories.filter((r) => matchesSearch(r, f.search, ['id', 'name', 'code', 'description', 'topics', 'organization', 'language'])
    && (!f.filters.provider || r.provider === f.filters.provider)
    && (!f.filters.type || r.type === f.filters.type)
    && (!f.filters.visibility || r.visibility === f.filters.visibility)
    && (!f.filters.access || (r.accessStatus || 'unknown') === f.filters.access)
    && (!f.filters.application || appsOf[r.id].some((a) => a.id === f.filters.application))
    && (!f.filters.company || appsOf[r.id].some((a) => a.ownerId === f.filters.company)));

  const n = (pred) => data.repositories.filter(pred).length;
  const toggle = (k, v) => f.setFilter(k, f.filters[k] === v ? '' : v);
  const summary = [
    { label: 'Total Repositories', value: data.repositories.length, icon: GitBranch, tone: 'orange' },
    { label: 'GitHub', value: n((r) => r.provider === 'GitHub'), icon: Github, tone: 'navy', onClick: () => toggle('provider', 'GitHub'), active: f.filters.provider === 'GitHub' },
    { label: 'GitLab', value: n((r) => r.provider === 'GitLab'), icon: Gitlab, tone: 'warning', onClick: () => toggle('provider', 'GitLab'), active: f.filters.provider === 'GitLab' },
    { label: 'Bitbucket', value: n((r) => r.provider === 'Bitbucket'), icon: Box, tone: 'info', onClick: () => toggle('provider', 'Bitbucket'), active: f.filters.provider === 'Bitbucket' },
    { label: 'Private', value: n((r) => r.visibility === 'private'), icon: Lock, tone: 'gray', onClick: () => toggle('visibility', 'private'), active: f.filters.visibility === 'private' },
    { label: 'Public', value: n((r) => r.visibility === 'public'), icon: Globe, tone: 'success', onClick: () => toggle('visibility', 'public'), active: f.filters.visibility === 'public' },
    { label: 'Access Issues', value: n((r) => r.accessStatus === 'inaccessible'), icon: ShieldAlert, tone: 'danger', hint: 'Inaccessible (404)', onClick: () => toggle('access', 'inaccessible'), active: f.filters.access === 'inaccessible' },
  ];
  const columns = [
    { key: 'id', label: 'Repository ID', render: (r) => <IdChip id={r.id} /> },
    { key: 'name', label: 'Repository Name', render: (r) => <RecordIdentity name={r.name} seed={r.id} src={appLogoSrc(appsOf[r.id][0])} to={`/repositories/${r.id}`} subtitle={appsOf[r.id].map((a) => a.name).join(', ') || 'No application'} /> },
    { key: 'provider', label: 'Provider', render: (r) => <div className="d-flex align-items-center gap-2"><Avatar name={r.provider} size={20} /><span>{r.provider}</span></div> },
    { key: 'organization', label: 'Organization', render: (r) => r.organization || '—' },
    { key: 'url', label: 'URL', render: (r) => (r.url ? <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-truncate d-inline-block" style={{ maxWidth: 180 }}>{r.url.replace(/^https?:\/\//, '')}</a> : <span className="text-subtle">—</span>) },
    { key: 'type', label: 'Type', render: (r) => <span className="text-capitalize">{r.type}</span> },
    { key: 'mainBranch', label: 'Main Branch', render: (r) => <span className="mono">{r.mainBranch}</span> },
    { key: 'language', label: 'Language', render: (r) => r.language || <span className="text-subtle">—</span> },
    { key: 'visibility', label: 'Visibility', render: (r) => <StatusBadge value={r.visibility} /> },
    { key: 'accessStatus', label: 'Access', render: (r) => <AccessBadge value={r.accessStatus} /> },
    { key: 'updatedAt', label: 'Updated', render: (r) => fmt.date(r.updatedAt) },
    { key: 'actions', label: '', sortable: false, render: (r) => <RowActions label={r.name} viewTo={`/repositories/${r.id}`} editTo={`/repositories/${r.id}/edit`} onDelete={() => requestDelete('repositories', r.id)} /> },
  ];
  const card = (r) => ({
    title: r.name, id: r.id, to: `/repositories/${r.id}`, subtitle: r.organization, avatar: r.name, avatarSrc: appLogoSrc(appsOf[r.id][0]),
    description: r.description || appsOf[r.id].map((a) => a.name).join(', '), tags: r.topics || [],
    status: <AccessBadge value={r.accessStatus} />,
    meta: [{ icon: Github, text: r.provider }, { icon: Layers, text: r.type }, { icon: GitBranch, text: r.mainBranch }, { icon: AppWindow, text: `${appsOf[r.id].length} app${appsOf[r.id].length === 1 ? '' : 's'}` }],
    actions: { viewTo: `/repositories/${r.id}`, editTo: `/repositories/${r.id}/edit`, onDelete: () => requestDelete('repositories', r.id) },
  });
  return (
    <>
      <PageHeader title="Repositories" description="Source code repositories across GitHub, GitLab and Bitbucket, and the applications and components they serve."
        actions={<Link to="/repositories/new" className="btn btn-primary"><Plus size={16} />Add Repository</Link>} />
      <SummaryCards items={summary} min={160} />
      <DataView viewKey="repositories" noun="repositories" columns={columns} rows={rows} card={card} initialSort={{ key: 'id', dir: 'asc' }} onRowClick={(r) => navigate(`/repositories/${r.id}`)}
          empty={data.repositories.length === 0 ? <EmptyState icon={GitBranch} title="No repositories registered" action={<Link to="/repositories/new" className="btn btn-primary"><Plus size={16} />Add Repository</Link>} /> : undefined}
        search={f.search} onSearch={f.setSearch} searchPlaceholder="Search name, ID, topics, language…" filtersActive={f.active} onClearFilters={f.clear}
        filters={(
          <>
          <FilterDropdown label="Providers" value={f.filters.provider} onChange={(v) => f.setFilter('provider', v)} options={data.categories.repositoryProviders} format={(x) => x} />
          <FilterDropdown label="Types" value={f.filters.type} onChange={(v) => f.setFilter('type', v)} options={data.categories.repositoryTypes} />
          <FilterDropdown label="Visibility" value={f.filters.visibility} onChange={(v) => f.setFilter('visibility', v)} options={VISIBILITIES} />
          <FilterDropdown label="Access statuses" value={f.filters.access} onChange={(v) => f.setFilter('access', v)} options={ACCESS_STATUSES} />
          <FilterDropdown label="Applications" value={f.filters.application} onChange={(v) => f.setFilter('application', v)} options={applicationOptions(data)} />
          <FilterDropdown label="Companies" value={f.filters.company} onChange={(v) => f.setFilter('company', v)} options={companyOptions(data)} />
          </>
        )} />
      {deleteDialog}
    </>
  );
}
