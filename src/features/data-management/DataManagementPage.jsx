import { useMemo, useRef, useState } from 'react';
import {
  Database, Download, Upload, RotateCcw, ShieldCheck, ShieldAlert, Files, Boxes, Link2, ListChecks, History, LayoutGrid, CheckCircle2, XCircle, AlertTriangle, FileWarning,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SummaryCards from '../../components/common/SummaryCards';
import DetailTabs from '../../components/common/DetailTabs';
import DataTable from '../../components/tables/DataTable';
import ActivityTimeline from '../../components/common/ActivityTimeline';
import ConfirmDialog from '../../components/dialogs/ConfirmDialog';
import Modal from '../../components/dialogs/Modal';
import StatusBadge from '../../components/badges/StatusBadge';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useToast } from '../../hooks/useToast';
import {
  ENTITIES, RELATIONS, OBJECT_COLLECTIONS, ENTITY_KEYS, RELATION_KEYS, SCHEMA_VERSION, STORAGE_KEY,
} from '../../services/schema';
import { validateDataset, QUALITY_CHECKS } from '../../services/validation.service';
import { buildBackup, backupFileName, downloadJson } from '../../services/export.service';
import { readBackupFile, finalizeRestore } from '../../services/import.service';
import { resetToSeed, storageUsage, readRecoveryCopy } from '../../services/storage.service';
import { recordBackup } from '../../services/registry.service';
import { formatId, nextIdNumber } from '../../services/id-generator.service';
import { LOCKED_ID_PREFIXES } from '../../services/schema';
import { formatBytes } from '../../helpers';

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
    const blob = new Blob([raw], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'brickhouse-unreadable-local-storage.json';
    a.click();
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
            <div className="bh-card h-100">
              <div className="bh-card-header"><div><h3 className="bh-card-title">Backup & Restore</h3><p className="bh-card-sub">Backups include all entities, relationship collections, catalog options, settings, activity log, ID sequences and schema version.</p></div></div>
              <div className="bh-card-body d-flex flex-column gap-3">
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
              </div>
            </div>
          </div>
          <div className="col-xl-5">
            <div className="bh-card h-100">
              <div className="bh-card-header"><h3 className="bh-card-title">Storage</h3></div>
              <div className="bh-card-body d-flex flex-column gap-2 small">
                <InfoRow label="Storage mode" value="Browser Local Storage" />
                <InfoRow label="Storage key" value={<span className="mono">{STORAGE_KEY}</span>} />
                <InfoRow label="Status" value={<StatusBadge value={health.persistence && health.status !== 'error' ? 'ok' : 'error'} label={health.persistence && health.status !== 'error' ? 'Persisting' : 'Not persisting'} />} />
                <InfoRow label="Message" value={health.message} />
                <InfoRow label="Size" value={formatBytes(usage.bytes)} />
                <InfoRow label="Initial data source" value={data.meta?.source?.startsWith('backup:') ? `Restored from ${data.meta.source.slice(7)}` : 'Seed JSON (database/)'} />
                <InfoRow label="Initialized" value={fmt.dateTime(data.meta?.initializedAt)} />
                <InfoRow label="Last restore" value={data.meta?.lastRestoreAt ? fmt.dateTime(data.meta.lastRestoreAt) : '—'} />
                {usage.hasRecovery && (
                  <div className="bh-sample-banner mt-2">
                    <FileWarning size={18} className="flex-shrink-0" />
                    <div>A copy of previously unreadable stored data was preserved. <button type="button" className="btn btn-link p-0 align-baseline" onClick={downloadRecovery}>Download it</button> for inspection.</div>
                  </div>
                )}
              </div>
            </div>
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
          ]} footerNote="seed files are read-only at runtime" />
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
            <div className="bh-card">
              <div className="bh-card-header"><h3 className="bh-card-title">Checks</h3></div>
              <div className="bh-card-body d-flex flex-column gap-2">
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
              </div>
            </div>
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
          <div className="col-xl-6"><div className="bh-card"><div className="bh-card-header"><h3 className="bh-card-title">Data operations</h3></div><div className="bh-card-body"><ActivityTimeline activities={data.activities.filter((a) => a.category === 'system').slice(-25).reverse()} /></div></div></div>
          <div className="col-xl-6"><div className="bh-card"><div className="bh-card-header"><h3 className="bh-card-title">Latest record changes</h3></div><div className="bh-card-body"><ActivityTimeline activities={data.activities.filter((a) => a.category !== 'system').slice(-25).reverse()} /></div></div></div>
        </div>
      )}

      {restore && !confirmRestore && (
        <Modal open size="lg" title="Restore preview" onClose={() => setRestore(null)}
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setRestore(null)}>Cancel</button><button type="button" className="btn btn-primary" disabled={!restore.ok} onClick={() => setConfirmRestore(true)}>Continue…</button></>}>
          {!restore.ok ? (
            <div className="bh-sample-banner" style={{ background: 'var(--bh-danger-soft)', borderColor: 'rgba(225,85,84,.35)' }}>
              <XCircle size={18} color="var(--bh-danger)" className="flex-shrink-0 mt-1" />
              <div><strong>This file cannot be restored.</strong> Current data was not changed.<ul className="mb-0 mt-2 ps-3">{restore.errors.slice(0, 12).map((e) => <li key={e}>{e}</li>)}</ul>{restore.errors.length > 12 && <div>…and {restore.errors.length - 12} more.</div>}</div>
            </div>
          ) : (
            <>
              <p><strong>{restore.fileName}</strong>{restore.exportedAt && <> · exported {fmt.dateTime(restore.exportedAt)}</>} — structure and referential integrity validated.</p>
              <div className="bh-review-grid mb-3">
                {['applications', 'repositories', 'components', 'deployments', 'apis', 'endpoints', 'technologies', 'infrastructure', 'activities'].map((k) => (
                  <div key={k}><div className="bh-review-label">{ENTITIES[k].plural}</div><div className="bh-review-value">{restore.counts[k]} <span className="text-subtle small">(now {data[k].length})</span></div></div>
                ))}
                <div><div className="bh-review-label">Relationships</div><div className="bh-review-value">{RELATION_KEYS.reduce((n, k) => n + restore.counts[k], 0)}</div></div>
              </div>
              {restore.warnings.length > 0 && <div className="bh-sample-banner"><AlertTriangle size={18} className="flex-shrink-0" /><div>{restore.warnings.length} warning(s), e.g. {restore.warnings[0]}</div></div>}
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
