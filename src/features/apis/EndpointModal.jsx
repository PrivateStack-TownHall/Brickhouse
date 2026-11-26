import Modal from '../../components/dialogs/Modal';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import { useEntityFormModal } from '../../hooks/useEntityFormModal';

/** Create / edit one endpoint of an API. */
export default function EndpointModal({ apiId, endpoint, onClose }) {
  const { data, values: v, set, errors, save } = useEntityFormModal({
    entity: 'endpoints',
    record: endpoint,
    initialValues: () => (endpoint ? { ...endpoint } : { apiId, name: '', method: 'GET', path: '/', description: '', authenticationRequired: true }),
    onClose,
    createMessage: (id) => `Endpoint ${id} added.`,
    updateMessage: (id) => `Endpoint ${id} updated.`,
  });

  const handleSave = () => save({
    apiId,
    name: v.name,
    method: v.method,
    path: v.path,
    description: v.description,
    authenticationRequired: !!v.authenticationRequired,
  });

  return (
    <Modal open title={endpoint ? `Edit endpoint ${endpoint.id}` : 'Add endpoint'} onClose={onClose}
      footer={<><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-primary" onClick={handleSave}>Save Endpoint</button></>}>
      <FormField label="Name" required value={v.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="e.g. Get Users" />
      <div className="row">
        <div className="col-4"><FormSelect label="Method" required options={data.categories.httpMethods} format={(x) => x} value={v.method} onChange={(x) => set('method', x)} error={errors.method} /></div>
        <div className="col-8"><FormField label="Path" required value={v.path} onChange={(e) => set('path', e.target.value)} error={errors.path} placeholder="/api/v1/users" /></div>
      </div>
      <FormTextarea label="Description" rows={2} value={v.description} onChange={(e) => set('description', e.target.value)} />
      <label className="form-check d-flex gap-2 align-items-center">
        <input type="checkbox" className="form-check-input m-0" checked={!!v.authenticationRequired} onChange={(e) => set('authenticationRequired', e.target.checked)} />
        Authentication required
      </label>
    </Modal>
  );
}
