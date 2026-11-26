import Modal from '../../components/dialogs/Modal';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import LogoField from '../../components/forms/LogoField';
import { useEntityFormModal } from '../../hooks/useEntityFormModal';
import { TECHNOLOGY_STATUSES } from '../../services/schema';

/** Catalog entry form. Versions are NOT stored here — they live on each usage relationship. */
export default function TechnologyFormModal({ technology, onClose, onCreated }) {
  const { data, values: v, set, errors, save } = useEntityFormModal({
    entity: 'technologies',
    record: technology,
    initialValues: () => (technology ? { logoUrl: '', ...technology } : { name: '', category: '', websiteUrl: '', logoUrl: '', description: '', status: 'active' }),
    onClose,
    onCreated,
    createMessage: (id) => `Technology ${id} added to the catalog.`,
    updateMessage: (id) => `Technology ${id} updated.`,
  });

  const handleSave = () => save({
    name: v.name,
    category: v.category,
    websiteUrl: v.websiteUrl,
    logoUrl: v.logoUrl,
    description: v.description,
    status: v.status,
  });

  return (
    <Modal open title={technology ? `Edit ${technology.name}` : 'Add Technology'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" onClick={handleSave}>{technology ? 'Save Changes' : 'Add Technology'}</button></>}>
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
