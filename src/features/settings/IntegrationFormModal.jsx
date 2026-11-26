import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import Modal from '../../components/dialogs/Modal';
import { GIT_PROVIDERS } from '../../services/git-integrations.service';

/** Add/edit modal for a Git integration connection. */
export default function IntegrationFormModal({ editing, isExisting, errors, onChange, onClose, onSave }) {
  return (
    <Modal
      open
      title={isExisting ? 'Edit integration' : 'Add integration'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" form="integration-form" className="btn btn-primary">Save integration</button>
        </>
      )}
    >
      <form id="integration-form" onSubmit={onSave}>
        <FormField label="Integration name" required value={editing.name} onChange={(e) => onChange({ ...editing, name: e.target.value })} error={errors.name} placeholder="e.g. GitHub · MyTeam" />
        <FormSelect
          label="Provider"
          required
          value={editing.provider}
          options={GIT_PROVIDERS.map((p) => ({ value: p.key, label: p.label }))}
          onChange={(provider) => {
            const selected = GIT_PROVIDERS.find((p) => p.key === provider);
            if (selected) onChange({ ...editing, provider, apiBaseUrl: selected.apiBaseUrl });
          }}
          error={errors.provider}
        />
        <FormField label="Organization / User / Group" required value={editing.organization} onChange={(e) => onChange({ ...editing, organization: e.target.value })} error={errors.organization} placeholder="e.g. facebook, vsg-group, or your GitHub username" help="Matches registered repositories whose URLs begin with this organization or user name." />
        <FormField label="API Base URL" required type="url" value={editing.apiBaseUrl} onChange={(e) => onChange({ ...editing, apiBaseUrl: e.target.value })} error={errors.apiBaseUrl} help="For self-hosted providers, use the API URL on the same host as your registered repositories." />
        <FormTextarea label="Notes" rows={2} value={editing.notes} onChange={(e) => onChange({ ...editing, notes: e.target.value })} />
      </form>
    </Modal>
  );
}
