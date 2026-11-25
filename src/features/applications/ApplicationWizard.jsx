import { useNavigate, useParams } from 'react-router';
import { Cpu } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StepWizard from '../../components/forms/StepWizard';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import TagInput from '../../components/forms/TagInput';
import MultiSelect from '../../components/forms/MultiSelect';
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

const FIELDS = ['name', 'code', 'ownerId', 'category', 'type', 'lifecycle', 'description', 'purpose', 'websiteUrl', 'documentationUrl', 'tags', 'architecture', 'platform', 'hosting', 'environments'];

// Step 02 technology roles → catalog categories offered for each.
const TECH_ROLES = [
  { key: 'techLanguage', role: 'Programming Language', label: 'Programming Language', categories: ['Programming Language'] },
  { key: 'techFrontend', role: 'Frontend Technology', label: 'Frontend Technology', categories: ['Frontend Framework', 'Styling', 'Library'] },
  { key: 'techBackend', role: 'Backend Technology', label: 'Backend Technology', categories: ['Backend Framework', 'Library'] },
  { key: 'techDatabase', role: 'Database', label: 'Database', categories: ['Database'] },
  { key: 'techOrm', role: 'ORM / Data Access', label: 'ORM / Data Access', categories: ['ORM'] },
  { key: 'techTools', role: 'Additional Tools', label: 'Additional Tools', categories: ['DevOps', 'Testing', 'Library', 'Other'] },
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
      fields: ['name', 'code', 'ownerId', 'category', 'type', 'lifecycle', 'websiteUrl', 'documentationUrl'],
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
            <div className="col-md-6" key={r.key}>
              <MultiSelect label={r.label} options={technologyOptions(data, r.categories)} value={v[r.key]} onChange={(x) => set(r.key, x)}
                extraFields={[{ key: 'version', label: 'Version' }]} emptyText="No catalog entries in this category yet. Add them in Technology Stack." />
            </div>
          ))}
          <div className="col-md-6"><FormTextarea label="Hosting Information" rows={2} placeholder="Where and how it is hosted" {...bind('hosting')} /></div>
          <div className="col-md-6">
            <label className="form-label">Environment</label>
            <div className="d-flex flex-wrap gap-3 pt-1">
              {cat.environments.map((e) => (
                <label key={e} className="form-check d-flex align-items-center gap-2 m-0">
                  <input type="checkbox" className="form-check-input m-0" checked={v.environments.includes(e)}
                    onChange={() => set('environments', v.environments.includes(e) ? v.environments.filter((x) => x !== e) : [...v.environments, e])} />
                  <span className="text-capitalize">{e}</span>
                </label>
              ))}
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
          <div className="col-md-6"><FormSelect label="Company Ownership" required options={companyOptions(data)} {...bindSelect('ownerId')} /></div>
          <div className="col-12" />
          <div className="col-lg-6"><MultiSelect label="Repositories" options={repositoryOptions(data)} value={v.repositories} onChange={(x) => set('repositories', x)} extraFields={[{ key: 'role', label: 'Role', options: ['Frontend', 'Backend', 'Full Stack', 'Mobile', 'Monorepo', 'Shared Library', 'Infrastructure', 'Documentation', 'Website'] }]} /></div>
          <div className="col-lg-6">
            <MultiSelect label="Components (shared, owned by other applications)" options={componentOptions(data, (c) => !ownComponentIds.has(c.id))} value={v.sharedComponents} onChange={(x) => set('sharedComponents', x)}
              help={app ? `${ownComponents.length} own component(s) are linked automatically through their parent application.` : 'Own components are added after creation from the Components page.'} />
          </div>
          <div className="col-lg-6"><MultiSelect label="APIs & Services provided" options={providedOptions} value={v.providedApis} onChange={(x) => set('providedApis', x)} help="An API has exactly one provider application; APIs already provided elsewhere are hidden." /></div>
          <div className="col-lg-6"><MultiSelect label="APIs & Services consumed" options={apiOptions(data)} value={v.consumedApis} onChange={(x) => set('consumedApis', x)} /></div>
          <div className="col-lg-6"><MultiSelect label="Infrastructure" options={infrastructureOptions(data)} value={v.infrastructure} onChange={(x) => set('infrastructure', x)} extraFields={[{ key: 'role', label: 'Usage / role' }]} /></div>
          <div className="col-lg-6">
            <label className="form-label">Technology Stack</label>
            <div className="bh-card bh-card-body py-2 mb-3 small">{TECH_ROLES.some((r) => v[r.key].length) ? TECH_ROLES.filter((r) => v[r.key].length).map((r) => <div key={r.key}><strong>{r.label}:</strong> {nameList(data, 'technologies', v[r.key])}</div>) : <span className="text-subtle">Selected in Step 02.</span>}</div>
            <label className="form-label">Deployments</label>
            <div className="bh-card bh-card-body py-2 small text-muted">Deployments belong to components and appear on the application automatically.{app && <> Currently {data.deployments.filter((d) => ownComponentIds.has(d.componentId)).length} deployment(s).</>}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'review', title: app ? 'Review & Save' : 'Review & Create', description: 'Confirm before saving',
      render: () => (
        <ReviewSummary sections={[
          { title: 'Basic Information', fields: [
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
