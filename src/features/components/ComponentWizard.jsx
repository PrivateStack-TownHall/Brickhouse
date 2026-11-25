import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Info, AppWindow, GitBranch, Boxes, Plug, Rocket } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StepWizard from '../../components/forms/StepWizard';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import TagInput from '../../components/forms/TagInput';
import MultiSelect from '../../components/forms/MultiSelect';
import ReviewSummary from '../../components/common/ReviewSummary';
import StatusBadge from '../../components/badges/StatusBadge';
import { useWizardForm, requireFields } from '../../components/forms/useWizardForm';
import { useRegistry } from '../../hooks/useRegistry';
import { useToast } from '../../hooks/useToast';
import { createEntity, updateEntity } from '../../services/registry.service';
import { byId } from '../../services/query.service';
import { LIFECYCLES } from '../../services/schema';
import {
  applicationOptions, repositoryOptions, technologyOptions, infrastructureOptions, apiOptions, componentOptions, linkValues, nameList,
} from '../../utils/options';
import { slugify } from '../../helpers';
import NotFoundPage from '../overview/NotFoundPage';

const COMPONENT_GUIDE = [
  {
    title: 'Component Category',
    subtitle: 'Cakupan & kepemilikan komponen',
    items: [
      ['Application Module', 'Modul khusus yang hanya dipakai oleh 1 aplikasi utama.'],
      ['Shared Module', 'Modul bersama yang dipakai ulang oleh beberapa aplikasi.'],
      ['Integration', 'Penghubung ke sistem luar / pihak ketiga (API, Payment, Email).'],
      ['Platform', 'Fondasi inti yang menopang banyak layanan (Auth Server, Gateway).'],
    ],
  },
  {
    title: 'Component Role',
    subtitle: 'Peran fungsional di dalam sistem',
    items: [
      ['Feature', 'Fitur bisnis utama yang dipakai langsung oleh user (Order, LMS, Chat).'],
      ['Core', 'Bagian vital agar aplikasi bisa berjalan (Login, Routing, State utama).'],
      ['Utility', 'Alat bantu pendukung teknis (Format tanggal, Export PDF, Helper).'],
      ['Gateway', 'Pintu gerbang pengatur lalu lintas request masuk/keluar antar layanan.'],
    ],
  },
  {
    title: 'Component Type',
    subtitle: 'Bentuk teknis komponennya',
    items: [
      ['Module', 'Bagian fungsional terstruktur di dalam satu codebase aplikasi.'],
      ['Service', 'Layanan mandiri (Backend API, Microservice, atau Background Worker).'],
      ['Library', 'Kumpulan fungsi/kode (package/SDK) yang di-import oleh proyek lain.'],
      ['UI', 'Tampilan antarmuka visual (halaman, form, widget frontend).'],
    ],
  },
];

const BERRY_FRESH_EXAMPLE = {
  summary: [
    { icon: AppWindow, label: 'Application', items: ['Berry Fresh (Platform E-Commerce Buah Segar)'] },
    { icon: GitBranch, label: 'Repositories', items: ['berry-fresh-web (Frontend)', 'berry-fresh-api (Backend)', 'berry-fresh-ui (Shared UI)'] },
    { icon: Plug, label: 'APIs & Services', items: ['Berry Fresh REST API (Provided)', 'Midtrans Payment API (Consumed)', 'RajaOngkir Courier API (Consumed)'] },
    { icon: Rocket, label: 'Deployments', items: ['Vercel — Production Web (berryfresh.id)', 'Render — Production API (api.berryfresh.id)', 'Vercel — Staging Preview'] },
  ],
  components: [
    { name: 'Storefront Catalog & Cart', category: 'Application Module', role: 'Feature', type: 'UI', layer: 'Frontend', desc: 'Halaman katalog buah, filter harga, dan keranjang belanja user.' },
    { name: 'Auth & User Session', category: 'Platform', role: 'Core', type: 'Service', layer: 'Backend', desc: 'Layanan login, registrasi, dan validasi JWT token seluruh aplikasi.' },
    { name: 'Midtrans Payment Adapter', category: 'Integration', role: 'Gateway', type: 'Service', layer: 'Backend', desc: 'Penghubung pembayaran QRIS/VA & webhook ke layanan Midtrans.' },
    { name: 'Berry UI Kit', category: 'Shared Module', role: 'Utility', type: 'Library', layer: 'Shared', desc: 'Komponen tombol, card & format harga Rupiah yang dipakai ulang.' },
  ],
};

const FIELDS = ['name', 'code', 'category', 'role', 'type', 'lifecycle', 'layer', 'version', 'description', 'capabilities', 'applicationId'];

