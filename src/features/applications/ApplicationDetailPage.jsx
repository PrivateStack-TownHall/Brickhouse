import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Pencil, Trash2, LayoutGrid, GitBranch, Plug, Cpu, Server, Rocket, History, Plus, ExternalLink,
  AppWindow, Boxes, Info,
} from 'lucide-react';
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
import { appLogoSrc } from '../../assets/logos';

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
        avatar={<Avatar name={app.name} seed={app.id} src={app.logoUrl} size={48} />}
        meta={<div className="d-flex gap-2 align-items-center flex-wrap"><span className="bh-id">{app.id}</span><StatusBadge value={app.lifecycle} /><span className="bh-chip">{app.code}</span></div>}
        description={app.description}
        actions={(
          <>
            <Link to={`/applications/${id}/edit`} className="btn btn-secondary"><Pencil size={16} />Edit</Link>
            <button type="button" className="btn btn-outline-danger" onClick={() => requestDelete('applications', id, () => navigate('/applications'))}><Trash2 size={16} />Delete</button>
          </>
        )} />
      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {tab === 'overview' && (
            <div className="row g-4">
              <div className="col-xl-7">
                <div className="bh-card h-100">
                  <div className="bh-card-header colored">
                    <div className="d-flex align-items-center">
                      <span className="bh-card-header-icon">
                        <AppWindow size={18} />
                      </span>
                      <div>
                        <h3 className="bh-card-title">Application</h3>
                        <p className="bh-card-sub">Application specifications, environment, and ownership</p>
                      </div>
                    </div>
                  </div>
                  <div className="bh-card-body">
                    <ReviewSummary sections={[
                      { title: 'General Information', icon: AppWindow, fields: [
                        { label: 'Company', value: company && <span>{company.name} <span className="bh-id">{company.id}</span></span> },
                        { label: 'Category', value: app.category }, { label: 'Type', value: app.type },
                        { label: 'Purpose', value: app.purpose }, { label: 'Tags', value: app.tags?.length ? app.tags.map((t) => <span key={t} className="bh-chip me-1">{t}</span>) : null },
                        { label: 'Website', value: <ExtLink href={app.websiteUrl} /> }, { label: 'Documentation', value: <ExtLink href={app.documentationUrl} /> },
                      ] },
                      { title: 'Technical Stack', icon: Cpu, fields: [
                        { label: 'Architecture', value: app.architecture }, { label: 'Platform', value: app.platform },
                        { label: 'Hosting', value: app.hosting }, { label: 'Environments', value: (app.environments || []).join(', ') },
                      ] },
                      { title: 'Record Audit', icon: History, fields: [{ label: 'Created', value: fmt.dateTime(app.createdAt) }, { label: 'Last Updated', value: fmt.dateTime(app.updatedAt) }] },
                    ]} />
                  </div>
                </div>
              </div>
              <div className="col-xl-5 d-flex flex-column gap-4">
                <RelationshipCard entity="components" icon={Boxes} title="Components" subtitle="Components whose parent is this application"
                  action={<Link to={`/components/new?application=${id}`} className="btn btn-ghost btn-sm"><Plus size={14} />Add</Link>}
                  items={components.map((c) => ({ entity: 'components', record: c, avatarSrc: appLogoSrc(app), meta: `${c.layer} · ${c.type}`, badge: <StatusBadge value={c.lifecycle} /> }))} />
                {shared.length > 0 && (
                  <RelationshipCard entity="components" icon={Boxes} title="Shared components used" subtitle="Owned by other applications"
                    items={shared.map(({ link, record }) => {
                      const parentApp = byId(data, 'applications', record.applicationId);
                      return { key: link.id, entity: 'components', record, avatarSrc: appLogoSrc(parentApp), meta: parentApp?.name, onUnlink: () => unlink('applicationComponents', link.id) };
                    })} />
                )}
              </div>
            </div>
          )}

          {tab === 'repositories' && (
            <RelationshipCard entity="repositories" icon={GitBranch} title="Repositories" subtitle="Linked directly or through this application's components" columns={2}
              items={repos.map((r) => ({
                key: r.record.id, entity: 'repositories', record: r.record, avatarSrc: appLogoSrc(app), meta: `${r.record.provider} · ${r.role || r.record.type} · via ${r.source}`,
                badge: r.record.accessStatus === 'inaccessible' ? <AccessBadge value="inaccessible" /> : <StatusBadge value={r.record.visibility} />,
                onUnlink: r.linkId ? () => unlink('applicationRepositories', r.linkId) : undefined,
              }))} />
          )}

          {tab === 'apis' && (
            <div className="row g-4">
              <div className="col-lg-6"><RelationshipCard entity="apis" icon={Plug} title="Provided" subtitle="APIs and services exposed by this application" items={apis.filter((a) => a.relation === 'provider').map((a) => ({ entity: 'apis', record: a.record, meta: `${a.record.protocol} · ${a.record.version}`, badge: <StatusBadge value="provider" /> }))} emptyText="This application provides no APIs." /></div>
              <div className="col-lg-6"><RelationshipCard entity="apis" icon={Plug} title="Consumed" subtitle="External or internal APIs consumed by this application" items={apis.filter((a) => a.relation === 'consumer').map((a) => ({ entity: 'apis', record: a.record, meta: `${a.record.protocol} · ${a.record.version}`, badge: <StatusBadge value="consumer" /> }))} emptyText="This application consumes no registered APIs." /></div>
            </div>
          )}

          {tab === 'technologies' && (
            <div className="bh-card">
              <div className="bh-card-header colored">
                <div className="d-flex align-items-center">
                  <span className="bh-card-header-icon">
                    <Cpu size={18} />
                  </span>
                  <div>
                    <h3 className="bh-card-title">Technology Stack <span className="bh-card-count">({techs.length})</span></h3>
                    <p className="bh-card-sub">Technologies declared on the application and its components</p>
                  </div>
                </div>
              </div>
              <DataTable rowKey={(r) => `${r.record.id}-${r.source}-${r.role}`} rows={techs} pageSize={15} columns={[
                { key: 'name', label: 'Technology', sortValue: (r) => r.record.name, render: (r) => <div className="d-flex align-items-center gap-2"><Avatar name={r.record.name} seed={r.record.id} src={r.record.logoUrl} size={24} /><EntityLink entity="technologies" record={r.record} /></div> },
                { key: 'category', label: 'Category', sortValue: (r) => r.record.category, render: (r) => r.record.category },
                { key: 'role', label: 'Role' },
                { key: 'version', label: 'Version', render: (r) => r.version || '—' },
                { key: 'source', label: 'Declared on', render: (r) => (r.source === 'Application' ? <span className="bh-chip">Application</span> : r.source) },
              ]} />
            </div>
          )}

          {tab === 'infrastructure' && (
            <RelationshipCard entity="infrastructure" icon={Server} title="Infrastructure" subtitle="Declared on the application, its components and its deployments" columns={2}
              items={infra.map((r, i) => ({ key: `${r.record.id}-${i}`, entity: 'infrastructure', record: r.record, meta: `${r.record.provider} · ${r.role || r.record.resourceType} · ${r.source}`, badge: <StatusBadge value={r.record.status} /> }))} />
          )}

          {tab === 'deployments' && (
            <div className="bh-card">
              <div className="bh-card-header colored">
                <div className="d-flex align-items-center">
                  <span className="bh-card-header-icon">
                    <Rocket size={18} />
                  </span>
                  <div>
                    <h3 className="bh-card-title">Deployments <span className="bh-card-count">({deployments.length})</span></h3>
                    <p className="bh-card-sub">Deployment records across environments for this application</p>
                  </div>
                </div>
              </div>
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

          {tab === 'activity' && (
            <div className="bh-card">
              <div className="bh-card-header colored">
                <div className="d-flex align-items-center">
                  <span className="bh-card-header-icon">
                    <History size={18} />
                  </span>
                  <div>
                    <h3 className="bh-card-title">Activity Timeline</h3>
                    <p className="bh-card-sub">Audit trail of changes for this application</p>
                  </div>
                </div>
              </div>
              <div className="bh-card-body">
                <ActivityTimeline activities={activities} />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      {deleteDialog}
    </>
  );
}
