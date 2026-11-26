import { useMemo, useRef, useState } from 'react';
import {
  Database, Download, Upload, RotateCcw, ShieldCheck, ShieldAlert, Files, Boxes, Link2, ListChecks, History, LayoutGrid, CheckCircle2, XCircle, AlertTriangle, FileWarning,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import DetailTabs from '../../components/common/DetailTabs';
import SectionCard from '../../components/common/SectionCard';
import AlertBanner from '../../components/common/AlertBanner';
import DataTable from '../../components/tables/DataTable';
import FilterBar from '../../components/tables/FilterBar';
import TableFooter from '../../components/tables/TableFooter';
import ActivityTimeline from '../../components/common/ActivityTimeline';
import ConfirmDialog from '../../components/dialogs/ConfirmDialog';
import Modal from '../../components/dialogs/Modal';
import StatusBadge from '../../components/badges/StatusBadge';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import {
  ENTITIES, RELATIONS, OBJECT_COLLECTIONS, ENTITY_KEYS, RELATION_KEYS, SCHEMA_VERSION, STORAGE_KEY, LOCKED_ID_PREFIXES,
} from '../../services/schema';
import { validateDataset, QUALITY_CHECKS } from '../../services/validation.service';
import { buildBackup, backupFileName, downloadJson } from '../../services/export.service';
import { readBackupFile, finalizeRestore } from '../../services/import.service';
import { resetToSeed, storageUsage, readRecoveryCopy } from '../../services/storage.service';
import { recordBackup } from '../../services/registry.service';
import { formatId, nextIdNumber } from '../../services/id-generator.service';
import { formatBytes, localDateKey, triggerDownload } from '../../helpers';

const SECTIONS = [
  { key: 'overview', label: 'Data Overview', icon: LayoutGrid },
  { key: 'datasets', label: 'Datasets', icon: Files },
  { key: 'entities', label: 'Entities', icon: Boxes },
  { key: 'relationships', label: 'Relationships', icon: Link2 },
  { key: 'quality', label: 'Data Quality', icon: ListChecks },
  { key: 'history', label: 'Change History', icon: History },
];

export default function DataManagementPage() {
  const { data, health, run, replaceDataset, getData } = useRegistry();
  const fmt = useFormat();
  const toast = useToast();
  const [section, setSection] = useState('overview');
  const [restore, setRestore] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef(null);
  const issues = useMemo(() => validateDataset(data), [data]);
  const errors = issues.filter((i) => i.severity === 'error');
  const usage = storageUsage();

  const entityRecords = ENTITY_KEYS.filter((k) => k !== 'activities').reduce((n, k) => n + data[k].length, 0);
  const relationRecords = RELATION_KEYS.reduce((n, k) => n + data[k].length, 0);
  const health100 = errors.length === 0 ? (issues.length === 0 ? 'Healthy' : 'Warnings') : 'Errors';

  const backup = () => {
    downloadJson(buildBackup(data), backupFileName());
    run(recordBackup);
    toast('Full JSON backup downloaded.');
  };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestore(await readBackupFile(file));
  };
  const applyRestore = () => {
    replaceDataset(finalizeRestore(restore.dataset, restore.fileName, getData()));
    setRestore(null);
    setConfirmRestore(false);
    toast('Backup restored and validated.');
  };
  const doReset = () => {
    const { dataset } = resetToSeed(getData());
    replaceDataset(dataset);
    setConfirmReset(false);
    toast('Registry reset to seed data.');
  };
  const downloadRecovery = () => {
    const raw = readRecoveryCopy();
    if (!raw) return;
    triggerDownload(new Blob([raw], { type: 'application/json' }), 'brickhouse-unreadable-local-storage.json');
  };

  const summary = [
    { label: 'Total Records', value: entityRecords + relationRecords + data.activities.length, icon: Database, tone: 'orange', hint: 'entities + links + activities' },
    { label: 'Total Entities', value: entityRecords, icon: Boxes, tone: 'navy' },
    { label: 'Total Relationships', value: relationRecords, icon: Link2, tone: 'info' },
    { label: 'Data Health', value: health100, icon: errors.length ? ShieldAlert : ShieldCheck, tone: errors.length ? 'danger' : issues.length ? 'warning' : 'success', hint: `${errors.length} errors · ${issues.length - errors.length} warnings` },
    { label: 'Last Backup', value: data.meta?.lastBackupAt ? fmt.relative(data.meta.lastBackupAt) : 'Never', icon: Download, tone: data.meta?.lastBackupAt ? 'success' : 'warning' },
    { label: 'Schema Version', value: `v${data.schemaVersion}`, icon: Files, tone: 'gray', hint: `app supports v${SCHEMA_VERSION}` },
  ];

  const datasetRows = [
    ...ENTITY_KEYS.map((k) => ({ key: k, file: ENTITIES[k].file, kind: ENTITIES[k].group === 'catalog' ? 'Catalog' : ENTITIES[k].group === 'system' ? 'System' : 'Core entity', records: data[k].length })),
    ...RELATION_KEYS.map((k) => ({ key: k, file: RELATIONS[k].file, kind: RELATIONS[k].extension ? 'Relationship (extension)' : 'Relationship', records: data[k].length })),
    ...Object.entries(OBJECT_COLLECTIONS).map(([k, d]) => ({ key: k, file: d.file, kind: 'Object', records: Object.keys(data[k] || {}).length })),
  ];
  const issueCount = (collection) => issues.filter((i) => i.collection === collection).length;

  return (
    <>
      <PageHeader title="Data Management" description="Registry integrity, backups and restore. This is the only place for JSON backup, restore and reset." />
      <SummaryCards items={summary} min={165} />
      <DetailTabs tabs={SECTIONS.map((s) => (s.key === 'quality' ? { ...s, count: issues.length } : s))} active={section} onChange={setSection} />

      {section === 'overview' && (
        <div className="row g-4">
          <div className="col-xl-7">
            <SectionCard
              flush={false}
              title="Backup & Restore"
              subtitle="Backups include all entities, relationship collections, catalog options, settings, activity log, ID sequences and schema version."
              bodyClassName="d-flex flex-column gap-3"
            >
              <ActionRow icon={Download} tone="success" title="Full JSON Backup" text="Download the complete runtime dataset as one JSON file.">
                <button type="button" className="btn btn-primary" onClick={backup}><Download size={16} />Download Backup</button>
              </ActionRow>
              <ActionRow icon={Upload} tone="info" title="JSON Restore" text="Validated before anything is replaced. You will see a preview and must confirm.">
                <input ref={fileRef} type="file" accept="application/json,.json" className="d-none" onChange={onFile} />
                <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}><Upload size={16} />Choose Backup File</button>
              </ActionRow>
              <ActionRow icon={RotateCcw} tone="danger" title="Reset to Seed Data" text="Replaces all runtime data with the original seed JSON. Requires typed confirmation.">
                <button type="button" className="btn btn-outline-danger" onClick={() => setConfirmReset(true)}><RotateCcw size={16} />Reset…</button>
              </ActionRow>
            </SectionCard>
          </div>
          <div className="col-xl-5">
            <SectionCard flush={false} title="Storage" bodyClassName="d-flex flex-column gap-2 small">
              <InfoRow label="Storage mode" value={health.storageMode === 'json-files' ? 'Local JSON Files (database/) + Local Storage' : 'Browser Local Storage'} />
              <InfoRow label="Storage key" value={<span className="mono">{STORAGE_KEY}</span>} />
              <InfoRow label="Status" value={<StatusBadge value={health.persistence && health.status !== 'error' ? 'ok' : 'error'} label={health.persistence && health.status !== 'error' ? 'Persisting' : 'Not persisting'} />} />
              <InfoRow label="Message" value={health.message} />
              <InfoRow label="Size" value={formatBytes(usage.bytes)} />
              <InfoRow label="Initial data source" value={data.meta?.source?.startsWith('backup:') ? `Restored from ${data.meta.source.slice(7)}` : data.meta?.source === 'database' ? 'Local JSON Files (database/)' : 'Seed JSON (database/)'} />
              <InfoRow label="Initialized" value={fmt.dateTime(data.meta?.initializedAt)} />
              <InfoRow label="Last restore" value={data.meta?.lastRestoreAt ? fmt.dateTime(data.meta.lastRestoreAt) : '—'} />
              {usage.hasRecovery && (
                <AlertBanner tone="warning" icon={FileWarning} className="mt-2">
                  A copy of previously unreadable stored data was preserved. <button type="button" className="btn btn-link p-0 align-baseline" onClick={downloadRecovery}>Download it</button> for inspection.
                </AlertBanner>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {section === 'datasets' && (
        <div className="bh-card">
          <DataTable rows={datasetRows} rowKey={(r) => r.key} pageSize={40} columns={[
            { key: 'file', label: 'File', render: (r) => <span className="mono">database/{r.file}</span> },
            { key: 'key', label: 'Collection', render: (r) => <span className="mono">{r.key}</span> },
            { key: 'kind', label: 'Kind' },
            { key: 'records', label: 'Records', align: 'right' },
            { key: 'issues', label: 'Issues', align: 'right', sortValue: (r) => issueCount(r.key), render: (r) => (issueCount(r.key) ? <span className="text-danger fw-semibold">{issueCount(r.key)}</span> : <CheckCircle2 size={15} color="var(--bh-success)" />) },
          ]} footerNote={health.storageMode === 'json-files' ? 'CRUD changes are saved automatically to database/*.json' : 'seed files are read-only in static mode'} />
        </div>
      )}

      {section === 'entities' && (
        <div className="bh-card">
          <DataTable rows={ENTITY_KEYS.map((k) => ({ key: k, ...ENTITIES[k], records: data[k].length, next: formatId(ENTITIES[k].prefix, nextIdNumber(data, ENTITIES[k].prefix)), locked: LOCKED_ID_PREFIXES.includes(ENTITIES[k].prefix) }))} rowKey={(r) => r.key} pageSize={20} columns={[
            { key: 'plural', label: 'Entity' },
            { key: 'prefix', label: 'ID Prefix', render: (r) => <span className="bh-id">{r.prefix}</span> },
            { key: 'records', label: 'Records', align: 'right' },
            { key: 'next', label: 'Next ID', render: (r) => <span className="bh-id">{r.next}</span> },
            { key: 'locked', label: 'ID policy', render: (r) => (r.locked ? 'Never reused' : 'Lowest free number') },
            { key: 'required', label: 'Required fields', sortable: false, render: (r) => <span className="text-muted small">{(r.required || []).join(', ')}</span> },
          ]} footerNote="deleted IDs are given out again (lowest free number), except API and Activity IDs" />
        </div>
      )}

      {section === 'relationships' && (
        <div className="bh-card">
          <DataTable rows={RELATION_KEYS.map((k) => ({ key: k, ...RELATIONS[k], records: data[k].length, invalid: issues.filter((i) => i.collection === k && i.type === 'orphaned-relationship').length }))} rowKey={(r) => r.key} pageSize={20} columns={[
            { key: 'label', label: 'Relationship', render: (r) => <span className="fw-semibold">{r.label}{r.extension && <span className="bh-chip ms-2">extension</span>}</span> },
            { key: 'from', label: 'From → To', sortable: false, render: (r) => <span className="mono small">{r.from.field} → {r.to.field}</span> },
            { key: 'prefix', label: 'ID Prefix', render: (r) => <span className="bh-id">{r.prefix}</span> },
            { key: 'records', label: 'Links', align: 'right' },
            { key: 'invalid', label: 'Orphaned', align: 'right', render: (r) => (r.invalid ? <span className="text-danger fw-semibold">{r.invalid}</span> : '0') },
          ]} />
        </div>
      )}

      {section === 'quality' && (
        <div className="row g-4">
          <div className="col-xl-4">
            <SectionCard flush={false} fullHeight={false} title="Checks" bodyClassName="d-flex flex-column gap-2">
              {QUALITY_CHECKS.map((c) => {
                const n = issues.filter((i) => i.type === c.type).length;
                return (
                  <div key={c.type} className="d-flex justify-content-between align-items-center">
                    <span className="d-flex gap-2 align-items-center">{n ? <XCircle size={16} color="var(--bh-danger)" /> : <CheckCircle2 size={16} color="var(--bh-success)" />}{c.label}</span>
                    <span className={n ? 'fw-bold text-danger' : 'text-subtle'}>{n}</span>
                  </div>
                );
              })}
              <div className="d-flex justify-content-between align-items-center"><span className="d-flex gap-2 align-items-center"><AlertTriangle size={16} color="var(--bh-warning)" />Other warnings</span><span className="text-subtle">{issues.filter((i) => !QUALITY_CHECKS.some((c) => c.type === i.type)).length}</span></div>
            </SectionCard>
          </div>
          <div className="col-xl-8">
            <div className="bh-card">
              <DataTable rows={issues.map((i, n) => ({ ...i, key: n }))} rowKey={(r) => r.key} pageSize={15}
                empty={<div className="bh-empty"><ShieldCheck size={28} color="var(--bh-success)" /><div className="fw-semibold mt-2">All data-quality checks pass</div></div>}
                columns={[
                  { key: 'severity', label: 'Severity', render: (i) => <StatusBadge value={i.severity} /> },
                  { key: 'type', label: 'Check', render: (i) => QUALITY_CHECKS.find((c) => c.type === i.type)?.label || i.type },
                  { key: 'collection', label: 'Collection', render: (i) => <span className="mono small">{i.collection}</span> },
                  { key: 'message', label: 'Detail', sortable: false },
                ]} />
            </div>
          </div>
        </div>
      )}

      {section === 'history' && (
        <div className="row g-4">
          <div className="col-xl-6">
            <HistoryPanel
              title="Data operations"
              subtitle="System backups, restores, migrations, and configuration updates"
              activities={data.activities.filter((a) => a.category === 'system')}
              empty="No data operations recorded yet."
            />
          </div>
          <div className="col-xl-6">
            <HistoryPanel
              title="Latest record changes"
              subtitle="Entity creations, updates, deletions, and relationship changes"
              activities={data.activities.filter((a) => a.category !== 'system')}
              empty="No record changes recorded yet."
            />
          </div>
        </div>
      )}

      {restore && !confirmRestore && (
        <Modal open size="lg" title="Restore preview" onClose={() => setRestore(null)}
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setRestore(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={!restore.ok} onClick={() => setConfirmRestore(true)}>Continue…</button></>}>
          {!restore.ok ? (
            <AlertBanner tone="danger" icon={XCircle}>
              <strong>This file cannot be restored.</strong> Current data was not changed.<ul className="mb-0 mt-2 ps-3">{restore.errors.slice(0, 12).map((e) => <li key={e}>{e}</li>)}</ul>{restore.errors.length > 12 && <div>…and {restore.errors.length - 12} more.</div>}
            </AlertBanner>
          ) : (
            <>
              <p><strong>{restore.fileName}</strong>{restore.exportedAt && <> · exported {fmt.dateTime(restore.exportedAt)}</>} — structure and referential integrity validated.</p>
              <div className="bh-review-grid mb-3">
                {['applications', 'repositories', 'components', 'deployments', 'apis', 'endpoints', 'technologies', 'infrastructure', 'activities'].map((k) => (
                  <div key={k}><div className="bh-review-label">{ENTITIES[k].plural}</div><div className="bh-review-value">{restore.counts[k]} <span className="text-subtle small">(now {data[k].length})</span></div></div>
                ))}
                <div><div className="bh-review-label">Relationships</div><div className="bh-review-value">{RELATION_KEYS.reduce((n, k) => n + restore.counts[k], 0)}</div></div>
              </div>
              {restore.warnings.length > 0 && <AlertBanner tone="warning" icon={AlertTriangle}>{restore.warnings.length} warning(s), e.g. {restore.warnings[0]}</AlertBanner>}
            </>
          )}
        </Modal>
      )}
      <ConfirmDialog open={confirmRestore} title="Replace current data?" tone="danger" confirmLabel="Restore Backup" requireText="RESTORE"
        message="All current runtime data will be replaced by the backup. Download a backup of the current data first if you may need it."
        onConfirm={applyRestore} onCancel={() => setConfirmRestore(false)}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={backup}><Download size={14} />Download current data first</button>
      </ConfirmDialog>
      <ConfirmDialog open={confirmReset} title="Reset to seed data?" tone="danger" confirmLabel="Reset Registry" requireText="RESET"
        message="Every record, relationship, setting and activity entry created since initialization will be replaced by the seed JSON dataset."
        onConfirm={doReset} onCancel={() => setConfirmReset(false)}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={backup}><Download size={14} />Download a backup first</button>
      </ConfirmDialog>
    </>
  );
}

function ActionRow({ icon: Icon, tone, title, text, children }) {
  return (
    <div className="d-flex gap-3 align-items-center flex-wrap p-3" style={{ border: '1px solid var(--bh-border)', borderRadius: 'var(--bh-radius-md)' }}>
      <span className={`bh-stat-icon bh-tone-${tone}`}><Icon size={18} /></span>
      <div className="flex-grow-1 min-w-0" style={{ flexBasis: 220 }}><div className="fw-bold">{title}</div><div className="text-muted small">{text}</div></div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return <div className="d-flex justify-content-between gap-3"><span className="text-subtle">{label}</span><span className="text-end">{value}</span></div>;
}

function HistoryPanel({ title, subtitle, activities, empty }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Default to latest changes first (descending by timestamp).
  const ordered = useMemo(
    () => [...activities].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)),
    [activities],
  );

  const filtered = useMemo(() => {
    if (!fromDate && !toDate) return ordered;
    return ordered.filter((a) => {
      const d = localDateKey(a.timestamp);
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [ordered, fromDate, toDate]);

  const { page: safePage, pageSize, setPage, setPageSize, pages, visible } = usePagination(filtered, 10);

  return (
    <SectionCard flush={false} noBody title={title} count={filtered.length} subtitle={subtitle}>
      <FilterBar
        active={Boolean(fromDate || toDate)}
        clearLabel="Reset date"
        onClear={() => { setFromDate(''); setToDate(''); setPage(1); }}
      >
        <label className="d-flex align-items-center gap-2 m-0 small text-muted">
          <span>From</span>
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ width: 'auto', minHeight: 32 }}
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          />
        </label>
        <label className="d-flex align-items-center gap-2 m-0 small text-muted">
          <span>To</span>
          <input
            type="date"
            className="form-control form-control-sm"
            style={{ width: 'auto', minHeight: 32 }}
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          />
        </label>
      </FilterBar>
      <div className="bh-card-body flex-grow-1">
        <ActivityTimeline
          activities={visible}
          empty={(fromDate || toDate) ? 'No changes found in the selected date range.' : empty}
        />
      </div>
      <TableFooter
        page={safePage}
        pageSize={pageSize}
        total={filtered.length}
        pages={pages}
        onPage={setPage}
        onPageSize={setPageSize}
        pageSizeOptions={[5, 10, 25, 50]}
        noun="changes"
      />
    </SectionCard>
  );
}
