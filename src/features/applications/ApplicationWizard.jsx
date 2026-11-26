import { useNavigate, useParams } from 'react-router';
import { Cpu, Link2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StepWizard from '../../components/forms/StepWizard';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import TagInput from '../../components/forms/TagInput';
import LogoField from '../../components/forms/LogoField';
import MultiSelect from '../../components/forms/MultiSelect';
import Avatar from '../../components/common/Avatar';
import ReviewSummary from '../../components/common/ReviewSummary';
import StatusBadge from '../../components/badges/StatusBadge';
import EmptyState from '../../components/common/EmptyState';
import { useWizardForm, requireFields } from '../../components/forms/useWizardForm';
import { useRegistry } from '../../hooks/useRegistry';
import { useToast } from '../../hooks/useToast';
import { createEntity, updateEntity } from '../../services/registry.service';
import { byId, componentsOfApp, providerOfApi } from '../../services/query.service';
import { LIFECYCLES } from '../../services/schema';
import {
  companyOptions, repositoryOptions, componentOptions, technologyOptions, infrastructureOptions, apiOptions, linkValues, nameList,
} from '../../utils/options';
import NotFoundPage from '../overview/NotFoundPage';

const FIELDS = ['name', 'code', 'ownerId', 'category', 'type', 'lifecycle', 'description', 'purpose', 'websiteUrl', 'documentationUrl', 'logoUrl', 'tags', 'architecture', 'platform', 'hosting', 'environments'];

const sortAsc = (arr, labelOf = (x) => x.label) => [...arr].sort((a, b) => String(labelOf(a)).localeCompare(String(labelOf(b)), undefined, { sensitivity: 'base' }));

const ENV_GUIDE = {
  development: 'Lingkungan lokal developer untuk coding, eksperimen, dan debugging awal.',
  preview: 'Lingkungan pratinjau sementara (per branch / PR) untuk mengecek hasil build.',
  staging: 'Lingkungan uji coba pra-rilis mirip production untuk QA dan UAT.',
  production: 'Lingkungan live utama yang diakses langsung oleh pengguna akhir.',
};

// Step 02 technology roles → catalog categories offered for each (disjoint so each tech appears in one card).
const TECH_ROLES = [
  { key: 'techLanguage', role: 'Programming Language', label: 'Programming Language', categories: ['Programming Language'] },
  { key: 'techFrontend', role: 'Frontend Technology', label: 'Frontend Technology', categories: ['Frontend Framework', 'Styling', 'Library'] },
  { key: 'techBackend', role: 'Backend Technology', label: 'Backend Technology', categories: ['Backend Framework', 'Runtime'] },
  { key: 'techDatabase', role: 'Database', label: 'Database', categories: ['Database'] },
  { key: 'techOrm', role: 'ORM / Data Access', label: 'ORM / Data Access', categories: ['ORM'] },
  { key: 'techTesting', role: 'Testings', label: 'Testings', categories: ['Testing'] },
  { key: 'techTools', role: 'Additional Tools', label: 'Additional Tools', categories: ['DevOps', 'Other'] },
];

function initialValues(ds, app) {
  const base = app
    ? Object.fromEntries(FIELDS.map((f) => [f, app[f] ?? (f === 'tags' || f === 'environments' ? [] : '')]))
    : { name: '', code: '', ownerId: '', category: '', type: '', lifecycle: 'planning', description: '', purpose: '', websiteUrl: '', documentationUrl: '', tags: [], architecture: '', platform: '', hosting: '', environments: [] };
  const id = app?.id;
  const techLinks = id ? ds.applicationTechnologies.filter((l) => l.applicationId === id) : [];
  for (const r of TECH_ROLES) base[r.key] = techLinks.filter((l) => l.role === r.role).map((l) => ({ targetId: l.technologyId, version: l.version || '' }));
  base.repositories = id ? linkValues(ds, 'applicationRepositories', 'applicationId', 'repositoryId', id, ['role']) : [];
  base.sharedComponents = id ? linkValues(ds, 'applicationComponents', 'applicationId', 'componentId', id, ['role']) : [];
  base.providedApis = id ? linkValues(ds, 'applicationApis', 'applicationId', 'apiId', id, ['role']) : [];
  base.consumedApis = id ? linkValues(ds, 'apiConsumers', 'applicationId', 'apiId', id) : [];
  base.infrastructure = id ? linkValues(ds, 'applicationInfrastructure', 'applicationId', 'infrastructureId', id, ['role']) : [];
  return base;
}

export default function ApplicationWizard({ mode = 'create' }) {
  const { id } = useParams();
  const { data } = useRegistry();
  const app = mode === 'edit' ? data.applications.find((a) => a.id === id) : null;
  if (mode === 'edit' && !app) return <NotFoundPage />;
  return <WizardBody key={app?.id || 'new'} app={app} />;
}

function WizardBody({ app }) {
  const { data, run } = useRegistry();
  const toast = useToast();
  const navigate = useNavigate();
  const form = useWizardForm(() => initialValues(data, app));
  const { values: v, set, bind, bindSelect } = form;
  const cat = data.categories;

  const ownComponents = app ? componentsOfApp(data, app.id) : [];
  const ownComponentIds = new Set(ownComponents.map((c) => c.id));
  const providedOptions = apiOptions(data, (a) => { const p = providerOfApi(data, a.id); return !p || p.id === app?.id; });

  const save = () => {
    const values = Object.fromEntries(FIELDS.map((f) => [f, v[f]]));
    const links = [
      { relation: 'applicationRepositories', side: 'from', items: v.repositories },
      { relation: 'applicationComponents', side: 'from', items: v.sharedComponents.map((x) => ({ ...x, role: x.role || 'Shared dependency' })) },
      { relation: 'applicationApis', side: 'from', items: v.providedApis.map((x) => ({ targetId: x.targetId, role: 'provider' })) },
      { relation: 'apiConsumers', side: 'to', items: v.consumedApis.map((x) => ({ targetId: x.targetId })) },
      { relation: 'applicationTechnologies', side: 'from', items: TECH_ROLES.flatMap((r) => v[r.key].map((x) => ({ targetId: x.targetId, role: r.role, version: x.version || '' }))) },
      { relation: 'applicationInfrastructure', side: 'from', items: v.infrastructure },
    ];
    if (app) {
      run(updateEntity, 'applications', app.id, values, links);
      toast(`Application ${app.id} updated.`);
      navigate(`/applications/${app.id}`);
    } else {
      const newId = run(createEntity, 'applications', values, links);
      toast(`Application ${newId} created.`);
      navigate(`/applications/${newId}`);
    }
  };

  const steps = [
    {
      key: 'basic', title: 'Basic Information', description: 'Identity, ownership & lifecycle',
      fields: ['name', 'code', 'ownerId', 'category', 'type', 'lifecycle', 'websiteUrl', 'documentationUrl', 'logoUrl'],
      validate: () => requireFields(v, [['name', 'Application name'], ['code', 'Application code'], ['ownerId', 'Company ownership'], ['category', 'Category'], ['type', 'Application type'], ['lifecycle', 'Lifecycle']]),
      render: () => (
        <div className="row">
          <div className="col-md-8"><FormField label="Application Name" required placeholder="e.g. Orange LMS" {...bind('name')} /></div>
          <div className="col-md-4"><FormField label="Application Code" required placeholder="e.g. OL" help="Short unique code" {...bind('code')} /></div>
          <div className="col-md-4"><FormSelect label="Company Ownership" required options={companyOptions(data)} {...bindSelect('ownerId')} /></div>
          <div className="col-md-4"><FormSelect label="Category" required options={cat.applicationCategories} format={(x) => x} {...bindSelect('category')} /></div>
          <div className="col-md-4"><FormSelect label="Application Type" required options={cat.applicationTypes} format={(x) => x} {...bindSelect('type')} /></div>
          <div className="col-md-4"><FormSelect label="Lifecycle" required options={LIFECYCLES} {...bindSelect('lifecycle')} help="Managed manually; every change is logged." /></div>
          <div className="col-md-8"><FormField label="Purpose" placeholder="What business need does it serve?" {...bind('purpose')} /></div>
          <div className="col-12"><FormTextarea label="Description" placeholder="Short description of the application" {...bind('description')} /></div>
          <div className="col-md-6"><FormField label="Website URL" type="url" placeholder="https://…" {...bind('websiteUrl')} /></div>
          <div className="col-md-6"><FormField label="Documentation URL" type="url" placeholder="https://…" {...bind('documentationUrl')} /></div>
          <div className="col-12"><LogoField label="Application Logo" value={v.logoUrl} onChange={(val) => set('logoUrl', val)} name={v.name} seed={app?.id || v.code} error={form.errors.logoUrl} help="Optional custom logo (inherited by its Components, Repositories, and Deployments)." /></div>
          <div className="col-12"><TagInput label="Tags" value={v.tags} onChange={(t) => set('tags', t)} /></div>
        </div>
      ),
    },
    {
      key: 'technical', title: 'Technical Details', description: 'Architecture & technology',
      fields: ['architecture', 'platform', 'hosting'],
      render: () => (
        <div className="row">
          <div className="col-md-6"><FormField label="Architecture / Structure" placeholder="e.g. SPA + REST API" {...bind('architecture')} /></div>
          <div className="col-md-6"><FormField label="Application Platform" placeholder="e.g. Web, Mobile (Android, iOS)" {...bind('platform')} /></div>
          <div className="col-12 mb-2"><div className="bh-section-title"><Cpu size={15} className="bh-section-icon" /><span>Technology Stack · from the Technology Master Catalog</span></div></div>
          {TECH_ROLES.map((r) => (
            <div className="col-md-6 col-lg-4 d-flex flex-column" key={r.key}>
              <MultiSelect fill label={r.label} options={sortAsc(technologyOptions(data, r.categories))} value={v[r.key]} onChange={(x) => set(r.key, x)}
                extraFields={[{ key: 'version', label: 'Version' }]} emptyText="No catalog entries in this category yet. Add them in Technology Stack." />
            </div>
          ))}
          <div className="col-md-6 col-lg-8 d-flex flex-column">
            <FormTextarea label="Hosting Information" rows={2} placeholder="Where and how it is hosted" {...bind('hosting')} />
            <div className="mb-3 flex-grow-1 d-flex flex-column">
              <label className="form-label">Environment</label>
              <div className="d-flex flex-wrap gap-3 pt-1 pb-2">
                {sortAsc(cat.environments, (x) => x).map((e) => (
                  <label key={e} className="form-check d-flex align-items-center gap-2 m-0">
                    <input type="checkbox" className="form-check-input m-0" checked={v.environments.includes(e)}
                      onChange={() => set('environments', v.environments.includes(e) ? v.environments.filter((x) => x !== e) : [...v.environments, e])} />
                    <span className="text-capitalize">{e}</span>
                  </label>
                ))}
              </div>
              <div className="p-3 rounded border bg-body-tertiary small d-flex flex-column justify-content-center gap-2 flex-grow-1">
                {sortAsc(cat.environments, (x) => x).map((e) => (
                  <div key={e} className="d-flex align-items-center gap-2">
                    <span className="badge text-bg-light border text-capitalize flex-shrink-0" style={{ minWidth: 92 }}>{e}</span>
                    <span className="text-muted">{ENV_GUIDE[e] || 'Environment deployment aplikasi.'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'relations', title: 'Relations & Ownership', description: 'Connect existing records',
      fields: ['ownerId'],
      render: () => (
        <div className="row">
          <div className="col-md-6"><FormSelect label="Company Ownership" required options={sortAsc(companyOptions(data))} {...bindSelect('ownerId')} /></div>
          <div className="col-12 mt-1 mb-2"><div className="bh-section-title"><Link2 size={15} className="bh-section-icon" /><span>Linked Repositories, Components, APIs &amp; Infrastructure</span></div></div>
          <div className="col-lg-6 d-flex flex-column">
            <MultiSelect fill label="Repositories" options={sortAsc(repositoryOptions(data))} value={v.repositories} onChange={(x) => set('repositories', x)}
              extraFields={[{ key: 'role', label: 'Role', options: sortAsc(['Frontend', 'Backend', 'Full Stack', 'Mobile', 'Monorepo', 'Shared Library', 'Infrastructure', 'Documentation', 'Website'], (x) => x) }]}
              help="Repositories that host source code or docs for this application." />
          </div>
          <div className="col-lg-6 d-flex flex-column">
            <MultiSelect fill label="Components (shared, owned by other applications)" options={sortAsc(componentOptions(data, (c) => !ownComponentIds.has(c.id)))} value={v.sharedComponents} onChange={(x) => set('sharedComponents', x)}
              help={app ? `${ownComponents.length} own component(s) are linked automatically through their parent application.` : 'Own components are added after creation from the Components page.'} />
          </div>
          <div className="col-lg-6 d-flex flex-column">
            <MultiSelect fill label="APIs & Services provided" options={sortAsc(providedOptions)} value={v.providedApis} onChange={(x) => set('providedApis', x)}
              help="An API has one provider; APIs provided elsewhere are hidden." />
          </div>
          <div className="col-lg-6 d-flex flex-column">
            <MultiSelect fill label="APIs & Services consumed" options={sortAsc(apiOptions(data))} value={v.consumedApis} onChange={(x) => set('consumedApis', x)}
              help="Internal or third-party APIs called by this application." />
          </div>
          <div className="col-lg-6 d-flex flex-column">
            <MultiSelect fill label="Infrastructure" options={sortAsc(infrastructureOptions(data))} value={v.infrastructure} onChange={(x) => set('infrastructure', x)}
              extraFields={[{ key: 'role', label: 'Usage / role' }]}
              help="Hosting, database, source control, or cloud resources linked here." />
          </div>
          <div className="col-lg-6 d-flex flex-column mb-3">
            <div className="mb-3 flex-grow-1 d-flex flex-column">
              <label className="form-label">Technology Stack</label>
              <div className="bh-multiselect p-3 small d-flex flex-column gap-1 flex-grow-1">
                {TECH_ROLES.some((r) => v[r.key].length)
                  ? TECH_ROLES.filter((r) => v[r.key].length).map((r) => <div key={r.key}><strong>{r.label}:</strong> {nameList(data, 'technologies', v[r.key])}</div>)
                  : <span className="text-subtle">No technologies selected yet. Configure them in Step 02 (Technical Details).</span>}
              </div>
            </div>
            <div className="flex-grow-1 d-flex flex-column">
              <label className="form-label">Deployments</label>
              {(() => {
                const appDeps = app ? data.deployments.filter((d) => d.applicationId === app.id || ownComponentIds.has(d.componentId)) : [];
                return (
                  <>
                    <div className="bh-multiselect p-3 small d-flex flex-column gap-2 flex-grow-1">
                      {appDeps.length > 0 ? (
                        <div className="d-flex flex-wrap gap-2">
                          {appDeps.map((d) => (
                            <span key={d.id} className="bh-chip">{d.name}{d.environment ? ` · ${d.environment}` : ''}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-subtle">{app ? 'No deployments recorded for this application yet.' : 'Deployments can be linked after creation.'}</span>
                      )}
                    </div>
                    <div className="form-text">
                      {app ? `Currently ${appDeps.length} deployment(s) linked to this application or its components.` : 'Managed from the Deployments page directly or via components.'}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'review', title: app ? 'Review & Save' : 'Review & Create', description: 'Confirm before saving',
      render: () => (
        <ReviewSummary sections={[
          { title: 'Basic Information', fields: [
            { label: 'Logo', value: <Avatar name={v.name || 'App'} seed={app?.id || v.code} src={v.logoUrl} size={32} /> },
            { label: 'Application Name', value: v.name }, { label: 'Code', value: v.code },
            { label: 'Company', value: byId(data, 'companies', v.ownerId)?.name }, { label: 'Category', value: v.category },
            { label: 'Type', value: v.type }, { label: 'Lifecycle', value: v.lifecycle && <StatusBadge value={v.lifecycle} /> },
            { label: 'Purpose', value: v.purpose }, { label: 'Website', value: v.websiteUrl }, { label: 'Documentation', value: v.documentationUrl },
            { label: 'Tags', value: v.tags.join(', ') }, { label: 'Description', value: v.description, wide: true },
          ] },
          { title: 'Technical Details', fields: [
            { label: 'Architecture', value: v.architecture }, { label: 'Platform', value: v.platform }, { label: 'Hosting', value: v.hosting },
            { label: 'Environments', value: v.environments.join(', ') },
            ...TECH_ROLES.map((r) => ({ label: r.label, value: v[r.key].map((x) => `${byId(data, 'technologies', x.targetId)?.name}${x.version ? ` ${x.version}` : ''}`).join(', ') })),
          ] },
          { title: 'Relationships', fields: [
            { label: 'Repositories', value: nameList(data, 'repositories', v.repositories) },
            { label: 'Shared Components', value: nameList(data, 'components', v.sharedComponents) },
            { label: 'APIs provided', value: nameList(data, 'apis', v.providedApis) },
            { label: 'APIs consumed', value: nameList(data, 'apis', v.consumedApis) },
            { label: 'Infrastructure', value: nameList(data, 'infrastructure', v.infrastructure) },
          ] },
        ]} />
      ),
    },
  ];

  if (!data.companies.length) return <EmptyState title="No companies configured" message="Add company profiles in Settings first." />;
  return (
    <>
      <PageHeader title={app ? `Edit ${app.name}` : 'Create Application'} description={app ? `Update ${app.id}. The ID stays the same.` : 'Register a new application in four steps.'} />
      <StepWizard steps={steps} errors={form.errors} setErrors={form.setErrors} dirty={form.dirty} onSubmit={save}
        onCancel={() => navigate(app ? `/applications/${app.id}` : '/applications')} submitLabel={app ? 'Save Changes' : 'Create Application'} />
    </>
  );
}
