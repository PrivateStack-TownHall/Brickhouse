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
import { byId, providerOfApi } from '../../services/query.service';
import { LIFECYCLES } from '../../services/schema';
import { applicationOptions, componentOptions, infrastructureOptions, linkValues, nameList } from '../../utils/options';
import { slugify } from '../../helpers';
import NotFoundPage from '../overview/NotFoundPage';

const FIELDS = ['name', 'code', 'serviceType', 'protocol', 'baseUrl', 'authentication', 'version', 'lifecycle', 'environment', 'exposure', 'documentationUrl', 'description', 'tags'];

export default function ApiWizard({ mode = 'create' }) {
  const { id } = useParams();
  const { data } = useRegistry();
  const api = mode === 'edit' ? data.apis.find((a) => a.id === id) : null;
  if (mode === 'edit' && !api) return <NotFoundPage />;
  return <Body api={api} />;
}

function Body({ api }) {
  const { data, run } = useRegistry();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id = api?.id;
  const cmpLinks = id ? data.componentApis.filter((l) => l.apiId === id) : [];
  const form = useWizardForm(() => ({
    ...(api ? Object.fromEntries(FIELDS.map((f) => [f, api[f] ?? (f === 'tags' ? [] : '')]))
      : { name: '', code: '', serviceType: '', protocol: 'REST', baseUrl: '', authentication: '', version: 'v1', lifecycle: 'planning', environment: '', exposure: 'internal', documentationUrl: '', description: '', tags: [] }),
    providerId: id ? providerOfApi(data, id)?.id || '' : params.get('application') || '',
    relatedComponent: cmpLinks.find((l) => l.role === 'provider')?.componentId || '',
    consumers: id ? linkValues(data, 'apiConsumers', 'apiId', 'applicationId', id) : [],
    infrastructure: id ? linkValues(data, 'apiInfrastructure', 'apiId', 'infrastructureId', id) : [],
  }));
  const { values: v, set, bind, bindSelect } = form;
  const cat = data.categories;
  const setType = (t) => { set('serviceType', t); if (t === 'External Service') set('exposure', 'external'); };

  const save = () => {
    const values = Object.fromEntries(FIELDS.map((f) => [f, v[f]]));
    if (!values.code) values.code = slugify(values.name);
    const otherCmpLinks = cmpLinks.filter((l) => l.role !== 'provider').map((l) => ({ targetId: l.componentId, role: l.role }));
    const links = [
      { relation: 'applicationApis', side: 'to', items: v.providerId ? [{ targetId: v.providerId, role: 'provider' }] : [] },
      { relation: 'componentApis', side: 'to', items: [...(v.relatedComponent ? [{ targetId: v.relatedComponent, role: 'provider' }] : []), ...otherCmpLinks] },
      { relation: 'apiConsumers', side: 'from', items: v.consumers.filter((c) => c.targetId !== v.providerId) },
      { relation: 'apiInfrastructure', side: 'from', items: v.infrastructure },
    ];
    if (api) {
      run(updateEntity, 'apis', api.id, values, links);
      toast(`API ${api.id} updated.`);
      navigate(`/apis/${api.id}`);
    } else {
      const newId = run(createEntity, 'apis', values, links);
      toast(`API ${newId} created.`);
      navigate(`/apis/${newId}`);
    }
  };

  const providerSelects = (
    <>
      <div className="col-md-6"><FormSelect label="Owner / Provider Application" options={applicationOptions(data)} {...bindSelect('providerId')} placeholder="None (external service)" help="An API is provided by one application." /></div>
      <div className="col-md-6"><FormSelect label="Related Component" options={componentOptions(data, (c) => !v.providerId || c.applicationId === v.providerId)} {...bindSelect('relatedComponent')} placeholder="None" help="The component that implements this API." /></div>
    </>
  );
  const steps = [
    {
      key: 'info', title: 'API & Service Information', description: 'Interface definition',
      fields: ['name', 'serviceType', 'protocol', 'authentication', 'lifecycle', 'baseUrl', 'documentationUrl'],
      validate: () => requireFields(v, [['name', 'Name'], ['serviceType', 'Service type'], ['protocol', 'Protocol'], ['authentication', 'Authentication'], ['lifecycle', 'Lifecycle']]),
      render: () => (
        <div className="row">
          <div className="col-md-6"><FormField label="API / Service Name" required placeholder="e.g. Orange LMS API" {...bind('name')} /></div>
          <div className="col-md-3"><FormField label="Service Code" placeholder="auto from name" {...bind('code')} /></div>
          <div className="col-md-3"><FormField label="Version" placeholder="v1" {...bind('version')} /></div>
          <div className="col-md-4"><FormSelect label="Service Type" required options={cat.serviceTypes} format={(x) => x} {...bindSelect('serviceType')} onChange={setType} /></div>
          <div className="col-md-4"><FormSelect label="Protocol" required options={cat.protocols} format={(x) => x} {...bindSelect('protocol')} /></div>
          <div className="col-md-4"><FormSelect label="Authentication" required options={cat.authenticationMethods} format={(x) => x} {...bindSelect('authentication')} /></div>
          <div className="col-md-8"><FormField label="Base URL" type="url" placeholder="https://api.example.com/v1" {...bind('baseUrl')} /></div>
          <div className="col-md-4"><FormSelect label="Exposure" options={[{ value: 'internal', label: 'Internal' }, { value: 'external', label: 'External' }]} {...bindSelect('exposure')} /></div>
          {providerSelects}
          <div className="col-md-4"><FormSelect label="Lifecycle" required options={LIFECYCLES} {...bindSelect('lifecycle')} /></div>
          <div className="col-md-4"><FormSelect label="Environment" options={cat.environments} {...bindSelect('environment')} /></div>
          <div className="col-md-4"><FormField label="Documentation URL" type="url" placeholder="https://…" {...bind('documentationUrl')} /></div>
          <div className="col-12"><FormTextarea label="Description" {...bind('description')} /></div>
          <div className="col-12"><TagInput label="Tags" value={v.tags} onChange={(x) => set('tags', x)} /></div>
        </div>
      ),
    },
    {
      key: 'relations', title: 'Relations & Integration', description: 'Provider and consumers',
      render: () => (
        <div className="row">
          {providerSelects}
          <div className="col-lg-6"><MultiSelect label="Consumer Applications" options={applicationOptions(data).filter((o) => o.value !== v.providerId)} value={v.consumers} onChange={(x) => set('consumers', x)} help="Provider and consumers are stored separately." /></div>
          <div className="col-lg-6"><MultiSelect label="Infrastructure" options={infrastructureOptions(data)} value={v.infrastructure} onChange={(x) => set('infrastructure', x)} /></div>
        </div>
      ),
    },
    {
      key: 'review', title: 'Review & Save', description: 'Confirm before saving',
      render: () => (
        <ReviewSummary sections={[
          { title: 'API & Service', fields: [
            { label: 'Name', value: v.name }, { label: 'Code', value: v.code || slugify(v.name) }, { label: 'Service Type', value: v.serviceType },
            { label: 'Protocol', value: v.protocol }, { label: 'Authentication', value: v.authentication }, { label: 'Version', value: v.version },
            { label: 'Base URL', value: v.baseUrl }, { label: 'Exposure', value: v.exposure }, { label: 'Lifecycle', value: v.lifecycle && <StatusBadge value={v.lifecycle} /> },
            { label: 'Environment', value: v.environment }, { label: 'Tags', value: v.tags.join(', ') }, { label: 'Description', value: v.description, wide: true },
          ] },
          { title: 'Relationships', fields: [
            { label: 'Provider Application', value: byId(data, 'applications', v.providerId)?.name }, { label: 'Related Component', value: byId(data, 'components', v.relatedComponent)?.name },
            { label: 'Consumers', value: nameList(data, 'applications', v.consumers) }, { label: 'Infrastructure', value: nameList(data, 'infrastructure', v.infrastructure) },
          ] },
        ]} />
      ),
    },
  ];
  return (
    <>
      <PageHeader title={api ? `Edit ${api.name}` : 'Add API & Service'} description={api ? `Update ${api.id}. Endpoints are managed on the API detail page.` : 'Register an API, microservice, integration or external service.'} />
      <StepWizard steps={steps} errors={form.errors} setErrors={form.setErrors} dirty={form.dirty} onSubmit={save}
        onCancel={() => navigate(api ? `/apis/${api.id}` : '/apis')} submitLabel={api ? 'Save Changes' : 'Save API & Service'} />
    </>
  );
}
