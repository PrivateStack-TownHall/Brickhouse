import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, Trash2, LayoutGrid, GitBranch, Plug, Cpu, Server, Rocket, History, Plus, ExternalLink } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DetailTabs from '../../components/common/DetailTabs';
import StatusBadge from '../../components/badges/StatusBadge';
import ReviewSummary from '../../components/common/ReviewSummary';
import RelationshipCard from '../../components/common/RelationshipCard';
import ActivityTimeline from '../../components/common/ActivityTimeline';
import DataTable from '../../components/tables/DataTable';
import EntityLink from '../../components/common/EntityLink';
import Avatar from '../../components/common/Avatar';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useToast } from '../../hooks/useToast';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import {
  companyOf, componentsOfApp, sharedComponentsOfApp, repositoriesOfApp, apisOfApp, technologiesOfApp, infrastructureOfApp, deploymentsOfApp, byId,
} from '../../services/query.service';
import { removeLink } from '../../services/registry.service';
import NotFoundPage from '../overview/NotFoundPage';
import AccessBadge from '../../components/badges/AccessBadge';

export const ExtLink = ({ href }) => (href ? <a href={href} target="_blank" rel="noreferrer" className="d-inline-flex align-items-center gap-1">{href}<ExternalLink size={12} /></a> : null);

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const { data, run } = useRegistry();
  const fmt = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const app = data.applications.find((a) => a.id === id);
  if (!app) return <NotFoundPage />;

  const company = companyOf(data, app);
  const components = componentsOfApp(data, id);
  const shared = sharedComponentsOfApp(data, id);
  const repos = repositoriesOfApp(data, id);
  const apis = apisOfApp(data, id);
  const techs = technologiesOfApp(data, id);
  const infra = infrastructureOfApp(data, id);
  const deployments = deploymentsOfApp(data, id);
  const activities = data.activities.filter((a) => a.applicationId === id || a.resourceId === id).slice().reverse();
  const unlink = (relation, linkId) => { run(removeLink, relation, linkId); toast('Relationship removed.'); };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: LayoutGrid },
    { key: 'repositories', label: 'Repositories', icon: GitBranch, count: repos.length },
    { key: 'apis', label: 'APIs & Services', icon: Plug, count: apis.length },
    { key: 'technologies', label: 'Technology Stack', icon: Cpu, count: techs.length },
    { key: 'infrastructure', label: 'Infrastructure', icon: Server, count: infra.length },
    { key: 'deployments', label: 'Deployments', icon: Rocket, count: deployments.length },
    { key: 'activity', label: 'Activity', icon: History, count: activities.length },
  ];

  return (
    <>
      <PageHeader title={app.name}
        avatar={<Avatar name={app.name} seed={app.id} size={48} />}
        meta={<div className="d-flex gap-2 align-items-center flex-wrap"><span className="bh-id">{app.id}</span><StatusBadge value={app.lifecycle} /><span className="bh-chip">{app.code}</span></div>}
        description={app.description}
        actions={(
          <>
            <Link to={`/applications/${id}/edit`} className="btn btn-secondary"><Pencil size={16} />Edit</Link>
            <button type="button" className="btn btn-outline-danger" onClick={() => requestDelete('applications', id, () => navigate('/applications'))}><Trash2 size={16} />Delete</button>
          </>
        )} />
      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="row g-4">
          <div className="col-xl-7">
            <div className="bh-card bh-card-body">
              <ReviewSummary sections={[
                { title: 'Application', fields: [
                  { label: 'Company', value: company && <span>{company.name} <span className="bh-id">{company.id}</span></span> },
                  { label: 'Category', value: app.category }, { label: 'Type', value: app.type },
                  { label: 'Purpose', value: app.purpose }, { label: 'Tags', value: app.tags?.length ? app.tags.map((t) => <span key={t} className="bh-chip me-1">{t}</span>) : null },
                  { label: 'Website', value: <ExtLink href={app.websiteUrl} /> }, { label: 'Documentation', value: <ExtLink href={app.documentationUrl} /> },
                ] },
                { title: 'Technical', fields: [
                  { label: 'Architecture', value: app.architecture }, { label: 'Platform', value: app.platform },
                  { label: 'Hosting', value: app.hosting }, { label: 'Environments', value: (app.environments || []).join(', ') },
                ] },
                { title: 'Record', fields: [{ label: 'Created', value: fmt.dateTime(app.createdAt) }, { label: 'Last Updated', value: fmt.dateTime(app.updatedAt) }] },
              ]} />
            </div>
          </div>
          <div className="col-xl-5 d-flex flex-column gap-4">
            <RelationshipCard title="Components" subtitle="Components whose parent is this application"
              action={<Link to={`/components/new?application=${id}`} className="btn btn-ghost btn-sm"><Plus size={14} />Add</Link>}
              items={components.map((c) => ({ entity: 'components', record: c, meta: `${c.layer} · ${c.type}`, badge: <StatusBadge value={c.lifecycle} /> }))} />
            {shared.length > 0 && (
              <RelationshipCard title="Shared components used" subtitle="Owned by other applications"
                items={shared.map(({ link, record }) => ({ key: link.id, entity: 'components', record, meta: byId(data, 'applications', record.applicationId)?.name, onUnlink: () => unlink('applicationComponents', link.id) }))} />
            )}
          </div>
        </div>
      )}

      {tab === 'repositories' && (
        <RelationshipCard title="Repositories" subtitle="Linked directly or through this application's components" columns={2}
          items={repos.map((r) => ({
            key: r.record.id, entity: 'repositories', record: r.record, meta: `${r.record.provider} · ${r.role || r.record.type} · via ${r.source}`,
            badge: r.record.accessStatus === 'inaccessible' ? <AccessBadge value="inaccessible" /> : <StatusBadge value={r.record.visibility} />,
            onUnlink: r.linkId ? () => unlink('applicationRepositories', r.linkId) : undefined,
          }))} />
      )}

      {tab === 'apis' && (
        <div className="row g-4">
          <div className="col-lg-6"><RelationshipCard title="Provided" items={apis.filter((a) => a.relation === 'provider').map((a) => ({ entity: 'apis', record: a.record, meta: `${a.record.protocol} · ${a.record.version}`, badge: <StatusBadge value="provider" /> }))} emptyText="This application provides no APIs." /></div>
          <div className="col-lg-6"><RelationshipCard title="Consumed" items={apis.filter((a) => a.relation === 'consumer').map((a) => ({ entity: 'apis', record: a.record, meta: `${a.record.protocol} · ${a.record.version}`, badge: <StatusBadge value="consumer" /> }))} emptyText="This application consumes no registered APIs." /></div>
        </div>
      )}

      {tab === 'technologies' && (
        <div className="bh-card">
          <DataTable rowKey={(r) => `${r.record.id}-${r.source}-${r.role}`} rows={techs} pageSize={15} columns={[
            { key: 'name', label: 'Technology', sortValue: (r) => r.record.name, render: (r) => <div className="d-flex align-items-center gap-2"><Avatar name={r.record.name} seed={r.record.id} size={24} /><EntityLink entity="technologies" record={r.record} /></div> },
            { key: 'category', label: 'Category', sortValue: (r) => r.record.category, render: (r) => r.record.category },
            { key: 'role', label: 'Role' },
            { key: 'version', label: 'Version', render: (r) => r.version || '—' },
            { key: 'source', label: 'Declared on', render: (r) => (r.source === 'Application' ? <span className="bh-chip">Application</span> : r.source) },
          ]} />
        </div>
      )}

      {tab === 'infrastructure' && (
        <RelationshipCard title="Infrastructure" subtitle="Declared on the application, its components and its deployments" columns={2}
          items={infra.map((r, i) => ({ key: `${r.record.id}-${i}`, entity: 'infrastructure', record: r.record, meta: `${r.record.provider} · ${r.role || r.record.resourceType} · ${r.source}`, badge: <StatusBadge value={r.record.status} /> }))} />
      )}

      {tab === 'deployments' && (
        <div className="bh-card">
          <DataTable rows={deployments} columns={[
            { key: 'id', label: 'ID', render: (d) => <span className="bh-id">{d.id}</span> },
            { key: 'name', label: 'Deployment', render: (d) => <EntityLink entity="deployments" record={d} /> },
            { key: 'component', label: 'Component', render: (d) => <EntityLink entity="components" record={byId(data, 'components', d.componentId)} /> },
            { key: 'environment', label: 'Environment', render: (d) => <StatusBadge value={d.environment} dot={false} /> },
            { key: 'platform', label: 'Provider' },
            { key: 'version', label: 'Version' },
            { key: 'status', label: 'Status', render: (d) => <StatusBadge value={d.status} /> },
          ]} />
        </div>
      )}

      {tab === 'activity' && <div className="bh-card bh-card-body"><ActivityTimeline activities={activities} /></div>}
      {deleteDialog}
    </>
  );
}
