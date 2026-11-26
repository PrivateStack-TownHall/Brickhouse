import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Plus, RefreshCw } from 'lucide-react';
import ConfirmDialog from '../../components/dialogs/ConfirmDialog';
import { useRegistry } from '../../hooks/useRegistry';
import { useNotifications } from '../../hooks/useNotifications';
import { useToast } from '../../hooks/useToast';
import { useFormat } from '../../hooks/useFormat';
import {
  GIT_PROVIDERS,
  integrationConnections,
  matchingRepositories,
  validateIntegration,
  saveIntegration,
  removeIntegration,
  fetchServerTokenStatus,
  fetchIntegrationFullSync,
  applyIntegrationSync,
  testGitConnection,
} from '../../services/git-integrations.service';
import GitHubTokenGuide from './GitHubTokenGuide';
import IntegrationCard from './IntegrationCard';
import IntegrationFormModal from './IntegrationFormModal';

export default function Integrations() {
  const { data, run } = useRegistry();
  const toast = useToast();
  const { notify } = useNotifications();
  const fmt = useFormat();
  const connections = integrationConnections(data.settings.integrations);
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const [removing, setRemoving] = useState(null);
  const [serverTokenStatus, setServerTokenStatus] = useState({ available: false, loading: true, statuses: {} });
  const [busy, setBusy] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [reports, setReports] = useState({});
  const controller = useRef(null);

  useEffect(() => () => controller.current?.abort(), []);

  const refreshEnvStatus = async (showToast = false) => {
    setServerTokenStatus((prev) => ({ ...prev, loading: true }));
    const res = await fetchServerTokenStatus(connections);
    setServerTokenStatus({ ...res, loading: false });
    if (showToast) {
      toast(res.available ? '.env token status refreshed.' : 'Local .env proxy is unavailable in static mode.', res.available ? 'success' : 'error');
    }
  };

  useEffect(() => {
    let active = true;
    fetchServerTokenStatus(connections).then((res) => {
      if (active) setServerTokenStatus({ ...res, loading: false });
    });
    return () => { active = false; };
  }, [data.settings.integrations]);

  const edit = (record) => {
    setErrors({});
    setEditing({ ...record });
  };

  const save = (event) => {
    event.preventDefault();
    const invalid = validateIntegration(editing);
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    try {
      run(saveIntegration, editing);
      setEditing(null);
      toast('Integration saved.');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const testConnection = async (connection) => {
    setTesting(connection.id);
    setTestResults((prev) => ({ ...prev, [connection.id]: null }));
    try {
      const useServerToken = Boolean(serverTokenStatus.statuses?.[connection.id]?.configured);
      const res = await testGitConnection(connection, '', { useServerToken });
      const exhausted = Boolean(res.rateLimitExhausted);
      const resetNote = res.rateLimitResetAt ? ` · resets at ${fmt.dateTime(res.rateLimitResetAt)}` : '';
      const viaLabel = res.authSource === 'server-env' ? ' via .env proxy' : '';
      setTestResults((prev) => ({
        ...prev,
        [connection.id]: {
          ok: !exhausted,
          warning: exhausted,
          scopeWarning: res.scopeWarning || null,
          message: exhausted
            ? `Rate limit exhausted (0 / ${res.rateLimitTotal || 60} remaining)${resetNote}. Configure a PAT in .env for 5,000 req/hr.`
            : res.authenticated
              ? `Connected as ${res.user ? `@${res.user}` : 'authenticated user'}${viaLabel}`
              : 'Public API access verified (unauthenticated)',
          rateLimit: !exhausted && res.rateLimitRemaining !== null ? `${res.rateLimitRemaining} / ${res.rateLimitTotal || 5000} remaining` : null,
        },
      }));
      if (exhausted) toast('API rate limit exhausted (0 remaining). Configure a PAT in .env or wait for reset.', 'error', { skipNotification: true });
      else toast('Connection successful!', 'success');
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [connection.id]: { ok: false, message: e.message },
      }));
      toast(e.message, 'error');
    } finally {
      setTesting(null);
    }
  };

  const sync = async (connection) => {
    if (controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(connection.id);
    setReports((previous) => ({ ...previous, [connection.id]: null }));
    try {
      const useServerToken = Boolean(serverTokenStatus.statuses?.[connection.id]?.configured);
      const result = await fetchIntegrationFullSync(connection, data.repositories, '', { signal: request.signal, useServerToken });
      request.signal.throwIfAborted();
      const saved = (result.successes.length || result.inaccessibleIds?.length)
        ? (result.successes.length ? run(applyIntegrationSync, connection, result) : { added: 0, repositories: 0, branches: 0, prs: 0 })
        : { added: 0, repositories: 0, branches: 0, prs: 0 };
      setReports((previous) => ({ ...previous, [connection.id]: { ...result, ...saved } }));
      const extraInfo = connection.provider === 'github' ? ` · ${saved.branches || 0} branches · ${saved.prs || 0} PRs` : '';
      const failedAll = saved.repositories === 0 && result.failures.length > 0;
      const summaryMsg = result.rateLimited
        ? (saved.repositories > 0
          ? `${saved.repositories} repositories synced; ${saved.added} new commits${extraInfo}. Rate limit reached (${result.skippedCount || 0} skipped).`
          : `Rate limit reached — 0 repositories synced. Add a GitHub PAT in .env for 5,000 req/hr.`)
        : failedAll
          ? `Sync failed for all ${result.failures.length} repositories.`
          : `${saved.repositories} repositories synced; ${saved.added} new commits${extraInfo}.${result.failures.length ? ` ${result.failures.length} failed — see details.` : ''}`;
      toast(summaryMsg, result.failures.length ? 'error' : 'success', { skipNotification: true });
      notify({
        kind: 'sync',
        tone: failedAll ? 'danger' : result.failures.length ? 'warning' : 'success',
        title: failedAll ? `Git sync failed · ${connection.name}` : `Git sync · ${connection.name}`,
        message: summaryMsg,
        to: '/settings',
      });
    } catch (e) {
      if (!request.signal.aborted) {
        setReports((previous) => ({ ...previous, [connection.id]: { error: e.message } }));
        notify({
          kind: 'sync',
          tone: 'danger',
          title: `Git sync failed · ${connection.name}`,
          message: e.message,
          to: '/settings',
        });
        toast(e.message, 'error', { skipNotification: true });
      }
    } finally {
      controller.current = null;
      setBusy(null);
    }
  };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex gap-3 align-items-start justify-content-between flex-wrap">
        <div>
          <h2 className="bh-card-title">Git Integrations</h2>
          <p className="bh-card-sub">Connect your GitHub, GitLab, or Bitbucket accounts to synchronize commit history and graphs.</p>
        </div>
        <div className="d-flex gap-2 align-items-center flex-wrap">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={!!busy || serverTokenStatus.loading}
            onClick={() => refreshEnvStatus(true)}
          >
            <RefreshCw size={15} className={serverTokenStatus.loading ? 'bh-spin' : ''} />Check .env
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!!busy}
            onClick={() => edit({ id: crypto.randomUUID(), provider: 'github', name: '', organization: '', apiBaseUrl: GIT_PROVIDERS[0].apiBaseUrl, notes: '' })}
          >
            <Plus size={16} />Add integration
          </button>
        </div>
      </div>

      <GitHubTokenGuide />

      <div className="d-flex gap-2 align-items-center flex-wrap text-muted small">
        <span>Quick shortcuts:</span>
        <Link to="/repositories" className="badge bg-light text-dark border text-decoration-none">Manage Repositories</Link>
        <Link to="/progress" className="badge bg-light text-dark border text-decoration-none">Progress & Review Graph</Link>
        <Link to="/" className="badge bg-light text-dark border text-decoration-none">Overview Commit Activity</Link>
      </div>

      {connections.length === 0 && (
        <div className="bh-card bh-card-body text-muted">
          No integrations yet. Add a GitHub, GitLab or Bitbucket account to start syncing commits.
        </div>
      )}

      {connections.map((connection) => (
        <IntegrationCard
          key={connection.id}
          connection={connection}
          repositories={matchingRepositories(data.repositories, connection)}
          serverTokenStatus={serverTokenStatus}
          busy={busy}
          testing={testing}
          testResult={testResults[connection.id]}
          report={reports[connection.id]}
          fmt={fmt}
          onEdit={() => edit(connection)}
          onRemove={() => setRemoving(connection)}
          onTest={() => testConnection(connection)}
          onSync={() => sync(connection)}
          onCancelSync={() => controller.current?.abort()}
        />
      ))}

      {editing && (
        <IntegrationFormModal
          editing={editing}
          isExisting={connections.some((c) => c.id === editing.id)}
          errors={errors}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}

      {removing && (
        <ConfirmDialog
          open
          title={`Remove ${removing.name}?`}
          message="Remove this integration configuration? Recorded commits will remain in the registry."
          confirmLabel="Remove integration"
          tone="danger"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            run(removeIntegration, removing.id);
            setRemoving(null);
            toast('Integration removed.');
          }}
        />
      )}
    </div>
  );
}
