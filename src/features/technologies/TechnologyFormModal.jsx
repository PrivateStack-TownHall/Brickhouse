import { useState } from 'react';
import Modal from '../../components/dialogs/Modal';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import LogoField from '../../components/forms/LogoField';
import { useRegistry } from '../../hooks/useRegistry';
import { useToast } from '../../hooks/useToast';
import { createEntity, updateEntity, ValidationError } from '../../services/registry.service';
import { TECHNOLOGY_STATUSES } from '../../services/schema';

/** Catalog entry form. Versions are NOT stored here — they live on each usage relationship. */
export default function TechnologyFormModal({ technology, onClose, onCreated }) {
  const { data, run } = useRegistry();
  const toast = useToast();
  const [v, setV] = useState(() => technology ? { logoUrl: '', ...technology } : { name: '', category: '', websiteUrl: '', logoUrl: '', description: '', status: 'active' });
  const [errors, setErrors] = useState({});
  const set = (k, val) => { setV((s) => ({ ...s, [k]: val })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const save = () => {
    const values = { name: v.name, category: v.category, websiteUrl: v.websiteUrl, logoUrl: v.logoUrl, description: v.description, status: v.status };
    try {
      if (technology) { run(updateEntity, 'technologies', technology.id, values); toast(`Technology ${technology.id} updated.`); onClose(); } else { const id = run(createEntity, 'technologies', values); toast(`Technology ${id} added to the catalog.`); onClose(); onCreated?.(id); }
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors); else toast(e.message, 'error');
    }
  };
  return (
    <Modal open title={technology ? `Edit ${technology.name}` : 'Add Technology'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" onClick={save}>{technology ? 'Save Changes' : 'Add Technology'}</button></>}>
      <FormField label="Technology Name" required value={v.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="e.g. React" />
      <div className="row">
        <div className="col-sm-7"><FormSelect label="Category" required options={data.categories.technologyCategories} format={(x) => x} value={v.category} onChange={(x) => set('category', x)} error={errors.category} /></div>
        <div className="col-sm-5"><FormSelect label="Status" required options={TECHNOLOGY_STATUSES} value={v.status} onChange={(x) => set('status', x)} error={errors.status} /></div>
      </div>
      <FormField label="Website" type="url" value={v.websiteUrl} onChange={(e) => set('websiteUrl', e.target.value)} error={errors.websiteUrl} placeholder="https://…" />
      <LogoField label="Logo" value={v.logoUrl} onChange={(val) => set('logoUrl', val)} name={v.name} seed={technology?.id} error={errors.logoUrl} />
      <FormTextarea label="Description" rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} help="Versions are recorded per usage (on the component or application relationship)." />
    </Modal>
  );
}
