import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Pencil, Trash2, GitBranch, Activity, RefreshCw, ExternalLink } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBadge from '../../components/badges/StatusBadge';
import ReviewSummary from '../../components/common/ReviewSummary';
import RelationshipCard from '../../components/common/RelationshipCard';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useToast } from '../../hooks/useToast';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { linked, applicationOfComponent, applicationsOfRepo } from '../../services/query.service';
import { removeLink } from '../../services/registry.service';
import { buildGitData, summarizeGit } from '../../services/git-analytics.service';
import { integrationConnections, syncSingleGitHubRepo, applySingleRepoSync } from '../../services/git-integrations.service';
import GitSourceBadge from '../../components/badges/GitSourceBadge';
import { ExtLink } from '../applications/ApplicationDetailPage';
import AccessBadge from '../../components/badges/AccessBadge';
import NotFoundPage from '../overview/NotFoundPage';

export default function RepositoryDetailPage() {
  const { id } = useParams();
  const { data, run } = useRegistry();
  const fmt = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const [syncing, setSyncing] = useState(false);

  const repo = data.repositories.find((r) => r.id === id);
  const gitData = useMemo(() => buildGitData(data), [data]);
  const git = useMemo(() => (repo ? summarizeGit(gitData, { days: 30, repositoryIds: new Set([id]) }).byRepo[0] : null), [gitData, id, repo]);
  const recorded = gitData.commits.filter((c) => c.repositoryId === id);

  if (!repo) return <NotFoundPage />;
  const directApps = linked(data, 'applicationRepositories', 'to', id);
  const allApps = applicationsOfRepo(data, id);
  const components = linked(data, 'componentRepositories', 'to', id);
  const deployments = data.deployments.filter((d) => d.repositoryId === id);
  const unlink = (rel, linkId) => { run(removeLink, rel, linkId); toast('Relationship removed.'); };

  const isGitHub = repo.provider?.toLowerCase() === 'github' && !!repo.url;

  const handleSyncGitHub = async () => {
    if (syncing || !isGitHub) return;
    setSyncing(true);
    try {
      const connections = integrationConnections(data.settings.integrations);
      let token = '';
      try {
        const matched = connections.find((c) => c.provider === 'github' && repo.url.toLowerCase().includes(c.organization.toLowerCase()));
        if (matched) token = sessionStorage.getItem(`bh_token_${matched.id}`) || '';
      } catch {
        // sessionStorage unavailable
      }
      const { sync } = await syncSingleGitHubRepo(repo, connections, token);
      const res = run(applySingleRepoSync, repo, sync);
      if (res.inaccessible) {
        toast(res.error || 'Repository inaccessible (404/403). Add a GitHub token in Settings -> Integrations.', 'error');
      } else {
        toast(`Synced from GitHub: ${res.added} new commits, ${res.branches} branches, ${res.prs} PRs.`, 'success');
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <PageHeader title={repo.name}
        meta={<div className="d-flex gap-2 align-items-center"><span className="bh-id">{repo.id}</span><StatusBadge value={repo.visibility} /><AccessBadge value={repo.accessStatus} /><span className="bh-chip">{repo.provider}</span></div>}
        description={repo.description}
        actions={(
          <>
            {isGitHub && (
              <>
                <button type="button" className="btn btn-secondary" disabled={syncing} onClick={handleSyncGitHub}>
                  <RefreshCw size={16} className={syncing ? 'bh-spin' : ''} />
                  {syncing ? 'Syncing…' : 'Sync GitHub'}
                </button>
                <a href={repo.url} target="_blank" rel="noreferrer" className="btn btn-outline-secondary">
                  <ExternalLink size={16} />Open GitHub
                </a>
              </>
            )}
            <Link to={`/repositories/${id}/edit`} className="btn btn-secondary"><Pencil size={16} />Edit</Link>
            <button type="button" className="btn btn-outline-danger" onClick={() => requestDelete('repositories', id, () => navigate('/repositories'))}><Trash2 size={16} />Delete</button>
          </>
        )} />
      <div className="row g-4">
        <div className="col-xl-7">
          <div className="bh-card mb-4">
            <div className="bh-card-header colored">
              <div className="d-flex align-items-center">
                <span className="bh-card-header-icon">
                  <GitBranch size={18} />
                </span>
                <div>
                  <h3 className="bh-card-title">Repository</h3>
                  <p className="bh-card-sub">Repository configuration, branch, and upstream links</p>
                </div>
              </div>
            </div>
            <div className="bh-card-body">
              <ReviewSummary sections={[{ title: 'Repository Details', icon: GitBranch, fields: [
                { label: 'Provider', value: repo.provider }, { label: 'Organization / Group', value: repo.organization }, { label: 'Type', value: <span className="text-capitalize">{repo.type}</span> },
                { label: 'Primary Branch', value: <span className="mono">{repo.mainBranch}</span> }, { label: 'Language', value: repo.language }, { label: 'Code', value: repo.code },
                { label: 'URL', value: <ExtLink href={repo.url} />, wide: true },
                { label: 'Topics', value: (repo.topics || []).map((t) => <span key={t} className="bh-chip me-1">{t}</span>) },
                { label: 'Created', value: fmt.date(repo.createdAt) }, { label: 'Updated', value: fmt.date(repo.updatedAt) },
              ] }]} />
            </div>
          </div>
          {git && (
            <div className="bh-card mb-4">
              <div className="bh-card-header colored">
                <div className="d-flex align-items-center">
                  <span className="bh-card-header-icon">
                    <Activity size={18} />
                  </span>
                  <div>
                    <div className="d-flex gap-2 align-items-center">
                      <h3 className="bh-card-title">Development activity <span className="bh-card-count">· last 30 days</span></h3>
                      <GitSourceBadge source={gitData.source} />
                    </div>
                  </div>
                </div>
                <Link to="/progress" className="btn btn-ghost btn-sm">Progress & Review</Link>
              </div>
              <div className="bh-card-body">
                <ReviewSummary sections={[{ title: '', fields: [
                  { label: 'Commits', value: git.commits }, { label: 'Active branches', value: git.branches }, { label: 'Pull requests', value: `${git.prs} (${git.openPrs} open)` },
                  { label: 'Contributors', value: git.contributors }, { label: 'Last commit', value: fmt.date(git.lastCommitAt) },
                ] }]} />
              </div>
            </div>
          )}
          {gitData.source.kind === 'recorded' && (
            <div className="bh-card">
              <div className="bh-card-header colored">
                <div className="d-flex align-items-center">
                  <span className="bh-card-header-icon">
                    <GitBranch size={18} />
                  </span>
                  <div>
                    <div className="d-flex gap-2 align-items-center">
                      <h3 className="bh-card-title">Recorded commits <span className="bh-card-count">({recorded.length})</span></h3>
                      <GitSourceBadge source={gitData.source} />
                    </div>
                  </div>
                </div>
                <Link to="/progress" className="btn btn-ghost btn-sm">Progress & Review</Link>
              </div>
              <div className="bh-card-body">
                {recorded.length === 0 ? <div className="text-subtle">No commits recorded for this repository.</div> : (
                  <div className="d-flex flex-column gap-2">
                    {recorded.map((c) => (
                      <div key={c.id} className="d-flex gap-3 align-items-baseline">
                        <span className="text-subtle small" style={{ whiteSpace: 'nowrap', minWidth: 96 }}>{fmt.date(c.committedAt)}</span>
                        <span className="flex-grow-1 min-w-0">{c.message}</span>
                        {c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="mono small">{c.sha}</a> : <span className="mono small">{c.sha}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="col-xl-5 d-flex flex-column gap-4">
          <RelationshipCard title="Applications" subtitle="Direct links can be unlinked here"
            items={allApps.map(({ record, role }) => {
              const direct = directApps.find((d) => d.record.id === record.id);
              return { entity: 'applications', record, meta: role || 'linked', badge: <StatusBadge value={record.lifecycle} />, onUnlink: direct ? () => unlink('applicationRepositories', direct.link.id) : undefined };
            })} emptyText="No application uses this repository." />
          <RelationshipCard title="Components" subtitle="Application components implemented in this repository"
            items={components.map(({ link, record }) => ({
              key: link.id, entity: 'components', record, meta: `${applicationOfComponent(data, record.id)?.name || ''} · ${record.layer}`,
              onUnlink: () => unlink('componentRepositories', link.id),
            }))} emptyText="No component linked." />
          <RelationshipCard title="Deployments" items={deployments.map((d) => ({ entity: 'deployments', record: d, meta: d.environment, badge: <StatusBadge value={d.status} /> }))} emptyText="No deployments from this repository." />
        </div>
      </div>
      {deleteDialog}
    </>
  );
}
