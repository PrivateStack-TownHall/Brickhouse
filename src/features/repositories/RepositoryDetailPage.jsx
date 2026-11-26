import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { GitBranch, Activity, RefreshCw, ExternalLink } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DetailActions from '../../components/common/DetailActions';
import SectionCard from '../../components/common/SectionCard';
import StatusBadge from '../../components/badges/StatusBadge';
import ReviewSummary from '../../components/common/ReviewSummary';
import RelationshipCard from '../../components/common/RelationshipCard';
import ChipList from '../../components/common/ChipList';
import DataTable from '../../components/tables/DataTable';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useToast } from '../../hooks/useToast';
import { useNotifications } from '../../hooks/useNotifications';
import { useDeleteRecord } from '../../hooks/useDeleteRecord';
import { linked, applicationOfComponent, applicationsOfRepo } from '../../services/query.service';
import { removeLink } from '../../services/registry.service';
import { buildGitData, summarizeGit } from '../../services/git-analytics.service';
import { integrationConnections, fetchServerTokenStatus, syncSingleGitHubRepo, applySingleRepoSync } from '../../services/git-integrations.service';
import GitSourceBadge from '../../components/badges/GitSourceBadge';
import ExtLink from '../../components/common/ExtLink';
import AccessBadge from '../../components/badges/AccessBadge';
import Avatar from '../../components/common/Avatar';
import { appLogoSrc } from '../../assets/logos';
import { REPOSITORY_ACTIVITY_PERIODS } from '../../constants/ui';
import NotFoundPage from '../overview/NotFoundPage';

