import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Pencil, Trash2, Cpu, BarChart2, Layers } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/badges/StatusBadge';
import ReviewSummary from '../../components/common/ReviewSummary';
import RelationshipCard from '../../components/common/RelationshipCard';
import DataTable from '../../components/tables/DataTable';
import EntityLink from '../../components/common/EntityLink';
import HBarList from '../../components/charts/HBarList';
import EmptyState from '../../components/common/EmptyState';
import Avatar from '../../components/common/Avatar';
import { useRegistry } from '../../hooks/useRegistry';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { technologyUsage } from '../../services/query.service';
import { ExtLink } from '../applications/ApplicationDetailPage';
import TechnologyFormModal from './TechnologyFormModal';
import NotFoundPage from '../overview/NotFoundPage';

export default function TechnologyDetailPage() {
  const { id } = useParams();
  const { data } = useRegistry();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const [editing, setEditing] = useState(false);
  const t = data.technologies.find((x) => x.id === id);
  if (!t) return <NotFoundPage />;
  const usage = technologyUsage(data, id);
  const rows = [
    ...usage.components.map((c) => ({ key: `c-${c.record.id}`, kind: 'Component', record: c.record, entity: 'components', app: c.app, role: c.role, version: c.version })),
    ...data.applicationTechnologies.filter((l) => l.technologyId === id).map((l) => ({ key: `a-${l.id}`, kind: 'Application', record: data.applications.find((a) => a.id === l.applicationId), entity: 'applications', app: null, role: l.role, version: l.version })),
  ].filter((r) => r.record);
  const versions = Object.entries(rows.reduce((m, r) => { const k = r.version || 'Unspecified'; m[k] = (m[k] || 0) + 1; return m; }, {})).map(([label, value]) => ({ label: label === 'Unspecified' ? label : `v${label}`, value }));
  return (
    <>
      <PageHeader title={t.name}
        avatar={<Avatar name={t.name} seed={t.id} size={48} />}
        meta={<div className="d-flex gap-2 align-items-center"><span className="bh-id">{t.id}</span><StatusBadge value={t.status} /><span className="bh-chip">{t.category}</span></div>}
        description={t.description}
        actions={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}><Pencil size={16} />Edit</button>
            <button type="button" className="btn btn-outline-danger" onClick={() => requestDelete('technologies', id, () => navigate('/technologies'))}><Trash2 size={16} />Delete</button>
          </>
        )} />
      <div className="row g-4">
        <div className="col-xl-4 d-flex flex-column gap-4">
          <div className="bh-card">
            <div className="bh-card-header colored">
              <div className="d-flex align-items-center">
                <span className="bh-card-header-icon">
                  <Cpu size={18} />
                </span>
                <div>
                  <h3 className="bh-card-title">Technology</h3>
                  <p className="bh-card-sub">Catalog entry and usage summary</p>
                </div>
              </div>
            </div>
            <div className="bh-card-body">
              <ReviewSummary sections={[{ title: 'Catalog Entry', icon: Cpu, fields: [
                { label: 'Website', value: <ExtLink href={t.websiteUrl} />, wide: true }, { label: 'Category', value: t.category },
                { label: 'Used by applications', value: usage.applications.length }, { label: 'Used by components', value: usage.components.length },
              ] }]} />
            </div>
          </div>
          <div className="bh-card">
            <div className="bh-card-header colored">
              <div className="d-flex align-items-center">
                <span className="bh-card-header-icon">
                  <BarChart2 size={18} />
                </span>
                <div>
                  <h3 className="bh-card-title">Version by usage</h3>
                </div>
              </div>
            </div>
            <div className="bh-card-body">{versions.length ? <HBarList data={versions} valueSuffix=" usage(s)" /> : <EmptyState title="Not used yet" message="This entry stays in the catalog until it is linked." />}</div>
          </div>
        </div>
        <div className="col-xl-8 d-flex flex-column gap-4">
          <RelationshipCard title="Used By Applications" columns={2} items={usage.applications.map((a) => ({ entity: 'applications', record: a.record, meta: `${a.role || ''}${a.version ? ` · v${a.version}` : ''}` }))} emptyText="No application uses this technology." />
          <div className="bh-card">
            <div className="bh-card-header colored">
              <div className="d-flex align-items-center">
                <span className="bh-card-header-icon">
                  <Layers size={18} />
                </span>
                <div>
                  <h3 className="bh-card-title">Usage information</h3>
                </div>
              </div>
            </div>
            <DataTable rows={rows} rowKey={(r) => r.key} empty={<EmptyState title="No usage recorded" />} columns={[
              { key: 'kind', label: 'Declared on' },
              { key: 'name', label: 'Record', sortValue: (r) => r.record.name, render: (r) => <EntityLink entity={r.entity} record={r.record} /> },
              { key: 'app', label: 'Application', sortValue: (r) => r.app?.name, render: (r) => (r.app ? <EntityLink entity="applications" record={r.app} /> : '—') },
              { key: 'role', label: 'Role', render: (r) => r.role || '—' },
              { key: 'version', label: 'Version', render: (r) => (r.version ? <span className="mono">{r.version}</span> : '—') },
            ]} />
          </div>
        </div>
      </div>
      {editing && <TechnologyFormModal technology={t} onClose={() => setEditing(false)} />}
      {deleteDialog}
    </>
  );
}
