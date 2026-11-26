import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Info, Server } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DetailActions from '../../components/common/DetailActions';
import AlertBanner from '../../components/common/AlertBanner';
import SectionCard from '../../components/common/SectionCard';
import ExtLink from '../../components/common/ExtLink';
import StatusBadge from '../../components/badges/StatusBadge';
import ReviewSummary from '../../components/common/ReviewSummary';
import RelationshipCard from '../../components/common/RelationshipCard';
import Avatar from '../../components/common/Avatar';
import { resolveLogo } from '../../assets/logos';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { infrastructureUsage } from '../../services/query.service';
import InfrastructureFormModal from './InfrastructureFormModal';
import NotFoundPage from '../overview/NotFoundPage';

export default function InfrastructureDetailPage() {
  const { id } = useParams();
  const { data } = useRegistry();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const [editing, setEditing] = useState(false);
  const inf = data.infrastructure.find((x) => x.id === id);
  if (!inf) return <NotFoundPage />;
  const u = infrastructureUsage(data, id);
  const siblings = data.infrastructure.filter((i) => i.provider === inf.provider && i.id !== id);
  return (
    <>
      <PageHeader title={inf.name}
        avatar={<Avatar name={inf.name} seed={inf.id} src={inf.logoUrl || resolveLogo(inf.provider)} size={48} />}
        meta={<div className="d-flex gap-2 align-items-center"><span className="bh-id">{inf.id}</span><StatusBadge value={inf.status} /><span className="bh-chip">{inf.provider}</span><span className="bh-chip">{inf.category}</span></div>}
        description={inf.description}
        actions={<DetailActions onEdit={() => setEditing(true)} onDelete={() => requestDelete('infrastructure', id, () => navigate('/infrastructure'))} />} />
      <AlertBanner tone="info" icon={Info} className="mb-4">
        Registry record only. Utilization and health are not tracked without a provider integration.
      </AlertBanner>
      <div className="row g-4">
        <div className="col-xl-5 d-flex flex-column gap-4">
          <SectionCard variant="colored" icon={Server} title="Resource" subtitle="Cloud asset configuration, provider, and region">
            <ReviewSummary sections={[{ title: 'Resource Details', icon: Server, fields: [
              { label: 'Provider', value: inf.provider }, { label: 'Resource Type', value: inf.resourceType }, { label: 'Category', value: inf.category },
              { label: 'Region', value: inf.region }, { label: 'Dashboard', value: <ExtLink href={inf.dashboardUrl} />, wide: true },
              { label: 'Created', value: fmt.date(inf.createdAt) }, { label: 'Updated', value: fmt.date(inf.updatedAt) },
            ] }]} />
          </SectionCard>
          <RelationshipCard title={`Other ${inf.provider} resources`} items={siblings.map((s) => ({ entity: 'infrastructure', record: s, meta: s.resourceType, badge: <StatusBadge value={s.status} /> }))} emptyText="No other resources at this provider." />
        </div>
        <div className="col-xl-7 d-flex flex-column gap-4">
          <RelationshipCard title="Used By Applications" columns={2} items={u.applications.map((a) => ({ entity: 'applications', record: a.record, meta: a.role }))} emptyText="Not used by any application." />
          <RelationshipCard title="Components" items={u.components.map((c) => ({ key: c.record.id, entity: 'components', record: c.record, meta: `${c.app?.name || ''}${c.resourceName ? ` · ${c.resourceName}` : ''}` }))} />
          <RelationshipCard title="Deployments" items={u.deployments.map((d) => ({ entity: 'deployments', record: d, meta: d.environment, badge: <StatusBadge value={d.status} /> }))} />
          {u.apis.length > 0 && <RelationshipCard title="APIs & Services" items={u.apis.map((a) => ({ entity: 'apis', record: a, meta: a.protocol }))} />}
        </div>
      </div>
      {editing && <InfrastructureFormModal resource={inf} onClose={() => setEditing(false)} />}
      {deleteDialog}
    </>
  );
}
