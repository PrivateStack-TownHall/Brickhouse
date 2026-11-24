import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  SlidersHorizontal, MonitorCog, Building2, ListTree, PlugZap, DatabaseBackup, Info, Plus, X, Save, Lock, ArrowRight,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import DataTable from '../../components/tables/DataTable';
import RowActions from '../../components/tables/RowActions';
import Modal from '../../components/dialogs/Modal';
import Segmented from '../../components/common/Segmented';
import StatusBadge from '../../components/badges/StatusBadge';
import { useRegistry } from '../../hooks/useRegistry';
import { useFormat } from '../../hooks/useFormat';
import { useToast } from '../../hooks/useToast';
import { updateSettings, updateEntity, updateCategories, ValidationError } from '../../services/registry.service';
import { APP_VERSION, SCHEMA_VERSION, STORAGE_KEY } from '../../services/schema';
import { DATE_FORMATS, TIME_FORMATS, formatDate, formatTime, cx } from '../../helpers';
import fullLogo from '../../assets/logos/brickhouse-logo-full.png';
import Integrations from './Integrations';

const SECTIONS = [
  { key: 'general', label: 'General Settings', icon: SlidersHorizontal },
  { key: 'preferences', label: 'System Preferences', icon: MonitorCog },
  { key: 'companies', label: 'Companies', icon: Building2 },
  { key: 'registry', label: 'Registry Configuration', icon: ListTree },
  { key: 'integrations', label: 'Integrations', icon: PlugZap },
  { key: 'data', label: 'Data & Backup', icon: DatabaseBackup },
  { key: 'system', label: 'System Information', icon: Info },
];

export default function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const section = SECTIONS.some((s) => s.key === params.get('section')) ? params.get('section') : 'general';
  return (
    <>
      <PageHeader title="Settings" description="Configure BRICKHOUSE for this single-user, local-first workspace." />
      <div className="row g-4">
        <div className="col-lg-3">
          <div className="bh-card p-2">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" className={cx('bh-dropdown-item', section === key && 'fw-bold')} style={section === key ? { background: 'var(--bh-orange-soft)', color: 'var(--bh-orange)' } : undefined}
                onClick={() => setParams({ section: key })}><Icon size={16} />{label}</button>
            ))}
          </div>
        </div>
        <div className="col-lg-9">
          {section === 'general' && <General />}
          {section === 'preferences' && <Preferences />}
          {section === 'companies' && <Companies />}
          {section === 'registry' && <RegistryConfig />}
          {section === 'integrations' && <Integrations />}
          {section === 'data' && <DataBackup />}
          {section === 'system' && <SystemInfo />}
        </div>
      </div>
    </>
  );
}

function Section({ title, description, children, footer }) {
  return (
    <div className="bh-card">
      <div className="bh-card-header"><div><h3 className="bh-card-title">{title}</h3>{description && <p className="bh-card-sub">{description}</p>}</div></div>
      <div className="bh-card-body">{children}</div>
      {footer && <div className="bh-wizard-footer justify-content-end">{footer}</div>}
    </div>
  );
}

