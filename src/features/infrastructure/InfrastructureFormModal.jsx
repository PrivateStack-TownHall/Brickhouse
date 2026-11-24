import { useState } from 'react';
import Modal from '../../components/dialogs/Modal';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import { useRegistry } from '../../hooks/useRegistry';
import { useToast } from '../../hooks/useToast';
import { createEntity, updateEntity, ValidationError } from '../../services/registry.service';
import { INFRASTRUCTURE_STATUSES } from '../../services/schema';

/** Registers a resource (instance) at a provider, e.g. Provider: Supabase → Resource: Orange LMS Database. */
export default function InfrastructureFormModal({ resource, onClose, onCreated }) {
  const { data, run } = useRegistry();
  const toast = useToast();
  const [v, setV] = useState(() => resource ? { ...resource } : { name: '', provider: '', category: '', resourceType: '', region: '', dashboardUrl: '', description: '', status: 'active' });
  const [errors, setErrors] = useState({});
  const set = (k, val) => { setV((s) => ({ ...s, [k]: val })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const providers = [...new Set(data.infrastructure.map((i) => i.provider))].sort();
  const save = () => {
    const values = { name: v.name, provider: v.provider, category: v.category, resourceType: v.resourceType, region: v.region, dashboardUrl: v.dashboardUrl, description: v.description, status: v.status };
    try {
      if (resource) { run(updateEntity, 'infrastructure', resource.id, values); toast(`Infrastructure ${resource.id} updated.`); onClose(); } else { const id = run(createEntity, 'infrastructure', values); toast(`Infrastructure ${id} registered.`); onClose(); onCreated?.(id); }
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors); else toast(e.message, 'error');
    }
  };
  return (
    <Modal open size="lg" title={resource ? `Edit ${resource.name}` : 'Add Infrastructure'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" onClick={save}>{resource ? 'Save Changes' : 'Add Infrastructure'}</button></>}>
      <div className="row">
        <div className="col-md-6"><FormField label="Provider" required list="bh-providers" value={v.provider} onChange={(e) => set('provider', e.target.value)} error={errors.provider} placeholder="e.g. Supabase" help="The vendor or platform." /></div>
        <datalist id="bh-providers">{providers.map((p) => <option key={p} value={p} />)}</datalist>
        <div className="col-md-6"><FormField label="Resource Name" required value={v.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="e.g. Orange LMS Database" help="The specific resource / instance." /></div>
        <div className="col-md-4"><FormSelect label="Category" required options={data.categories.infrastructureCategories} format={(x) => x} value={v.category} onChange={(x) => set('category', x)} error={errors.category} /></div>
        <div className="col-md-4"><FormField label="Resource Type" value={v.resourceType} onChange={(e) => set('resourceType', e.target.value)} placeholder="e.g. PostgreSQL Database" /></div>
        <div className="col-md-4"><FormField label="Region" value={v.region} onChange={(e) => set('region', e.target.value)} placeholder="e.g. ap-southeast-1" /></div>
        <div className="col-md-8"><FormField label="Dashboard URL" type="url" value={v.dashboardUrl} onChange={(e) => set('dashboardUrl', e.target.value)} error={errors.dashboardUrl} placeholder="https://…" /></div>
        <div className="col-md-4"><FormSelect label="Status" required options={INFRASTRUCTURE_STATUSES} value={v.status} onChange={(x) => set('status', x)} error={errors.status} /></div>
        <div className="col-12"><FormTextarea label="Description" rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} /></div>
      </div>
    </Modal>
  );
}