export default function ComponentWizard({ mode = 'create' }) {
  const { id } = useParams();
  const { data } = useRegistry();
  const cmp = mode === 'edit' ? data.components.find((c) => c.id === id) : null;
  if (mode === 'edit' && !cmp) return <NotFoundPage />;
  return <Body cmp={cmp} />;
}

function Body({ cmp }) {
  const { data, run } = useRegistry();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = cmp?.id;
  const form = useWizardForm(() => ({
    ...(cmp ? Object.fromEntries(FIELDS.map((f) => [f, cmp[f] ?? (f === 'capabilities' ? [] : '')]))
      : { name: '', code: '', category: 'Application Module', role: '', type: '', lifecycle: 'planning', layer: '', version: '0.1.0', description: '', capabilities: [], applicationId: params.get('application') || '' }),
    technologies: id ? linkValues(data, 'componentTechnologies', 'componentId', 'technologyId', id, ['role', 'version']) : [],
    repositories: id ? linkValues(data, 'componentRepositories', 'componentId', 'repositoryId', id, ['path']) : [],
    infrastructure: id ? linkValues(data, 'componentInfrastructure', 'componentId', 'infrastructureId', id, ['resourceName']) : [],
    providesApis: id ? linkValues(data, 'componentApis', 'componentId', 'apiId', id, ['role']).filter((x) => x.role === 'provider') : [],
    consumesApis: id ? linkValues(data, 'componentApis', 'componentId', 'apiId', id, ['role']).filter((x) => x.role === 'consumer') : [],
    dependsOn: id ? linkValues(data, 'componentServices', 'sourceComponentId', 'targetComponentId', id, ['relationshipType']) : [],
  }));
  const { values: v, set, bind, bindSelect } = form;
  const cat = data.categories;
  const [showGuide, setShowGuide] = useState(true);

  const save = () => {
    const values = Object.fromEntries(FIELDS.map((f) => [f, v[f]]));
    if (!values.code) values.code = slugify(values.name);
    const links = [
      { relation: 'componentTechnologies', side: 'from', items: v.technologies },
      { relation: 'componentRepositories', side: 'from', items: v.repositories },
      { relation: 'componentInfrastructure', side: 'from', items: v.infrastructure },
      { relation: 'componentApis', side: 'from', items: [...v.providesApis.map((x) => ({ targetId: x.targetId, role: 'provider' })), ...v.consumesApis.map((x) => ({ targetId: x.targetId, role: 'consumer' }))] },
      { relation: 'componentServices', side: 'from', items: v.dependsOn.map((x) => ({ ...x, relationshipType: x.relationshipType || 'depends_on' })) },
    ];
    if (cmp) {
      run(updateEntity, 'components', cmp.id, values, links);
      toast(`Component ${cmp.id} updated.`);
      navigate(`/components/${cmp.id}`);
    } else {
      const newId = run(createEntity, 'components', values, links);
      toast(`Component ${newId} created.`);
      navigate(`/components/${newId}`);
    }
  };

  const steps = [
    {
      key: 'info', title: 'Component Information', description: 'What it is and does',
      fields: ['name', 'type', 'layer', 'lifecycle'],
      validate: () => requireFields(v, [['name', 'Component name'], ['type', 'Component type'], ['layer', 'Layer / tier'], ['lifecycle', 'Lifecycle status']]),
      render: () => (
        <div className="row">
          <div className="col-md-6"><FormField label="Component Name" required placeholder="e.g. Orange LMS API" {...bind('name')} /></div>
          <div className="col-md-3"><FormField label="Component Code / Slug" placeholder="auto from name" {...bind('code')} /></div>
          <div className="col-md-3"><FormField label="Version" placeholder="1.0.0" {...bind('version')} /></div>
          <div className="col-md-4"><FormSelect label="Component Category" options={cat.componentCategories} format={(x) => x} {...bindSelect('category')} /></div>
          <div className="col-md-4"><FormSelect label="Component Role" options={cat.componentRoles} format={(x) => x} {...bindSelect('role')} /></div>
          <div className="col-md-4"><FormSelect label="Component Type" required options={cat.componentTypes} format={(x) => x} {...bindSelect('type')} /></div>
          <div className="col-md-4"><FormSelect label="Layer / Tier" required options={cat.componentLayers} format={(x) => x} {...bindSelect('layer')} /></div>
          <div className="col-md-4"><FormSelect label="Lifecycle Status" required options={LIFECYCLES} {...bindSelect('lifecycle')} /></div>
          <div className="col-12"><FormTextarea label="Description" {...bind('description')} /></div>
          <div className="col-lg-6"><MultiSelect label="Key Technologies" options={technologyOptions(data)} value={v.technologies} onChange={(x) => set('technologies', x)} help="Role and version are set in Step 02." /></div>
          <div className="col-lg-6"><TagInput label="Capabilities" value={v.capabilities} onChange={(x) => set('capabilities', x)} help="e.g. Authentication, Payments, Reporting" /></div>
          <div className="col-12 mt-2">
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
                      {BERRY_FRESH_EXAMPLE.summary.map(({ icon: ItemIcon, label, items }) => (
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
                          {BERRY_FRESH_EXAMPLE.components.map((ex) => (
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
          </div>
        </div>
      ),
    },
    {
      key: 'relations', title: 'Relations & Associations', description: 'Parent, sources, dependencies',
      fields: ['applicationId'],
      validate: () => requireFields(v, [['applicationId', 'Parent application']]),
      render: () => (
        <div className="row">
          <div className="col-md-6"><FormSelect label="Parent Application" required options={applicationOptions(data)} {...bindSelect('applicationId')} help="Every component belongs to exactly one application." /></div>
          <div className="col-12" />
          <div className="col-lg-6"><MultiSelect label="Repository" options={repositoryOptions(data)} value={v.repositories} onChange={(x) => set('repositories', x)} extraFields={[{ key: 'path', label: 'Path in repo (optional)' }]} /></div>
          <div className="col-lg-6"><MultiSelect label="Technology Stack" options={technologyOptions(data)} value={v.technologies} onChange={(x) => set('technologies', x)} extraFields={[{ key: 'role', label: 'Role' }, { key: 'version', label: 'Version' }]} help="Version and role are stored on the relationship, not on the catalog entry." /></div>
          <div className="col-lg-6"><MultiSelect label="Infrastructure" options={infrastructureOptions(data)} value={v.infrastructure} onChange={(x) => set('infrastructure', x)} extraFields={[{ key: 'resourceName', label: 'Resource name' }]} /></div>
          <div className="col-lg-6"><MultiSelect label="Related Components (depends on)" options={componentOptions(data, (c) => c.id !== id)} value={v.dependsOn} onChange={(x) => set('dependsOn', x)} extraFields={[{ key: 'relationshipType', label: 'Relationship', options: cat.componentRelationshipTypes }]} /></div>
          <div className="col-lg-6"><MultiSelect label="APIs & Services provided" options={apiOptions(data)} value={v.providesApis} onChange={(x) => set('providesApis', x)} /></div>
          <div className="col-lg-6"><MultiSelect label="APIs & Services consumed" options={apiOptions(data)} value={v.consumesApis} onChange={(x) => set('consumesApis', x)} /></div>
        </div>
      ),
    },
    {
      key: 'review', title: 'Review & Save', description: 'Confirm before saving',
      render: () => (
        <ReviewSummary sections={[
          { title: 'Component', fields: [
            { label: 'Name', value: v.name }, { label: 'Code', value: v.code || slugify(v.name) }, { label: 'Version', value: v.version },
            { label: 'Category', value: v.category }, { label: 'Role', value: v.role }, { label: 'Type', value: v.type }, { label: 'Layer', value: v.layer },
            { label: 'Lifecycle', value: v.lifecycle && <StatusBadge value={v.lifecycle} /> }, { label: 'Capabilities', value: v.capabilities.join(', ') },
            { label: 'Description', value: v.description, wide: true },
          ] },
          { title: 'Relationships', fields: [
            { label: 'Parent Application', value: byId(data, 'applications', v.applicationId)?.name },
            { label: 'Repositories', value: nameList(data, 'repositories', v.repositories) },
            { label: 'Technologies', value: v.technologies.map((x) => `${byId(data, 'technologies', x.targetId)?.name}${x.version ? ` ${x.version}` : ''}`).join(', ') },
            { label: 'Infrastructure', value: nameList(data, 'infrastructure', v.infrastructure) },
            { label: 'Depends on', value: nameList(data, 'components', v.dependsOn) },
            { label: 'Provides APIs', value: nameList(data, 'apis', v.providesApis) },
            { label: 'Consumes APIs', value: nameList(data, 'apis', v.consumesApis) },
          ] },
        ]} />
      ),
    },
  ];
  return (
    <>
      <PageHeader title={cmp ? `Edit ${cmp.name}` : 'Add Component'} description={cmp ? `Update ${cmp.id}.` : 'Register a module, service, library or UI component.'} />
      <StepWizard steps={steps} errors={form.errors} setErrors={form.setErrors} dirty={form.dirty} onSubmit={save}
        onCancel={() => navigate(cmp ? `/components/${cmp.id}` : '/components')} submitLabel={cmp ? 'Save Changes' : 'Save Component'} />
    </>
  );
}