function General() {
  const { data, run } = useRegistry();
  const toast = useToast();
  const [v, setV] = useState(data.settings.general);
  const dirty = JSON.stringify(v) !== JSON.stringify(data.settings.general);
  const save = () => { run(updateSettings, 'general', v, 'Updated general settings.'); toast('General settings saved.'); };
  return (
    <Section title="General Settings" description="Name and identity of this registry."
      footer={<button type="button" className="btn btn-primary" disabled={!dirty || !v.appName.trim()} onClick={save}><Save size={16} />Save</button>}>
      <div className="row">
        <div className="col-md-6"><FormField label="Application Name" required value={v.appName} onChange={(e) => setV({ ...v, appName: e.target.value })} error={!v.appName.trim() ? 'Required.' : undefined} /></div>
        <div className="col-md-6"><FormField label="Organization" value={v.organization} onChange={(e) => setV({ ...v, organization: e.target.value })} /></div>
        <div className="col-12"><FormTextarea label="Description" rows={2} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></div>
        <div className="col-md-6"><FormField label="Registry owner (activity actor)" value={v.ownerName} onChange={(e) => setV({ ...v, ownerName: e.target.value })} help="Shown as the actor in the Activity Log. Not an account — v1.0 has no authentication." /></div>
        <div className="col-md-6"><FormField label="Theme" value={v.theme} disabled help="The canonical Brickhouse design system. Light/dark mode is under System Preferences." /></div>
        <div className="col-12">
          <label className="form-label">Logo</label>
          <div className="d-flex gap-3 align-items-center flex-wrap">
            <img src={fullLogo} alt="Brickhouse logo" style={{ width: 200, borderRadius: 12, background: '#fcf7f3', padding: 12 }} />
            <div className="text-muted small" style={{ maxWidth: 360 }}>The provided Brickhouse house identity is the primary brand mark and is used in the sidebar and browser tab. It is part of the application assets (<span className="mono">src/assets/logos</span>).</div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Preferences() {
  const { data, run } = useRegistry();
  const toast = useToast();
  const p = data.settings.preferences;
  const set = (k, val) => { run(updateSettings, 'preferences', { [k]: val }, `Preference "${k}" set to ${val}.`); toast('Preference saved.'); };
  const now = new Date();
  return (
    <Section title="System Preferences" description="Applied immediately and saved locally.">
      <div className="mb-4">
        <label className="form-label d-block">Appearance</label>
        <Segmented ariaLabel="Theme mode" options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'system', label: 'System' }]} value={p.themeMode} onChange={(x) => set('themeMode', x)} />
      </div>
      <div className="row">
        <div className="col-md-6"><FormSelect label="Date Format" options={DATE_FORMATS.map((f) => ({ value: f, label: `${f}  ·  ${formatDate(now, f)}` }))} value={p.dateFormat} onChange={(x) => x && set('dateFormat', x)} /></div>
        <div className="col-md-6"><FormSelect label="Time Format" options={TIME_FORMATS.map((f) => ({ value: f, label: `${f === '24h' ? '24-hour' : '12-hour'}  ·  ${formatTime(now, f)}` }))} value={p.timeFormat} onChange={(x) => x && set('timeFormat', x)} /></div>
      </div>
    </Section>
  );
}

function Companies() {
  const { data, run } = useRegistry();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [errors, setErrors] = useState({});
  const save = () => {
    try {
      run(updateEntity, 'companies', editing.id, { name: editing.name, code: editing.code, description: editing.description, websiteUrl: editing.websiteUrl });
      toast(`Company ${editing.id} updated.`);
      setEditing(null);
      setErrors({});
    } catch (e) { if (e instanceof ValidationError) setErrors(e.errors); else toast(e.message, 'error'); }
  };
  return (
    <Section title="Companies" description="The five VSG Group company profiles that own applications. Additional companies require explicit approval and are not created here.">
      <div className="bh-card" style={{ boxShadow: 'none' }}>
        <DataTable rows={data.companies} pageSize={10} columns={[
          { key: 'id', label: 'ID', render: (c) => <span className="bh-id">{c.id}</span> },
          { key: 'code', label: 'Code', render: (c) => <span className="bh-chip">{c.code}</span> },
          { key: 'name', label: 'Company', render: (c) => <span className="fw-semibold">{c.name}</span> },
          { key: 'apps', label: 'Applications', align: 'right', sortValue: (c) => data.applications.filter((a) => a.ownerId === c.id).length, render: (c) => data.applications.filter((a) => a.ownerId === c.id).length },
          { key: 'description', label: 'Description', sortable: false, render: (c) => <span className="text-muted small">{c.description || '—'}</span> },
          { key: 'actions', label: '', sortable: false, render: (c) => <RowActions label={c.name} onEdit={() => { setEditing({ ...c }); setErrors({}); }} /> },
        ]} />
      </div>
      {editing && (
        <Modal open title={`Edit ${editing.id}`} onClose={() => setEditing(null)}
          footer={<><button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={save}>Save</button></>}>
          <div className="row">
            <div className="col-8"><FormField label="Company Name" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} error={errors.name} /></div>
            <div className="col-4"><FormField label="Code" required value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} error={errors.code} /></div>
          </div>
          <FormField label="Website URL" type="url" value={editing.websiteUrl} onChange={(e) => setEditing({ ...editing, websiteUrl: e.target.value })} error={errors.websiteUrl} placeholder="https://…" />
          <FormTextarea label="Description" rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
          <div className="form-text">The company ID ({editing.id}) never changes.</div>
        </Modal>
      )}
    </Section>
  );
}

const CONFIG_LISTS = [
  { key: 'applicationCategories', label: 'Application Categories', usage: (d, v) => d.applications.filter((a) => a.category === v).length },
  { key: 'applicationTypes', label: 'Application Types', usage: (d, v) => d.applications.filter((a) => a.type === v).length },
  { key: 'repositoryTypes', label: 'Repository Types', usage: (d, v) => d.repositories.filter((r) => r.type === v).length },
  { key: 'componentTypes', label: 'Component Types', usage: (d, v) => d.components.filter((c) => c.type === v).length },
  { key: 'componentLayers', label: 'Component Layers', usage: (d, v) => d.components.filter((c) => c.layer === v).length },
  { key: 'infrastructureCategories', label: 'Infrastructure Categories', usage: (d, v) => d.infrastructure.filter((i) => i.category === v).length },
  { key: 'technologyCategories', label: 'Technology Categories', usage: (d, v) => d.technologies.filter((t) => t.category === v).length },
];

