import { useState } from 'react';
import { Github, Key, ExternalLink } from 'lucide-react';

/** Collapsible guide explaining GitHub Personal Access Tokens and .env storage. */
export default function GitHubTokenGuide() {
  const [showGuide, setShowGuide] = useState(true);

  return (
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
  );
}
