import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, Trash2, Plus, Lock, Unlock, Plug } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/badges/StatusBadge';
import ReviewSummary from '../../components/common/ReviewSummary';
import RelationshipCard from '../../components/common/RelationshipCard';
import EntityLink from '../../components/common/EntityLink';
import DataTable from '../../components/tables/DataTable';
import RowActions from '../../components/tables/RowActions';
import EmptyState from '../../components/common/EmptyState';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useToast } from '../../hooks/useToast';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { linked, providerOfApi, companyOf } from '../../services/query.service';
import { removeLink } from '../../services/registry.service';
import { ExtLink } from '../applications/ApplicationDetailPage';
import EndpointModal from './EndpointModal';
import NotFoundPage from '../overview/NotFoundPage';

const METHOD_TONES = { GET: 'info', POST: 'success', PUT: 'warning', PATCH: 'orange', DELETE: 'danger' };

export default function ApiDetailPage() {
  const { id } = useParams();
  const { data, run } = useRegistry();
  const fmt = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const [editing, setEditing] = useState(null);
  const api = data.apis.find((a) => a.id === id);
  if (!api) return <NotFoundPage />;
  const provider = providerOfApi(data, id);
  const consumers = linked(data, 'apiConsumers', 'from', id);
  const components = linked(data, 'componentApis', 'to', id);
  const infra = linked(data, 'apiInfrastructure', 'from', id);
  const endpoints = data.endpoints.filter((e) => e.apiId === id);
  const unlink = (rel, linkId) => { run(removeLink, rel, linkId); toast('Relationship removed.'); };
  return (
    <>
      <PageHeader title={api.name}
        meta={<div className="d-flex gap-2 align-items-center flex-wrap"><span className="bh-id">{api.id}</span><StatusBadge value={api.lifecycle} /><span className="bh-chip">{api.protocol}</span><span className="bh-chip">{api.version}</span><span className="bh-chip">{api.exposure === 'external' ? 'External' : 'Internal'}</span></div>}
        description={api.description}
        actions={(
          <>
            <Link to={`/apis/${id}/edit`} className="btn btn-secondary"><Pencil size={16} />Edit</Link>
            <button type="button" className="btn btn-outline-danger" onClick={() => requestDelete('apis', id, () => navigate('/apis'))}><Trash2 size={16} />Delete</button>
          </>
        )} />
      <div className="row g-4">
        <div className="col-xl-7">
          <div className="bh-card h-100">
            <div className="bh-card-header">
              <div className="d-flex align-items-center gap-2">
                <Plug size={18} className="text-muted flex-shrink-0" />
                <div>
                  <h3 className="bh-card-title">API & Service</h3>
                  <p className="bh-card-sub">Configuration, provider, and network endpoints</p>
                </div>
              </div>
            </div>
            <div className="bh-card-body">
              <ReviewSummary sections={[{ title: 'API Details', icon: Plug, fields: [
                { label: 'Provider Application', value: provider ? <EntityLink entity="applications" record={provider} showId /> : (api.exposure === 'external' ? 'External provider' : null) },
                { label: 'Company', value: companyOf(data, provider)?.name }, { label: 'Service Type', value: api.serviceType },
                { label: 'Authentication', value: api.authentication }, { label: 'Environment', value: api.environment }, { label: 'Code', value: <span className="mono">{api.code}</span> },
                { label: 'Base URL', value: api.baseUrl && <span className="mono">{api.baseUrl}</span>, wide: true },
                { label: 'Documentation', value: <ExtLink href={api.documentationUrl} />, wide: true },
                { label: 'Tags', value: (api.tags || []).map((t) => <span key={t} className="bh-chip me-1">{t}</span>) },
                { label: 'Updated', value: fmt.date(api.updatedAt) },
              ] }]} />
            </div>
          </div>
        </div>
        <div className="col-xl-5 d-flex flex-column gap-4">
          <RelationshipCard title="Consumer Applications" items={consumers.map(({ link, record }) => ({ key: link.id, entity: 'applications', record, meta: companyOf(data, record)?.name, badge: <StatusBadge value="consumer" />, onUnlink: () => unlink('apiConsumers', link.id) }))} emptyText="No consumers registered." />
          <RelationshipCard title="Components" items={components.map(({ link, record }) => ({ key: link.id, entity: 'components', record, meta: record.layer, badge: <StatusBadge value={link.role} />, onUnlink: () => unlink('componentApis', link.id) }))} />
          <RelationshipCard title="Infrastructure" items={infra.map(({ link, record }) => ({ key: link.id, entity: 'infrastructure', record, meta: record.provider, onUnlink: () => unlink('apiInfrastructure', link.id) }))} />
        </div>
        <div className="col-12">
          <div className="bh-card">
            <div className="bh-card-header">
              <div><h3 className="bh-card-title">Endpoints <span className="text-subtle fw-normal">({endpoints.length})</span></h3><p className="bh-card-sub">Each endpoint references this API by ID.</p></div>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={14} />Add Endpoint</button>
            </div>
            <DataTable rows={endpoints} pageSize={15} empty={<EmptyState title="No endpoints yet" />} columns={[
              { key: 'id', label: 'Endpoint ID', render: (e) => <span className="bh-id">{e.id}</span> },
              { key: 'method', label: 'Method', render: (e) => <span className={`bh-badge bh-tone-${METHOD_TONES[e.method] || 'gray'} mono`}>{e.method}</span> },
              { key: 'path', label: 'Path', render: (e) => <span className="mono">{e.path}</span> },
              { key: 'name', label: 'Name', render: (e) => <span className="fw-semibold">{e.name}</span> },
              { key: 'description', label: 'Description', render: (e) => e.description || '—' },
              { key: 'authenticationRequired', label: 'Auth', render: (e) => (e.authenticationRequired ? <span title="Authentication required"><Lock size={15} /></span> : <span title="Public"><Unlock size={15} className="text-subtle" /></span>) },
              { key: 'actions', label: '', sortable: false, render: (e) => <RowActions label={e.name} onEdit={() => setEditing(e)} onDelete={() => requestDelete('endpoints', e.id)} /> },
            ]} />
          </div>
        </div>
      </div>
      {editing && <EndpointModal apiId={id} endpoint={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {deleteDialog}
    </>
  );
}
