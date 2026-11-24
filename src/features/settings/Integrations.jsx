import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Github, Gitlab, Box, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import Modal from '../../components/dialogs/Modal';
import ConfirmDialog from '../../components/dialogs/ConfirmDialog';
import { useRegistry } from '../../hooks/useRegistry';
import { useToast } from '../../hooks/useToast';
import { useFormat } from '../../hooks/useFormat';
import { GIT_PROVIDERS, integrationConnections, matchingRepositories, validateIntegration, saveIntegration, removeIntegration, fetchIntegrationCommits, applyIntegrationSync } from '../../services/git-integrations.service';

const ICONS = { github: Github, gitlab: Gitlab, bitbucket: Box };

export default function Integrations() {
  const { data, run } = useRegistry();
  const toast = useToast();
  const fmt = useFormat();
  const connections = integrationConnections(data.settings.integrations);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [removing, setRemoving] = useState(null);
  const [tokens, setTokens] = useState({});
  const [busy, setBusy] = useState(null);
  const [reports, setReports] = useState({});
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);

  const edit = (record) => { setErrors({}); setEditing({ ...record }); };
  const save = (event) => {
    event.preventDefault();
    const invalid = validateIntegration(editing);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    try {
      run(saveIntegration, editing);
      setTokens((previous) => ({ ...previous, [editing.id]: '' }));
      setReports((previous) => ({ ...previous, [editing.id]: null }));
      setEditing(null);
      toast('Integration saved.');
    } catch (e) { toast(e.message, 'error'); }
  };
  const sync = async (connection) => {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(connection.id);
    setReports((previous) => ({ ...previous, [connection.id]: null }));
    try {
      const result = await fetchIntegrationCommits(connection, data.repositories, tokens[connection.id] || '', { signal: request.signal });
      request.signal.throwIfAborted();
      const saved = result.successes.length ? run(applyIntegrationSync, connection, result) : { added: 0, repositories: 0 };
      setReports((previous) => ({ ...previous, [connection.id]: { ...result, ...saved } }));
      toast(`${saved.repositories} repositories synced; ${saved.added} new commits.${result.failures.length ? ` ${result.failures.length} failed — see details.` : ''}`, result.failures.length ? 'error' : 'success');
    } catch (e) {
      if (!request.signal.aborted) setReports((previous) => ({ ...previous, [connection.id]: { error: e.message } }));
    } finally { controller.current = null; setBusy(null); }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex gap-3 align-items-start justify-content-between flex-wrap">
        <div><h2 className="bh-card-title">Git integrations</h2><p className="bh-card-sub">Add multiple accounts or organizations from the same provider.</p></div>
        <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => edit({ id: crypto.randomUUID(), provider: 'github', name: '', organization: '', apiBaseUrl: GIT_PROVIDERS[0].apiBaseUrl, notes: '' })}><Plus size={16} />Add integration</button>
      </div>
      <p className="text-muted small mb-0">Sync reads up to 500 latest commits per registered repository’s primary branch. Public repositories work without a token. Tokens stay in memory until you leave this page or reload. <Link to="/repositories">Manage repositories</Link> · <Link to="/progress">View commits</Link></p>
      {connections.length === 0 && <div className="bh-card bh-card-body text-muted">No integrations yet. Add a GitHub, GitLab or Bitbucket account to start syncing commits.</div>}
      {connections.map((connection) => {
        const provider = GIT_PROVIDERS.find((p) => p.key === connection.provider);
        const Icon = ICONS[connection.provider] || Box;
        const repositories = matchingRepositories(data.repositories, connection);
        const report = reports[connection.id];
        return (
          <section className="bh-card" key={connection.id} aria-label={connection.name}>
            <div className="bh-card-header flex-wrap">
              <div className="d-flex align-items-center gap-2 min-w-0"><Icon size={20} className="flex-shrink-0" /><div className="min-w-0"><h3 className="bh-card-title text-break">{connection.name}</h3><p className="bh-card-sub text-break">{provider?.label} · {connection.organization} · {repositories.length} matching repositories</p></div></div>
              <div className="d-flex gap-1 align-items-center"><span className={`bh-badge bh-tone-${connection.lastSyncedAt ? 'success' : 'gray'}`}>{connection.lastSyncedAt ? 'Snapshot synced' : 'Not synced'}</span><button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit ${connection.name}`} disabled={!!busy} onClick={() => edit(connection)}><Pencil size={15} /></button><button type="button" className="btn btn-ghost btn-icon text-danger" aria-label={`Remove ${connection.name}`} disabled={!!busy} onClick={() => setRemoving(connection)}><Trash2 size={15} /></button></div>
            </div>
            <div className="bh-card-body">
              <p className="text-muted small text-break mb-2">{connection.apiBaseUrl}{connection.lastSyncedAt && <> · Last sync: {fmt.dateTime(connection.lastSyncedAt)}</>}</p>
              {connection.notes && <p className="small text-break">{connection.notes}</p>}
              <FormField label={`Access token · ${connection.name}`} type="password" autoComplete="off" spellCheck={false} value={tokens[connection.id] || ''} disabled={!!busy} onChange={(e) => setTokens({ ...tokens, [connection.id]: e.target.value })} placeholder="Optional for public repositories" help={connection.provider === 'github' ? 'GitHub: Contents (read) permission for selected repositories.' : connection.provider === 'gitlab' ? 'GitLab: use a token with read_api access.' : 'Bitbucket Cloud: use a bearer token with repository read access.'} />
              <div className="d-flex gap-2 align-items-center flex-wrap">
                <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy || !repositories.length} onClick={() => sync(connection)}><RefreshCw size={14} />{busy === connection.id ? 'Syncing…' : 'Sync commits'}</button>
                {busy === connection.id && <button type="button" className="btn btn-ghost btn-sm" onClick={() => controller.current?.abort()}>Cancel</button>}
                {!repositories.length && <span className="text-muted small">Register a repository with a matching provider, host and organization.</span>}
              </div>
              {report && <div className="mt-3 small" role={report.error || report.failures?.length ? 'alert' : 'status'}>
                {report.error ? <span className="text-danger">{report.error}</span> : <>
                  <div>{report.repositories} repositories synced · {report.added} new commits. <Link to="/progress">View commits</Link></div>
                  {report.successes.some((s) => s.truncated) && <div className="text-muted">Some repositories reached the 500-commit limit; older history is not included in this sync.</div>}
                  {report.failures.length > 0 && <ul className="text-danger mb-0 mt-2">{report.failures.map((failure) => <li key={failure.repositoryId}>{failure.name}: {failure.message}</li>)}</ul>}
                </>}
              </div>}
            </div>
          </section>
        );
      })}
      {editing && <Modal open title={connections.some((c) => c.id === editing.id) ? 'Edit integration' : 'Add integration'} onClose={() => setEditing(null)} footer={<><button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button type="submit" form="integration-form" className="btn btn-primary">Save integration</button></>}>
        <form id="integration-form" onSubmit={save}>
          <FormField label="Integration name" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} error={errors.name} placeholder="e.g. GitHub · Work" />
          <FormSelect label="Provider" required value={editing.provider} options={GIT_PROVIDERS.map((p) => ({ value: p.key, label: p.label }))} onChange={(provider) => { const selected = GIT_PROVIDERS.find((p) => p.key === provider); if (selected) setEditing({ ...editing, provider, apiBaseUrl: selected.apiBaseUrl }); }} error={errors.provider} />
          <FormField label="Organization / User / Group" required value={editing.organization} onChange={(e) => setEditing({ ...editing, organization: e.target.value })} error={errors.organization} placeholder="e.g. vsg-group or team/platform" />
          <FormField label="API Base URL" required type="url" value={editing.apiBaseUrl} onChange={(e) => setEditing({ ...editing, apiBaseUrl: e.target.value })} error={errors.apiBaseUrl} help="For self-hosted providers, use the API URL on the same host as your registered repositories." />
          <FormTextarea label="Notes" rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
        </form>
      </Modal>}
      {removing && <ConfirmDialog open title={`Remove ${removing.name}?`} message="Remove this integration configuration? Recorded commits will remain in the registry." confirmLabel="Remove integration" tone="danger" onCancel={() => setRemoving(null)} onConfirm={() => { run(removeIntegration, removing.id); setTokens((previous) => { const next = { ...previous }; delete next[removing.id]; return next; }); setRemoving(null); toast('Integration removed.'); }} />}
    </div>
  );
}
