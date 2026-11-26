import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, Trash2, Info, Rocket, Plug } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/badges/StatusBadge';
import ReviewSummary from '../../components/common/ReviewSummary';
import RelationshipCard from '../../components/common/RelationshipCard';
import EntityLink from '../../components/common/EntityLink';
import Avatar from '../../components/common/Avatar';
import { appLogoSrc } from '../../assets/logos';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { byId, linked, applicationOfDeployment } from '../../services/query.service';
import { ExtLink } from '../applications/ApplicationDetailPage';
import NotFoundPage from '../overview/NotFoundPage';

export default function DeploymentDetailPage() {
  const { id } = useParams();
  const { data } = useRegistry();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const d = data.deployments.find((x) => x.id === id);
  if (!d) return <NotFoundPage />;
  const cmp = byId(data, 'components', d.componentId);
  const app = applicationOfDeployment(data, d);
  const repo = byId(data, 'repositories', d.repositoryId);
  const inf = byId(data, 'infrastructure', d.infrastructureId);
  const included = linked(data, 'componentDeployments', 'to', id);
  return (
    <>
      <PageHeader title={d.name}
        avatar={<Avatar name={d.name} seed={d.id} src={appLogoSrc(app)} size={48} />}
        meta={<div className="d-flex gap-2 align-items-center"><span className="bh-id">{d.id}</span><StatusBadge value={d.environment} dot={false} /><StatusBadge value={d.status} /></div>}
        description={d.notes}
        actions={(
          <>
            <Link to={`/deployments/${id}/edit`} className="btn btn-secondary"><Pencil size={16} />Edit</Link>
            <button type="button" className="btn btn-outline-danger" onClick={() => requestDelete('deployments', id, () => navigate('/deployments'))}><Trash2 size={16} />Delete</button>
          </>
        )} />
      <div className="bh-sample-banner mb-4" style={{ background: 'var(--bh-info-soft)', borderColor: 'rgba(47,111,178,.3)' }}>
        <Info size={18} color="var(--bh-info)" className="flex-shrink-0" />
        <div>Status is maintained manually in v1.0. BRICKHOUSE does not poll the deployment or its health check.</div>
      </div>
      <div className="row g-4">
        <div className="col-xl-7">
          <div className="bh-card h-100">
            <div className="bh-card-header colored">
              <div className="d-flex align-items-center">
                <span className="bh-card-header-icon">
                  <Rocket size={18} />
                </span>
                <div>
                  <h3 className="bh-card-title">Deployment</h3>
                  <p className="bh-card-sub">Deployment configuration, target hosting, and source</p>
                </div>
              </div>
            </div>
            <div className="bh-card-body">
              <ReviewSummary sections={[
                { title: 'Deployment Details', icon: Rocket, fields: [
                  { label: 'Code', value: <span className="mono">{d.code}</span> }, { label: 'Type', value: d.deploymentType }, { label: 'Hosting Platform', value: d.platform },
                  { label: 'Version / Release', value: d.version }, { label: 'Deploy Method', value: d.deployMethod }, { label: 'Branch / Source', value: <span className="mono">{d.branch}</span> },
                  { label: 'Deployed At', value: fmt.dateTime(d.lastDeployedAt) }, { label: 'Record Updated', value: fmt.dateTime(d.updatedAt) },
                  { label: 'Deployment URL', value: <ExtLink href={d.deploymentUrl} />, wide: true }, { label: 'Health Check URL', value: <ExtLink href={d.healthCheckUrl} />, wide: true },
                ] },
                { title: 'Relations', icon: Plug, fields: [
                  { label: 'Application', value: <EntityLink entity="applications" record={app} showId /> },
                  { label: 'Component', value: <EntityLink entity="components" record={cmp} showId /> },
                  { label: 'Repository', value: <EntityLink entity="repositories" record={repo} showId /> },
                  { label: 'Infrastructure', value: <EntityLink entity="infrastructure" record={inf} showId /> },
                ] },
              ]} />
            </div>
          </div>
        </div>
        <div className="col-xl-5">
          <RelationshipCard title="Other components included" items={included.map(({ link, record }) => ({ key: link.id, entity: 'components', record, meta: link.notes }))} emptyText="Only the primary component is deployed." />
        </div>
      </div>
      {deleteDialog}
    </>
  );
}