function RegistryConfig() {
  const { data } = useRegistry();
  return (
    <div className="d-flex flex-column gap-4">
      <Section title="Lifecycle Options" description="Canonical lifecycle values, stored in lowercase. These cannot be changed.">
        <div className="d-flex gap-2 flex-wrap">{data.categories.lifecycleOptions.map((l) => <StatusBadge key={l} value={l} />)}<span className="bh-chip"><Lock size={12} />Locked</span></div>
      </Section>
      {CONFIG_LISTS.map((c) => <OptionList key={c.key} config={c} />)}
    </div>
  );
}

function OptionList({ config }) {
  const { data, run } = useRegistry();
  const toast = useToast();
  const [items, setItems] = useState(data.categories[config.key] || []);
  const [text, setText] = useState('');
  const dirty = JSON.stringify(items) !== JSON.stringify(data.categories[config.key]);
  const add = () => { const t = text.trim(); if (t && !items.includes(t)) setItems([...items, t]); setText(''); };
  return (
    <Section title={config.label} description="Values in use by records cannot be removed."
      footer={dirty && <><button type="button" className="btn btn-ghost" onClick={() => setItems(data.categories[config.key])}>Discard</button><button type="button" className="btn btn-primary" onClick={() => { run(updateCategories, config.key, items); toast(`${config.label} saved.`); }}><Save size={16} />Save</button></>}>
      <div className="d-flex gap-2 flex-wrap mb-3">
        {items.map((it) => {
          const used = config.usage(data, it);
          return (
            <span key={it} className="bh-chip" style={{ padding: '4px 10px' }}>
              {it}{used > 0 && <span className="text-subtle ms-1">({used})</span>}
              <button type="button" disabled={used > 0} title={used ? `In use by ${used} record(s)` : 'Remove'} aria-label={`Remove ${it}`} style={{ opacity: used ? 0.3 : 1 }} onClick={() => setItems(items.filter((x) => x !== it))}><X size={12} /></button>
            </span>
          );
        })}
      </div>
      <div className="d-flex gap-2" style={{ maxWidth: 420 }}>
        <input className="form-control" placeholder="Add a value" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label={`Add to ${config.label}`} />
        <button type="button" className="btn btn-secondary" onClick={add} disabled={!text.trim()}><Plus size={16} />Add</button>
      </div>
    </Section>
  );
}

function DataBackup() {
  const { data } = useRegistry();
  const fmt = useFormat();
  return (
    <Section title="Data & Backup" description="Backup, restore and reset live in Data Management.">
      <div className="d-flex flex-column gap-2 small mb-3" style={{ maxWidth: 480 }}>
        <div className="d-flex justify-content-between"><span className="text-subtle">Last backup</span><span>{data.meta?.lastBackupAt ? fmt.dateTime(data.meta.lastBackupAt) : 'Never'}</span></div>
        <div className="d-flex justify-content-between"><span className="text-subtle">Last restore</span><span>{data.meta?.lastRestoreAt ? fmt.dateTime(data.meta.lastRestoreAt) : '—'}</span></div>
      </div>
      <Link to="/data" className="btn btn-secondary">Open Data Management <ArrowRight size={16} /></Link>
    </Section>
  );
}

function SystemInfo() {
  const { data, health } = useRegistry();
  const fmt = useFormat();
  const rows = [
    ['Application Version', APP_VERSION], ['Schema Version', `v${data.schemaVersion} (app supports v${SCHEMA_VERSION})`],
    ['Storage Mode', `Browser Local Storage (${STORAGE_KEY})`], ['Storage Status', health.message],
    ['Last Backup', data.meta?.lastBackupAt ? fmt.dateTime(data.meta.lastBackupAt) : 'Never'],
    ['Initial Data Source', 'Seed JSON files in database/ (imported from the VSG Repository Registry workbook)'],
    ['Initialized', fmt.dateTime(data.meta?.initializedAt)],
    ['Architecture', 'Frontend-only · single user · no backend, authentication or cloud sync'],
  ];
  return (
    <Section title="System Information">
      <div className="d-flex flex-column gap-2">
        {rows.map(([k, val]) => <div key={k} className="d-flex justify-content-between gap-3 py-1" style={{ borderBottom: '1px solid var(--bh-border)' }}><span className="text-subtle">{k}</span><span className="text-end fw-semibold">{val}</span></div>)}
      </div>
    </Section>
  );
}

