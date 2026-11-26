import { useNavigate, useParams, useSearchParams } from 'react-router';
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
import ComponentGuidePanel from './ComponentGuidePanel';

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
            <ComponentGuidePanel />
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
