import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  Image as ImageIcon, Upload, Package, ImageOff, ExternalLink, Download, Pencil, Maximize2,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import FilterBar from '../../components/tables/FilterBar';
import TableFooter from '../../components/tables/TableFooter';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/dialogs/Modal';
import IdChip from '../../components/common/IdChip';
import StatusBadge from '../../components/badges/StatusBadge';
import { useRegistry } from '../../hooks/useRegistry';
import { usePagination } from '../../hooks/usePagination';
import { appLogoSrc } from '../../assets/logos';
import { formatBytes, triggerDownload } from '../../helpers';

function imageMeta(app) {
  const src = appLogoSrc(app);
  if (!src) return { src: null, kind: 'none', kindLabel: 'No Image', format: '—', sizeBytes: null };

  if (app.logoUrl) {
    const isData = app.logoUrl.startsWith('data:');
    if (isData) {
      const mimeMatch = app.logoUrl.match(/^data:image\/([a-z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/i);
      const format = mimeMatch ? mimeMatch[1].replace('svg+xml', 'svg').toUpperCase() : 'DATA';
      const b64 = mimeMatch?.[2] || '';
      const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
      const sizeBytes = b64 ? Math.max(0, Math.floor((b64.length * 3) / 4) - padding) : null;
      return { src, kind: 'custom', kindLabel: 'Uploaded', format, sizeBytes };
    }
    const extMatch = app.logoUrl.split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
    return { src, kind: 'custom', kindLabel: 'External URL', format: extMatch ? extMatch[1].toUpperCase() : 'URL', sizeBytes: null };
  }

  const extMatch = String(src).split('?')[0].match(/\.([a-z0-9]{2,5})$/i);
  return { src, kind: 'bundled', kindLabel: 'Built-in Asset', format: extMatch ? extMatch[1].toUpperCase() : 'PNG', sizeBytes: null };
}

export default function ImagesPage() {
  const { data } = useRegistry();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('with-image'); // with-image | custom | bundled | missing
  const [formatFilter, setFormatFilter] = useState('all');
  const [sortBy, setSortBy] = useState('id'); // id | name | updated | size
  const [preview, setPreview] = useState(null);
  const [brokenIds, setBrokenIds] = useState(() => new Set());

  const items = useMemo(
    () => data.applications.map((app) => ({ app, ...imageMeta(app) })),
    [data.applications],
  );

  const formatOptions = useMemo(
    () => [...new Set(items.filter((x) => x.kind !== 'none' && x.format !== '—').map((x) => x.format))].sort(),
    [items],
  );

  const withImageCount = items.filter((x) => x.kind !== 'none').length;
  const customCount = items.filter((x) => x.kind === 'custom').length;
  const bundledCount = items.filter((x) => x.kind === 'bundled').length;
  const missingCount = items.filter((x) => x.kind === 'none').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter((item) => {
      if (sourceFilter === 'with-image' && item.kind === 'none') return false;
      if (sourceFilter === 'custom' && item.kind !== 'custom') return false;
      if (sourceFilter === 'bundled' && item.kind !== 'bundled') return false;
      if (sourceFilter === 'missing' && item.kind !== 'none') return false;
      if (formatFilter !== 'all' && sourceFilter !== 'missing' && item.format !== formatFilter) return false;
      if (q) {
        const hay = `${item.app.id} ${item.app.name} ${item.app.code} ${item.app.category} ${item.kindLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'name') return String(a.app.name || '').localeCompare(String(b.app.name || ''));
      if (sortBy === 'updated') return (Date.parse(b.app.updatedAt) || 0) - (Date.parse(a.app.updatedAt) || 0);
      if (sortBy === 'size') return (b.sizeBytes ?? -1) - (a.sizeBytes ?? -1);
      return String(a.app.id || '').localeCompare(String(b.app.id || ''));
    });
  }, [items, search, sourceFilter, formatFilter, sortBy]);

  const paging = usePagination(filtered, 12);
  const { page: safePage, pageSize, setPage, setPageSize, pages, visible } = paging;
  const filtersActive = Boolean(search.trim() || sourceFilter !== 'with-image' || formatFilter !== 'all' || sortBy !== 'id');

  const clearFilters = () => {
    setSearch('');
    setSourceFilter('with-image');
    setFormatFilter('all');
    setSortBy('id');
    setPage(1);
  };

  const summary = [
    {
      key: 'with-image', label: 'Apps with Images', value: withImageCount, icon: ImageIcon, tone: 'orange',
      onClick: () => { setSourceFilter('with-image'); setPage(1); }, active: sourceFilter === 'with-image',
    },
    {
      key: 'custom', label: 'Uploaded / Custom', value: customCount, icon: Upload, tone: 'success',
      onClick: () => { setSourceFilter(sourceFilter === 'custom' ? 'with-image' : 'custom'); setPage(1); }, active: sourceFilter === 'custom',
    },
    {
      key: 'bundled', label: 'Built-in Assets', value: bundledCount, icon: Package, tone: 'info',
      onClick: () => { setSourceFilter(sourceFilter === 'bundled' ? 'with-image' : 'bundled'); setPage(1); }, active: sourceFilter === 'bundled',
    },
    {
      key: 'missing', label: 'Without Image', value: missingCount, icon: ImageOff, tone: 'gray',
      onClick: () => { setSourceFilter(sourceFilter === 'missing' ? 'with-image' : 'missing'); setPage(1); }, active: sourceFilter === 'missing',
    },
  ];

  const markBroken = (id) => setBrokenIds((prev) => {
    if (prev.has(id)) return prev;
    const next = new Set(prev);
    next.add(id);
    return next;
  });

  const downloadImage = (item) => {
    if (!item?.src) return;
    const ext = item.format && item.format !== 'URL' && item.format !== '—' ? item.format.toLowerCase() : 'png';
    const slug = String(item.app.code || item.app.name || item.app.id).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerDownload(item.src, `${slug}.${ext}`, { revokeAfterMs: -1 });
  };

  return (
    <>
      <PageHeader
        title="Images"
        description="Gallery of logos and images attached to registered applications."
      />

      <SummaryCards items={summary} min={170} />

      <div className="bh-card">
        <FilterBar
          search={search}
          onSearch={(val) => { setSearch(val); setPage(1); }}
          searchSize="sm"
          placeholder="Search application name, ID, code…"
          active={filtersActive}
          onClear={clearFilters}
        >
          {sourceFilter !== 'missing' && formatOptions.length > 1 && (
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              aria-label="Filter by image format"
              value={formatFilter}
              onChange={(e) => { setFormatFilter(e.target.value); setPage(1); }}
            >
              <option value="all">Format: All</option>
              {formatOptions.map((fmt) => <option key={fmt} value={fmt}>{fmt}</option>)}
            </select>
          )}
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            aria-label="Sort applications"
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          >
            <option value="id">Sort: App ID</option>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="updated">Sort: Recently updated</option>
            <option value="size">Sort: Largest file</option>
          </select>
        </FilterBar>

        {visible.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={withImageCount === 0 ? 'No application images yet' : 'No matching images'}
            message={withImageCount === 0
              ? 'Upload or link a logo when creating or editing an application to see it here.'
              : 'Try adjusting your search or filter selection.'}
          />
        ) : (
          <div className="p-3">
            <div className="row g-3">
              {visible.map((item) => {
                const { app, src, kind, kindLabel, format, sizeBytes } = item;
                const broken = brokenIds.has(app.id);
                return (
                  <div key={app.id} className="col-12 col-sm-6 col-md-4 col-xl-3">
                    <div className="border rounded-3 h-100 d-flex flex-column overflow-hidden bg-body" style={{ borderColor: 'var(--bh-border)' }}>
                      <button
                        type="button"
                        className="border-0 p-3 d-flex align-items-center justify-content-center position-relative bg-body-tertiary"
                        style={{ height: 156, cursor: src && !broken ? 'pointer' : 'default' }}
                        onClick={() => src && !broken && setPreview(item)}
                        disabled={!src || broken}
                        aria-label={src ? `Preview image for ${app.name}` : `No image for ${app.name}`}
                      >
                        {src && !broken ? (
                          <>
                            <img
                              src={src}
                              alt={app.name}
                              loading="lazy"
                              onError={() => markBroken(app.id)}
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
                            />
                            <span
                              className="position-absolute top-0 end-0 m-2 badge bg-dark bg-opacity-50 text-white d-inline-flex align-items-center gap-1"
                              style={{ fontSize: 10.5 }}
                            >
                              <Maximize2 size={10} /> {format}
                            </span>
                          </>
                        ) : (
                          <div className="text-subtle d-flex flex-column align-items-center gap-1 small">
                            <ImageOff size={24} />
                            <span>{broken ? 'Image failed to load' : 'No image'}</span>
                          </div>
                        )}
                      </button>

                      <div className="p-3 d-flex flex-column gap-2 flex-grow-1">
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <IdChip id={app.id} />
                          <span className={`bh-badge bh-tone-${kind === 'custom' ? 'success' : kind === 'bundled' ? 'info' : 'gray'}`}>
                            {kindLabel}
                          </span>
                        </div>
                        <div>
                          <Link to={`/applications/${app.id}`} className="cell-strong text-decoration-none d-block text-truncate" title={app.name}>
                            {app.name}
                          </Link>
                          <div className="text-subtle small text-truncate">
                            {app.code}{sizeBytes !== null ? ` · ${formatBytes(sizeBytes)}` : ''}
                          </div>
                        </div>
                        <div className="d-flex align-items-center justify-content-between gap-2 mt-auto pt-2 border-top" style={{ borderColor: 'var(--bh-border)' }}>
                          <StatusBadge value={app.lifecycle} />
                          <div className="d-flex align-items-center gap-1">
                            {src && !broken && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-icon btn-sm"
                                title="Download image"
                                aria-label={`Download ${app.name} image`}
                                onClick={() => downloadImage(item)}
                              >
                                <Download size={14} />
                              </button>
                            )}
                            <Link
                              to={`/applications/${app.id}/edit`}
                              className="btn btn-ghost btn-icon btn-sm"
                              title="Edit application"
                              aria-label={`Edit ${app.name}`}
                            >
                              <Pencil size={14} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <TableFooter
          page={safePage}
          pageSize={pageSize}
          total={filtered.length}
          pages={pages}
          onPage={setPage}
          onPageSize={setPageSize}
          pageSizeOptions={[12, 24, 48]}
          noun="applications"
        />
      </div>

      <Modal
        open={Boolean(preview)}
        size="lg"
        title={preview ? `${preview.app.name} (${preview.app.id})` : 'Image Preview'}
        onClose={() => setPreview(null)}
        footer={preview && (
          <>
            <button type="button" className="btn btn-outline-secondary me-auto" onClick={() => downloadImage(preview)}>
              <Download size={15} />Download
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { const id = preview.app.id; setPreview(null); navigate(`/applications/${id}`); }}
            >
              <ExternalLink size={15} />Open Application
            </button>
          </>
        )}
      >
        {preview && (
          <div className="d-flex flex-column gap-3">
            <div
              className="rounded border bg-body-tertiary d-flex align-items-center justify-content-center p-4"
              style={{ minHeight: 260, maxHeight: '60vh' }}
            >
              <img
                src={preview.src}
                alt={preview.app.name}
                style={{ maxWidth: '100%', maxHeight: '52vh', objectFit: 'contain', borderRadius: 10 }}
              />
            </div>
            <div className="d-flex flex-wrap gap-2 align-items-center small text-muted">
              <IdChip id={preview.app.id} />
              <span className="bh-chip">{preview.kindLabel}</span>
              <span className="bh-chip">{preview.format}</span>
              {preview.sizeBytes !== null && <span className="bh-chip">{formatBytes(preview.sizeBytes)}</span>}
              <StatusBadge value={preview.app.lifecycle} />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
