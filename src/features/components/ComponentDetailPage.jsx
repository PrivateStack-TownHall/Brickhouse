import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, Trash2, Plus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/badges/StatusBadge';
import ReviewSummary from '../../components/common/ReviewSummary';
import RelationshipCard from '../../components/common/RelationshipCard';
import EntityLink from '../../components/common/EntityLink';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useToast } from '../../hooks/useToast';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { byId, linked, componentDependencies, deploymentsOfComponent, applicationOfComponent } from '../../services/query.service';
import { removeLink } from '../../services/registry.service';
import { titleCase } from '../../helpers';
import NotFoundPage from '../overview/NotFoundPage';

export default function ComponentDetailPage() {
  const { id } = useParams();
  const { data, run } = useRegistry();
  const fmt = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const c = data.components.find((x) => x.id === id);
  if (!c) return <NotFoundPage />;
  const app = byId(data, 'applications', c.applicationId);
  const unlink = (rel, linkId) => { run(removeLink, rel, linkId); toast('Relationship removed.'); };
  const repos = linked(data, 'componentRepositories', 'from', id);
  const techs = linked(data, 'componentTechnologies', 'from', id);
  const infra = linked(data, 'componentInfrastructure', 'from', id);
  const apis = linked(data, 'componentApis', 'from', id);
  const deps = componentDependencies(data, id);
  const deployments = deploymentsOfComponent(data, id);
  const includedIn = linked(data, 'componentDeployments', 'from', id);
  const usedBy = linked(data, 'applicationComponents', 'to', id);
  return (
    <>
      <PageHeader title={c.name}
        meta={<div className="d-flex gap-2 align-items-center flex-wrap"><span className="bh-id">{c.id}</span><StatusBadge value={c.lifecycle} /><span className="bh-chip">{c.layer}</span><span className="bh-chip">{c.type}</span></div>}
        description={c.description}
        actions={(
          <>
            <Link to={`/components/${id}/edit`} className="btn btn-secondary"><Pencil size={16} />Edit</Link>
            <button type="button" className="btn btn-outline-danger" onClick={() => requestDelete('components', id, () => navigate('/components'))}><Trash2 size={16} />Delete</button>
          </>
        )} />
      <div className="row g-4">
        <div className="col-xl-6">
          <div className="bh-card bh-card-body">
            <ReviewSummary sections={[{ title: 'Component', fields: [
              { label: 'Parent Application', value: <EntityLink entity="applications" record={app} showId /> },
              { label: 'Code', value: <span className="mono">{c.code}</span> }, { label: 'Version', value: c.version },
              { label: 'Category', value: c.category }, { label: 'Role', value: c.role },
              { label: 'Capabilities', value: (c.capabilities || []).map((x) => <span key={x} className="bh-chip me-1">{x}</span>) },
              { label: 'Created', value: fmt.date(c.createdAt) }, { label: 'Updated', value: fmt.date(c.updatedAt) },
            ] }]} />
          </div>
        </div>
        <div className="col-xl-6">
          <RelationshipCard title="Technology Stack" items={techs.map(({ link, record }) => ({ key: link.id, entity: 'technologies', record, meta: `${link.role || record.category}${link.version ? ` · v${link.version}` : ''}`, onUnlink: () => unlink('componentTechnologies', link.id) }))} />
        </div>
        <div className="col-lg-6"><RelationshipCard title="Repositories" items={repos.map(({ link, record }) => ({ key: link.id, entity: 'repositories', record, meta: `${record.provider}${link.path ? ` · ${link.path}` : ''}`, onUnlink: () => unlink('componentRepositories', link.id) }))} /></div>
        <div className="col-lg-6"><RelationshipCard title="Infrastructure" items={infra.map(({ link, record }) => ({ key: link.id, entity: 'infrastructure', record, meta: link.resourceName || record.resourceType, onUnlink: () => unlink('componentInfrastructure', link.id) }))} /></div>
        <div className="col-lg-6"><RelationshipCard title="APIs & Services" items={apis.map(({ link, record }) => ({ key: link.id, entity: 'apis', record, meta: `${record.protocol} · ${record.version}`, badge: <StatusBadge value={link.role} />, onUnlink: () => unlink('componentApis', link.id) }))} /></div>
        <div className="col-lg-6">
          <RelationshipCard title="Deployments" action={<Link to={`/deployments/new?component=${id}`} className="btn btn-ghost btn-sm"><Plus size={14} />Add</Link>}
            items={[
              ...deployments.map((d) => ({ entity: 'deployments', record: d, meta: `${d.environment} · ${d.platform}`, badge: <StatusBadge value={d.status} /> })),
              ...includedIn.map(({ link, record }) => ({ key: link.id, entity: 'deployments', record, meta: `included · ${record.environment}`, onUnlink: () => unlink('componentDeployments', link.id) })),
            ]} />
        </div>
        <div className="col-lg-6"><RelationshipCard title="Depends on" items={deps.dependsOn.map(({ link, record }) => ({ key: link.id, entity: 'components', record, meta: `${titleCase(link.relationshipType)} · ${applicationOfComponent(data, record)?.name || ''}`, onUnlink: () => unlink('componentServices', link.id) }))} /></div>
        <div className="col-lg-6"><RelationshipCard title="Used by components" items={deps.dependents.map(({ link, record }) => ({ key: link.id, entity: 'components', record, meta: `${titleCase(link.relationshipType)} · ${applicationOfComponent(data, record)?.name || ''}` }))} /></div>
        {usedBy.length > 0 && <div className="col-lg-6"><RelationshipCard title="Shared with applications" items={usedBy.map(({ link, record }) => ({ key: link.id, entity: 'applications', record, meta: link.role, onUnlink: () => unlink('applicationComponents', link.id) }))} /></div>}
      </div>
      {deleteDialog}
    </>
  );
}
