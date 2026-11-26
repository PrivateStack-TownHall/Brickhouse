import { useState } from 'react';
import { Info, Boxes } from 'lucide-react';
import { BERRY_FRESH_COMPONENTS, COMPONENT_GUIDE } from '../../constants/registry';
import { BERRY_FRESH_SUMMARY } from '../../constants/ui';

/** Collapsible guide explaining Component Category, Role, Type, and the Berry Fresh example. */
export default function ComponentGuidePanel() {
  const [showGuide, setShowGuide] = useState(true);

  return (
    <div className="p-3 rounded border" style={{ background: 'var(--bh-surface-muted)', borderColor: 'var(--bh-border)' }}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <Info size={16} style={{ color: 'var(--bh-orange)' }} />
          <strong className="small">Panduan Pilihan Component (Category, Role &amp; Type)</strong>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowGuide((x) => !x)}>
          {showGuide ? 'Sembunyikan' : 'Tampilkan'}
        </button>
      </div>
      {showGuide && (
        <div className="d-flex flex-column gap-3 mt-3">
          <div className="row g-3">
            {COMPONENT_GUIDE.map((group) => (
              <div className="col-md-4" key={group.title}>
                <div className="p-3 h-100 rounded border bg-body">
                  <div className="pb-2 mb-2 border-bottom">
                    <div className="fw-bold small">{group.title}</div>
                    <div className="text-subtle" style={{ fontSize: 11.5 }}>{group.subtitle}</div>
                  </div>
                  <div className="d-flex flex-column gap-2">
                    {group.items.map(([name, desc], idx) => (
                      <div key={name} className={idx < group.items.length - 1 ? 'pb-2 border-bottom' : ''}>
                        <div className="mb-1">
                          <span className="bh-chip fw-semibold" style={{ color: 'var(--bh-navy)', background: 'var(--bh-orange-soft)' }}>{name}</span>
                        </div>
                        <div className="text-muted" style={{ fontSize: 12, lineHeight: 1.45 }}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded border bg-body">
            <div className="d-flex align-items-center gap-2 pb-2 mb-3 border-bottom">
              <Boxes size={16} style={{ color: 'var(--bh-orange)' }} />
              <div>
                <div className="fw-bold small">Contoh Studi Kasus: Ekosistem Aplikasi &ldquo;Berry Fresh&rdquo;</div>
                <div className="text-subtle" style={{ fontSize: 11.5 }}>Gambaran bagaimana Application, Repository, API, Deployment, dan Component saling terhubung</div>
              </div>
            </div>

            <div className="row g-2 mb-3">
              {BERRY_FRESH_SUMMARY.map(({ icon: ItemIcon, label, items }) => (
                <div className="col-md-6 col-xl-3" key={label}>
                  <div className="p-2 h-100 rounded border" style={{ background: 'var(--bh-surface-muted)' }}>
                    <div className="d-flex align-items-center gap-1 fw-bold mb-1" style={{ fontSize: 12 }}>
                      <ItemIcon size={13} style={{ color: 'var(--bh-orange)' }} />
                      <span>{label}</span>
                    </div>
                    <ul className="mb-0 ps-3 text-muted" style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                      {items.map((text) => <li key={text}>{text}</li>)}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            <div className="fw-semibold small mb-2">Contoh Pengisian Component untuk &ldquo;Berry Fresh&rdquo;:</div>
            <div className="bh-table-wrap border rounded">
              <table className="bh-table compact mb-0" style={{ fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Component Name</th>
                    <th>Category</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Layer</th>
                    <th>Fungsi Singkat</th>
                  </tr>
                </thead>
                <tbody>
                  {BERRY_FRESH_COMPONENTS.map((ex) => (
                    <tr key={ex.name}>
                      <td className="fw-semibold text-nowrap">{ex.name}</td>
                      <td><span className="bh-chip">{ex.category}</span></td>
                      <td><span className="bh-chip">{ex.role}</span></td>
                      <td><span className="bh-chip">{ex.type}</span></td>
                      <td className="text-nowrap">{ex.layer}</td>
                      <td className="text-muted">{ex.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
