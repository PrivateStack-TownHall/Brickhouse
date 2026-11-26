import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  Github, Gitlab, Box, Plus, Pencil, Trash2, RefreshCw, ExternalLink,
  Key, CheckCircle2, AlertCircle, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import Modal from '../../components/dialogs/Modal';
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
import { resolveLogo } from '../../assets/logos';

const ICONS = { github: Github, gitlab: Gitlab, bitbucket: Box };

function envVarNameFor(connection) {
  const provider = String(connection?.provider || 'github').toUpperCase();
  const suffix = String(connection?.organization || '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
  return suffix ? `BRICKHOUSE_${provider}_TOKEN_${suffix}` : `BRICKHOUSE_${provider}_TOKEN`;
}

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
  const [showGuide, setShowGuide] = useState(true);
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

      {/* GitHub & Git Connection Guide */}
      <div className="bh-card" style={{ borderLeft: '4px solid var(--bh-orange)', background: 'var(--bh-surface)' }}>
        <div className="bh-card-body">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div className="d-flex align-items-center gap-2">
              <Github size={20} className="text-primary" />
              <strong style={{ fontSize: 15 }}>Apakah butuh API Key untuk GitHub?</strong>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowGuide(!showGuide)}
            >
              {showGuide ? 'Hide details' : 'Show details'}
            </button>
          </div>

          {showGuide && (
            <div className="small text-muted d-flex flex-column gap-2 mt-2">
              <p className="mb-0">
                GitHub tidak menggunakan sistem <em>API Key</em> konvensional. Sebagai gantinya, koneksi dilakukan melalui <strong>Personal Access Token (PAT)</strong> atau tanpa token:
              </p>
              <ul className="mb-1 ps-3" style={{ lineHeight: 1.6 }}>
                <li>
                  <strong>Public Repository:</strong> <em>Tidak butuh token / API key</em>. Anda dapat langsung mengklik <strong>Sync commits</strong>. Namun dibatasi rate limit 60 request/jam per IP.
                </li>
                <li>
                  <strong>Private Repository:</strong> <em>Wajib menggunakan Personal Access Token (PAT)</em> dengan izin <code>Contents: Read-only</code> (untuk commits, branches &amp; info repo) dan opsional <code>Pull requests: Read-only</code> (untuk daftar PR real).
                </li>
                <li>
                  <strong>Keamanan Token (.env / .env.local):</strong> PAT disimpan di file <code>.env</code> (atau <code>.env.local</code>, keduanya masuk <code>.gitignore</code>) dan dikirim hanya dari server proxy lokal — token tidak pernah masuk ke browser, <code>database/*.json</code>, <code>localStorage</code>, maupun backup. Kuota naik menjadi <strong>5,000 requests/jam</strong>.
                </li>
              </ul>
              <div className="d-flex gap-2 flex-wrap align-items-center pt-1">
                <span className="fw-semibold text-dark">Buat token GitHub:</span>
                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm d-inline-flex align-items-center gap-1"
                >
                  <Key size={13} />
                  Fine-grained PAT (Recommended)
                  <ExternalLink size={12} />
                </a>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Brickhouse%20Integration"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-sm d-inline-flex align-items-center gap-1"
                >
                  Classic PAT (repo scope)
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

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

      {connections.map((connection) => {
        const provider = GIT_PROVIDERS.find((p) => p.key === connection.provider);
        const Icon = ICONS[connection.provider] || Box;
        const logo = resolveLogo(connection.provider);
        const repositories = matchingRepositories(data.repositories, connection);
        const report = reports[connection.id];
        const testResult = testResults[connection.id];

        return (
          <section className="bh-card" key={connection.id} aria-label={connection.name}>
            <div className="bh-card-header flex-wrap">
              <div className="d-flex align-items-center gap-2 min-w-0">
                {logo ? (
                  <span className="bh-av bh-av-logo flex-shrink-0" style={{ width: 28, height: 28, minWidth: 28, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff', border: '1px solid var(--bh-border)', padding: 3, overflow: 'hidden' }}>
                    <img src={logo} alt={connection.provider} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </span>
                ) : (
                  <Icon size={20} className="flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <h3 className="bh-card-title text-break">{connection.name}</h3>
                  <p className="bh-card-sub text-break">
                    {provider?.label} · <code>{connection.organization}</code> · {repositories.length} matching repositories
                  </p>
                </div>
              </div>
              <div className="d-flex gap-1 align-items-center flex-wrap">
                {serverTokenStatus.available ? (
                  serverTokenStatus.statuses?.[connection.id]?.configured ? (
                    <span className="bh-badge bh-tone-success" title={`Masked: ${serverTokenStatus.statuses[connection.id].masked || '****'}`}>
                      .env PAT active
                    </span>
                  ) : (
                    <span className="bh-badge bh-tone-warning">
                      .env PAT missing
                    </span>
                  )
                ) : (
                  <span className="bh-badge bh-tone-gray">Static mode</span>
                )}
                <span className={`bh-badge bh-tone-${connection.lastSyncedAt ? 'success' : 'gray'}`}>
                  {connection.lastSyncedAt ? 'Snapshot synced' : 'Not synced'}
                </span>
                <button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit ${connection.name}`} disabled={!!busy} onClick={() => edit(connection)}>
                  <Pencil size={15} />
                </button>
                <button type="button" className="btn btn-ghost btn-icon text-danger" aria-label={`Remove ${connection.name}`} disabled={!!busy} onClick={() => setRemoving(connection)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="bh-card-body">
              <p className="text-muted small text-break mb-2">
                {connection.apiBaseUrl}
                {connection.lastSyncedAt && <> · Last sync: {fmt.dateTime(connection.lastSyncedAt)}</>}
              </p>
              {connection.notes && <p className="small text-break mb-3">{connection.notes}</p>}

              <div className="mb-3">
                {(() => {
                  const envInfo = serverTokenStatus.statuses?.[connection.id];
                  const orgVar = envVarNameFor(connection);
                  const providerVar = `BRICKHOUSE_${String(connection.provider || 'github').toUpperCase()}_TOKEN`;
                  if (!serverTokenStatus.available) {
                    return (
                      <div className="p-2 px-3 rounded border bg-body-tertiary text-muted small d-flex align-items-center gap-2">
                        <AlertCircle size={16} className="flex-shrink-0" />
                        <span>Local <code>.env</code> proxy is inactive in static mode. Public API requests only (60 req/hr).</span>
                      </div>
                    );
                  }
                  if (envInfo?.configured) {
                    return (
                      <div className="p-2 px-3 rounded border small d-flex align-items-start gap-2" style={{ background: 'var(--bh-success-soft, rgba(25,135,84,.08))', borderColor: 'rgba(25,135,84,.28)' }}>
                        <CheckCircle2 size={16} color="var(--bh-success)" className="flex-shrink-0 mt-1" />
                        <div className="min-w-0">
                          <div className="fw-semibold text-success">
                            Token active from <code>.env</code> ({envInfo.masked})
                          </div>
                          <div className="text-muted">
                            Source: {envInfo.source === 'env-org' ? <><code>{orgVar}</code> (org override)</> : <><code>{providerVar}</code> (provider default)</>}. Token stays on the local server and is never sent to the browser.
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="p-2 px-3 rounded border small d-flex align-items-start gap-2 bg-warning-subtle text-warning-emphasis" style={{ borderColor: 'rgba(217,119,6,.3)' }}>
                      <AlertTriangle size={16} className="flex-shrink-0 mt-1" />
                      <div className="min-w-0">
                        <div className="fw-semibold">
                          No PAT found in <code>.env</code> for <code>{connection.organization}</code>
                        </div>
                        <div>
                          Add <code>{orgVar}</code> or <code>{providerVar}</code> in <code>.env</code> (see <code>.env.example</code>), then click <strong>Check .env</strong>.
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="d-flex gap-2 align-items-center flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
                  disabled={testing === connection.id || busy === connection.id}
                  onClick={() => testConnection(connection)}
                >
                  <ShieldCheck size={14} />
                  {testing === connection.id ? 'Testing…' : 'Test connection'}
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm d-inline-flex align-items-center gap-1"
                  disabled={!!busy || !repositories.length}
                  onClick={() => sync(connection)}
                >
                  <RefreshCw size={14} className={busy === connection.id ? 'bh-spin' : ''} />
                  {busy === connection.id ? 'Syncing…' : connection.provider === 'github' ? 'Sync GitHub data' : 'Sync commits'}
                </button>

                {busy === connection.id && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => controller.current?.abort()}>
                    Cancel
                  </button>
                )}

                {!repositories.length && (
                  <span className="text-muted small">
                    No repositories match organization "<code>{connection.organization}</code>". Register one in <Link to="/repositories">Repositories</Link>.
                  </span>
                )}
              </div>

              {testResult && (
                <div className="mt-2 d-flex flex-column gap-1">
                  <div
                    className={`p-2 rounded small d-flex align-items-center gap-2 ${
                      testResult.ok
                        ? 'bg-success-subtle text-success'
                        : testResult.warning
                          ? 'bg-warning-subtle text-warning-emphasis'
                          : 'bg-danger-subtle text-danger'
                    }`}
                  >
                    {testResult.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <div>
                      <span>{testResult.message}</span>
                      {testResult.rateLimit && <span className="ms-2 text-muted">({testResult.rateLimit})</span>}
                    </div>
                  </div>
                  {testResult.scopeWarning && (
                    <div className="p-2 rounded small bg-warning-subtle text-warning-emphasis">
                      {testResult.scopeWarning}
                    </div>
                  )}
                </div>
              )}

              {report && (
                <div className="mt-3 small" role={report.error || report.failures?.length ? 'alert' : 'status'}>
                  {report.error ? (
                    <span className="text-danger">{report.error}</span>
                  ) : (
                    <>
                      {report.repositories > 0 ? (
                        <div className="text-success fw-semibold">
                          ✓ {report.repositories} repositories synced · {report.added} new commits{report.branches ? ` · ${report.branches} branches` : ''}{report.prs ? ` · ${report.prs} PRs` : ''}. <Link to="/progress">View in Progress &amp; Review</Link>
                        </div>
                      ) : (
                        <div className="text-danger fw-semibold">
                          ✕ 0 repositories synced · {report.rateLimited ? 'GitHub API rate limit reached.' : 'All repositories failed.'}
                        </div>
                      )}
                      {report.rateLimited && (
                        <div className="text-warning-emphasis bg-warning-subtle rounded p-2 mt-2">
                          Rate limit exhausted (0 remaining){report.skippedCount ? ` — stopped early (${report.skippedCount} remaining ${report.skippedCount === 1 ? 'repository' : 'repositories'} skipped)` : ''}.
                          {report.rateLimitReset ? ` Quota resets at ${fmt.dateTime(report.rateLimitReset)}.` : ''}
                          {' '}Enter a Personal Access Token (PAT) above for 5,000 requests/hour.
                        </div>
                      )}
                      {report.successes.some((s) => s.truncated) && (
                        <div className="text-muted mt-1">Some repositories reached the 500-commit limit; older history is omitted.</div>
                      )}
                      {report.failures.length > 0 && !report.rateLimited && (
                        <ul className="text-danger mb-0 mt-2">
                          {report.failures.map((failure) => (
                            <li key={failure.repositoryId}>{failure.name}: {failure.message}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {editing && (
        <Modal
          open
          title={connections.some((c) => c.id === editing.id) ? 'Edit integration' : 'Add integration'}
          onClose={() => setEditing(null)}
          footer={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" form="integration-form" className="btn btn-primary">Save integration</button>
            </>
          )}
        >
          <form id="integration-form" onSubmit={save}>
            <FormField label="Integration name" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} error={errors.name} placeholder="e.g. GitHub · MyTeam" />
            <FormSelect
              label="Provider"
              required
              value={editing.provider}
              options={GIT_PROVIDERS.map((p) => ({ value: p.key, label: p.label }))}
              onChange={(provider) => {
                const selected = GIT_PROVIDERS.find((p) => p.key === provider);
                if (selected) setEditing({ ...editing, provider, apiBaseUrl: selected.apiBaseUrl });
              }}
              error={errors.provider}
            />
            <FormField label="Organization / User / Group" required value={editing.organization} onChange={(e) => setEditing({ ...editing, organization: e.target.value })} error={errors.organization} placeholder="e.g. facebook, vsg-group, or your GitHub username" help="Matches registered repositories whose URLs begin with this organization or user name." />
            <FormField label="API Base URL" required type="url" value={editing.apiBaseUrl} onChange={(e) => setEditing({ ...editing, apiBaseUrl: e.target.value })} error={errors.apiBaseUrl} help="For self-hosted providers, use the API URL on the same host as your registered repositories." />
            <FormTextarea label="Notes" rows={2} value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </form>
        </Modal>
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
