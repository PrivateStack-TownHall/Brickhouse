import { Link } from 'react-router';
import {
  Box, Pencil, Trash2, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import { GIT_PROVIDERS } from '../../services/git-integrations.service';
import { envVarNameFor, providerEnvVarName } from '../../constants/git';
import { GIT_PROVIDER_ICONS } from '../../constants/ui';
import { resolveLogo } from '../../assets/logos';

function EnvTokenNotice({ serverTokenStatus, connection }) {
  const envInfo = serverTokenStatus.statuses?.[connection.id];
  const orgVar = envVarNameFor(connection);
  const providerVar = providerEnvVarName(connection.provider);

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
}

/** Card displaying one Git integration configuration, token status, and sync actions. */
export default function IntegrationCard({
  connection,
  repositories,
  serverTokenStatus,
  busy,
  testing,
  testResult,
  report,
  fmt,
  onEdit,
  onRemove,
  onTest,
  onSync,
  onCancelSync,
}) {
  const provider = GIT_PROVIDERS.find((p) => p.key === connection.provider);
  const Icon = GIT_PROVIDER_ICONS[connection.provider] || Box;
  const logo = resolveLogo(connection.provider);

  return (
    <section className="bh-card" aria-label={connection.name}>
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
          <button type="button" className="btn btn-ghost btn-icon" aria-label={`Edit ${connection.name}`} disabled={!!busy} onClick={onEdit}>
            <Pencil size={15} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon text-danger" aria-label={`Remove ${connection.name}`} disabled={!!busy} onClick={onRemove}>
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
          <EnvTokenNotice serverTokenStatus={serverTokenStatus} connection={connection} />
        </div>

        <div className="d-flex gap-2 align-items-center flex-wrap">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
            disabled={testing === connection.id || busy === connection.id}
            onClick={onTest}
          >
            <ShieldCheck size={14} />
            {testing === connection.id ? 'Testing…' : 'Test connection'}
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm d-inline-flex align-items-center gap-1"
            disabled={!!busy || !repositories.length}
            onClick={onSync}
          >
            <RefreshCw size={14} className={busy === connection.id ? 'bh-spin' : ''} />
            {busy === connection.id ? 'Syncing…' : connection.provider === 'github' ? 'Sync GitHub data' : 'Sync commits'}
          </button>

          {busy === connection.id && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancelSync}>
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
}
