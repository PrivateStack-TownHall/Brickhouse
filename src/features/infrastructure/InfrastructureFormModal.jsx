import Modal from '../../components/dialogs/Modal';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import LogoField from '../../components/forms/LogoField';
import { useEntityFormModal } from '../../hooks/useEntityFormModal';
import { INFRASTRUCTURE_STATUSES } from '../../services/schema';

/** Registers a resource (instance) at a provider, e.g. Provider: Supabase → Resource: Orange LMS Database. */
export default function InfrastructureFormModal({ resource, onClose, onCreated }) {
  const { data, values: v, set, errors, save } = useEntityFormModal({
    entity: 'infrastructure',
    record: resource,
    initialValues: () => (resource ? { logoUrl: '', ...resource } : { name: '', provider: '', category: '', resourceType: '', region: '', dashboardUrl: '', logoUrl: '', description: '', status: 'active' }),
    onClose,
    onCreated,
    createMessage: (id) => `Infrastructure ${id} registered.`,
    updateMessage: (id) => `Infrastructure ${id} updated.`,
  });

  const providers = [...new Set(data.infrastructure.map((i) => i.provider))].sort();
  const handleSave = () => save({
    name: v.name,
    provider: v.provider,
    category: v.category,
    resourceType: v.resourceType,
    region: v.region,
    dashboardUrl: v.dashboardUrl,
    logoUrl: v.logoUrl,
    description: v.description,
    status: v.status,
  });

  return (
    <Modal open size="lg" title={resource ? `Edit ${resource.name}` : 'Add Infrastructure'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" onClick={handleSave}>{resource ? 'Save Changes' : 'Add Infrastructure'}</button></>}>
      <div className="row">
        <div className="col-md-6"><FormField label="Provider" required list="bh-providers" value={v.provider} onChange={(e) => set('provider', e.target.value)} error={errors.provider} placeholder="e.g. Supabase" help="The vendor or platform." /></div>
        <datalist id="bh-providers">{providers.map((p) => <option key={p} value={p} />)}</datalist>
        <div className="col-md-6"><FormField label="Resource Name" required value={v.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="e.g. Orange LMS Database" help="The specific resource / instance." /></div>
        <div className="col-md-4"><FormSelect label="Category" required options={data.categories.infrastructureCategories} format={(x) => x} value={v.category} onChange={(x) => set('category', x)} error={errors.category} /></div>
        <div className="col-md-4"><FormField label="Resource Type" value={v.resourceType} onChange={(e) => set('resourceType', e.target.value)} placeholder="e.g. PostgreSQL Database" /></div>
        <div className="col-md-4"><FormField label="Region" value={v.region} onChange={(e) => set('region', e.target.value)} placeholder="e.g. ap-southeast-1" /></div>
        <div className="col-md-8"><FormField label="Dashboard URL" type="url" value={v.dashboardUrl} onChange={(e) => set('dashboardUrl', e.target.value)} error={errors.dashboardUrl} placeholder="https://…" /></div>
        <div className="col-md-4"><FormSelect label="Status" required options={INFRASTRUCTURE_STATUSES} value={v.status} onChange={(x) => set('status', x)} error={errors.status} /></div>
        <div className="col-12"><LogoField label="Logo" value={v.logoUrl} onChange={(val) => set('logoUrl', val)} name={v.name} seed={resource?.id} hint={v.provider} error={errors.logoUrl} /></div>
        <div className="col-12"><FormTextarea label="Description" rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} /></div>
      </div>
    </Modal>
  );
}