export default function RepositoryDetailPage() {
  const { id } = useParams();
  const { data, run } = useRegistry();
  const fmt = useFormat();
  const toast = useToast();
  const { notify } = useNotifications();
  const navigate = useNavigate();
  const [requestDelete, deleteDialog] = useDeleteRecord();
  const [syncing, setSyncing] = useState(false);
  const [activityPeriod, setActivityPeriod] = useState('all');

  const repo = data.repositories.find((r) => r.id === id);
  const gitData = useMemo(() => buildGitData(data), [data]);
  const recorded = useMemo(() => gitData.commits.filter((c) => c.repositoryId === id), [gitData.commits, id]);

  const git = useMemo(() => {
    if (!repo) return null;
    if (activityPeriod === 'all') {
      const yearStats = summarizeGit(gitData, { days: 365, repositoryIds: new Set([id]) }).byRepo[0];
      const allAuthors = new Set(recorded.map((c) => c.author).filter(Boolean));
      const allPrs = Array.isArray(repo.syncedPrs) ? repo.syncedPrs : (yearStats?.prList || []);
      const openPrs = allPrs.filter((p) => p.status === 'open').length;
      const branchCount = Array.isArray(repo.syncedBranches) ? repo.syncedBranches.length : (yearStats?.totalBranches ?? yearStats?.branches ?? 0);
      return {
        commits: recorded.length || yearStats?.commits || 0,
        branches: branchCount,
        prs: allPrs.length,
        openPrs,
        contributors: allAuthors.size || yearStats?.contributors || 0,
        lastCommitAt: recorded[0]?.committedAt || yearStats?.lastCommitAt || null,
      };
    }
    return summarizeGit(gitData, { days: Number(activityPeriod), repositoryIds: new Set([id]) }).byRepo[0];
  }, [activityPeriod, gitData, id, recorded, repo]);

  if (!repo) return <NotFoundPage />;
  const directApps = linked(data, 'applicationRepositories', 'to', id);
  const allApps = applicationsOfRepo(data, id);
  const components = linked(data, 'componentRepositories', 'to', id);
  const deployments = data.deployments.filter((d) => d.repositoryId === id);
  const unlink = (rel, linkId) => { run(removeLink, rel, linkId); toast('Relationship removed.'); };

  const isGitHub = repo.provider?.toLowerCase() === 'github' && !!repo.url;
  const periodLabel = REPOSITORY_ACTIVITY_PERIODS.find((p) => p.value === activityPeriod)?.label.toLowerCase() || 'all recorded';

  const handleSyncGitHub = async () => {
    if (syncing || !isGitHub) return;
    setSyncing(true);
    try {
      const connections = integrationConnections(data.settings.integrations);
      const matched = connections.find((c) => c.provider === 'github' && repo.url.toLowerCase().includes(c.organization.toLowerCase()));
      const probeConn = matched || { id: 'direct-github-sync', provider: 'github', organization: new URL(repo.url).pathname.split('/').filter(Boolean)[0] || '' };
      const status = await fetchServerTokenStatus([probeConn]);
      const useServerToken = Boolean(status.statuses?.[probeConn.id]?.configured);
      const { sync } = await syncSingleGitHubRepo(repo, connections, '', { useServerToken });
      const res = run(applySingleRepoSync, repo, sync);
      if (res.inaccessible) {
        const msg = res.error || 'Repository inaccessible (404/403). Add a GitHub token in Settings -> Integrations.';
        toast(msg, 'error', { skipNotification: true });
        notify({ kind: 'sync', tone: 'danger', title: `GitHub sync failed · ${repo.name}`, message: msg, to: `/repositories/${repo.id}` });
      } else {
        const msg = `Synced ${res.added} new commits, ${res.branches} branches, ${res.prs} PRs.`;
        toast(`Synced from GitHub: ${res.added} new commits, ${res.branches} branches, ${res.prs} PRs.`, 'success');
        notify({ kind: 'sync', tone: 'success', title: `GitHub sync · ${repo.name}`, message: msg, to: `/repositories/${repo.id}` });
      }
    } catch (e) {
      toast(e.message, 'error', { skipNotification: true });
      notify({ kind: 'sync', tone: 'danger', title: `GitHub sync failed · ${repo.name}`, message: e.message, to: `/repositories/${repo.id}` });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <PageHeader title={repo.name}
        avatar={<Avatar name={repo.name} seed={repo.id} src={appLogoSrc(allApps[0])} size={48} />}
        meta={<div className="d-flex gap-2 align-items-center"><span className="bh-id">{repo.id}</span><StatusBadge value={repo.visibility} /><AccessBadge value={repo.accessStatus} /><span className="bh-chip">{repo.provider}</span></div>}
        description={repo.description}
        actions={(
          <DetailActions editTo={`/repositories/${id}/edit`} onDelete={() => requestDelete('repositories', id, () => navigate('/repositories'))}>
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
          </DetailActions>
        )} />
      <div className="row g-4">
        <div className="col-xl-7">
          <SectionCard variant="colored" fullHeight={false} className="mb-4" icon={GitBranch} title="Repository" subtitle="Repository configuration, branch, and upstream links">
            <ReviewSummary sections={[{ title: 'Repository Details', icon: GitBranch, fields: [
              { label: 'Provider', value: repo.provider }, { label: 'Organization / Group', value: repo.organization }, { label: 'Type', value: <span className="text-capitalize">{repo.type}</span> },
              { label: 'Primary Branch', value: <span className="mono">{repo.mainBranch}</span> }, { label: 'Language', value: repo.language }, { label: 'Code', value: repo.code },
              { label: 'URL', value: <ExtLink href={repo.url} />, wide: true },
              { label: 'Topics', value: <ChipList items={repo.topics} /> },
              { label: 'Created', value: fmt.date(repo.createdAt) }, { label: 'Updated', value: fmt.date(repo.updatedAt) },
            ] }]} />
          </SectionCard>
          {git && (
            <SectionCard
              variant="colored"
              fullHeight={false}
              className="mb-4"
              headerClassName="flex-wrap"
              icon={Activity}
              title="Development activity"
              count={`· ${periodLabel}`}
              badge={<GitSourceBadge source={gitData.source} />}
              actions={(
                <div className="d-flex align-items-center gap-2">
                  <select
                    aria-label="Activity period"
                    className="form-select form-select-sm"
                    value={activityPeriod}
                    onChange={(e) => setActivityPeriod(e.target.value)}
                    style={{
                      width: 'auto',
                      backgroundColor: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      borderColor: 'rgba(255,255,255,0.22)',
                    }}
                  >
                    {REPOSITORY_ACTIVITY_PERIODS.map((p) => (
                      <option key={p.value} value={p.value} style={{ color: '#0f2d4a' }}>{p.label}</option>
                    ))}
                  </select>
                  <Link to="/progress" className="btn btn-ghost btn-sm">Progress & Review</Link>
                </div>
              )}
            >
              <ReviewSummary sections={[{ title: '', fields: [
                { label: 'Commits', value: git.commits },
                { label: 'Active branches', value: git.branches },
                { label: 'Pull requests', value: `${git.prs} (${git.openPrs} open)` },
                { label: 'Contributors', value: git.contributors },
                { label: 'Last commit', value: git.lastCommitAt ? fmt.date(git.lastCommitAt) : '—' },
              ] }]} />
            </SectionCard>
          )}
          {gitData.source.kind === 'recorded' && (
            <SectionCard
              variant="colored"
              fullHeight={false}
              noBody
              icon={GitBranch}
              title="Recorded commits"
              count={recorded.length}
              badge={<GitSourceBadge source={gitData.source} />}
              actions={<Link to="/progress" className="btn btn-ghost btn-sm">Progress & Review</Link>}
            >
              <DataTable
                rows={recorded}
                rowKey={(c) => c.id}
                pageSize={5}
                initialSort={{ key: 'committedAt', dir: 'desc' }}
                noun="commits"
                empty={<div className="p-4 text-subtle">No commits recorded for this repository.</div>}
                columns={[
                  {
                    key: 'committedAt',
                    label: 'Date',
                    sortValue: (c) => new Date(c.committedAt).getTime(),
                    render: (c) => <span className="text-nowrap">{fmt.date(c.committedAt)}</span>,
                  },
                  {
                    key: 'message',
                    label: 'Commit Name',
                    render: (c) => (
                      <div className="min-w-0">
                        <div className="fw-medium">{c.message}</div>
                        {c.author && <div className="text-subtle" style={{ fontSize: 12 }}>by {c.author}</div>}
                      </div>
                    ),
                  },
                  {
                    key: 'sha',
                    label: 'Commit ID',
                    align: 'right',
                    render: (c) => {
                      const shortSha = (c.sha || '').slice(0, 7);
                      return c.url ? (
                        <ExtLink href={c.url} className="bh-idchip text-decoration-none" iconSize={11} title={c.sha}>
                          <span>{shortSha}</span>
                        </ExtLink>
                      ) : (
                        <span className="bh-idchip" title={c.sha}>{shortSha}</span>
                      );
                    },
                  },
                ]}
              />
            </SectionCard>
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
