import { FlaskConical, GitCommitHorizontal } from 'lucide-react';

/** Labels Git analytics with where the numbers come from. */
export default function GitSourceBadge({ source }) {
  if (source?.kind === 'recorded') {
    return <span className="bh-badge bh-tone-info" title={source.description}><GitCommitHorizontal size={12} /> {source.synced ? 'Synced snapshot' : 'Recorded snapshot'}</span>;
  }
  return <span className="bh-badge bh-tone-warning" title="Illustrative values generated locally. No Git provider is connected."><FlaskConical size={12} /> Sample data</span>;
}
