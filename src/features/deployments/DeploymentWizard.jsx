import { useNavigate, useParams, useSearchParams } from 'react-router';
import PageHeader from '../../components/common/PageHeader';
import StepWizard from '../../components/forms/StepWizard';
import FormField from '../../components/forms/FormField';
import FormSelect from '../../components/forms/FormSelect';
import FormTextarea from '../../components/forms/FormTextarea';
import MultiSelect from '../../components/forms/MultiSelect';
import ReviewSummary from '../../components/common/ReviewSummary';
import StatusBadge from '../../components/badges/StatusBadge';
import { useWizardForm, requireFields } from '../../components/forms/useWizardForm';
import { useRegistry } from '../../hooks/useRegistry';
import { useToast } from '../../hooks/useToast';
import { useFormat } from '../../hooks/useFormat';
import { createEntity, updateEntity } from '../../services/registry.service';
import { byId } from '../../services/query.service';
import { DEPLOYMENT_STATUSES } from '../../services/schema';
import { applicationOptions, componentOptions, repositoryOptions, infrastructureOptions, linkValues, nameList } from '../../utils/options';
import { slugify } from '../../helpers';
import NotFoundPage from '../overview/NotFoundPage';

const FIELDS = ['name', 'code', 'applicationId', 'componentId', 'repositoryId', 'infrastructureId', 'environment', 'deploymentType', 'platform', 'version', 'status', 'deployMethod', 'branch', 'deploymentUrl', 'healthCheckUrl', 'lastDeployedAt', 'notes'];
const toLocal = (iso) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const fromLocal = (s) => (s ? new Date(s).toISOString() : null);

export default function DeploymentWizard({ mode = 'create' }) {
  const { id } = useParams();
  const { data } = useRegistry();
  const dep = mode === 'edit' ? data.deployments.find((d) => d.id === id) : null;
  if (mode === 'edit' && !dep) return <NotFoundPage />;
  return <Body dep={dep} />;
}

function Body({ dep }) {
  const { data, run } = useRegistry();
  const toast = useToast();
  const fmt = useFormat();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preCmp = params.get('component') || '';
  const preApp = params.get('application') || '';
  const form = useWizardForm(() => {
    const base = dep ? Object.fromEntries(FIELDS.map((f) => [f, dep[f] ?? ''])) : {
      name: '', code: '', applicationId: preApp, componentId: preCmp, repositoryId: '', infrastructureId: '', environment: '', deploymentType: '', platform: '', version: '',
      status: 'active', deployMethod: '', branch: 'main', deploymentUrl: '', healthCheckUrl: '', lastDeployedAt: '', notes: '',
    };
    base.lastDeployedAt = toLocal(base.lastDeployedAt);
    const cmpId = base.componentId;
    if (!base.applicationId && cmpId) base.applicationId = byId(data, 'components', cmpId)?.applicationId || '';
    base.included = dep ? linkValues(data, 'componentDeployments', 'deploymentId', 'componentId', dep.id, ['notes']) : [];
    return base;
  });
  const { values: v, set, bind, bindSelect } = form;
  const cat = data.categories;
  const cmpOpts = componentOptions(data, (c) => !v.applicationId || c.applicationId === v.applicationId);
  const pickApp = (appId) => {
    set('applicationId', appId);
    if (v.componentId && byId(data, 'components', v.componentId)?.applicationId !== appId) set('componentId', '');
  };
  const pickComponent = (cmpId) => {
    set('componentId', cmpId);
    const c = byId(data, 'components', cmpId);
    if (c) set('applicationId', c.applicationId);
  };

  const save = () => {
    const values = Object.fromEntries(FIELDS.map((f) => [f, v[f]]));
    values.lastDeployedAt = fromLocal(v.lastDeployedAt);
    values.componentId = values.componentId || null;
    values.applicationId = values.applicationId || (values.componentId ? byId(data, 'components', values.componentId)?.applicationId || null : null);
    values.repositoryId = values.repositoryId || null;
    values.infrastructureId = values.infrastructureId || null;
    if (!values.code) values.code = slugify(values.name);
    const links = [{ relation: 'componentDeployments', side: 'to', items: v.included.filter((x) => x.targetId !== v.componentId) }];
    if (dep) {
      run(updateEntity, 'deployments', dep.id, values, links);
      toast(`Deployment ${dep.id} updated.`);
      navigate(`/deployments/${dep.id}`);
    } else {
      const id = run(createEntity, 'deployments', values, links);
      toast(`Deployment ${id} created.`);
      navigate(`/deployments/${id}`);
    }
  };

  const componentPlaceholder = cmpOpts.length ? 'Optional — select component' : 'No components available';
  const componentHelp = !cmpOpts.length
    ? 'Optional — no components registered for the selected application.'
    : 'Optional — select a specific component if applicable.';

  const steps = [
    {
      key: 'info', title: 'Deployment Information', description: 'Where and what is deployed',
      fields: ['name', 'environment', 'status', 'deploymentUrl', 'healthCheckUrl'],
      validate: () => requireFields(v, [['name', 'Deployment name'], ['environment', 'Environment'], ['status', 'Status']]),
      render: () => (
        <div className="row">
          <div className="col-md-8"><FormField label="Deployment Name" required placeholder="e.g. Orange LMS Web – Production" {...bind('name')} /></div>
          <div className="col-md-4"><FormField label="Deployment Code" placeholder="auto from name" {...bind('code')} /></div>
          <div className="col-md-6"><FormSelect label="Application" options={applicationOptions(data)} value={v.applicationId} onChange={pickApp} help="Links the deployment to an application and filters components." /></div>
          <div className="col-md-6"><FormSelect label="Component" options={cmpOpts} placeholder={componentPlaceholder} disabled={!cmpOpts.length} {...bindSelect('componentId')} onChange={pickComponent} help={componentHelp} /></div>
          <div className="col-md-4"><FormSelect label="Environment" required options={cat.environments} {...bindSelect('environment')} /></div>
          <div className="col-md-4"><FormSelect label="Deployment Type" options={cat.deploymentTypes} format={(x) => x} {...bindSelect('deploymentType')} /></div>
          <div className="col-md-4"><FormField label="Hosting Platform" placeholder="e.g. Vercel, Render" list="bh-platforms" {...bind('platform')} /></div>
          <datalist id="bh-platforms">{[...new Set([...data.deployments.map((d) => d.platform), ...data.infrastructure.map((i) => i.provider)])].filter(Boolean).map((p) => <option key={p} value={p} />)}</datalist>
          <div className="col-md-3"><FormField label="Version / Release" placeholder="1.0.0" {...bind('version')} /></div>
          <div className="col-md-3"><FormSelect label="Status" required options={DEPLOYMENT_STATUSES} {...bindSelect('status')} /></div>
          <div className="col-md-3"><FormSelect label="Deploy Method" options={cat.deployMethods} format={(x) => x} {...bindSelect('deployMethod')} /></div>
          <div className="col-md-3"><FormField label="Branch / Source" placeholder="main" {...bind('branch')} /></div>
          <div className="col-md-6"><FormField label="Deployment URL" type="url" placeholder="https://…" {...bind('deploymentUrl')} /></div>
          <div className="col-md-6"><FormField label="Health Check URL" type="url" placeholder="https://…/health" {...bind('healthCheckUrl')} help="Stored for reference only — not polled." /></div>
          <div className="col-md-4"><FormField label="Deployed At" type="datetime-local" {...bind('lastDeployedAt')} /></div>
          <div className="col-md-8"><FormTextarea label="Description" rows={2} {...bind('notes')} /></div>
        </div>
      ),
    },
    {
      key: 'relations', title: 'Relations & Resources', description: 'Source and infrastructure',
      fields: ['repositoryId', 'infrastructureId'],
      render: () => (
        <div className="row">
          <div className="col-md-6"><FormSelect label="Application" options={applicationOptions(data)} value={v.applicationId} onChange={pickApp} /></div>
          <div className="col-md-6"><FormSelect label="Component" options={cmpOpts} placeholder={componentPlaceholder} disabled={!cmpOpts.length} {...bindSelect('componentId')} onChange={pickComponent} help={componentHelp} /></div>
          <div className="col-md-6"><FormSelect label="Repository" options={repositoryOptions(data)} {...bindSelect('repositoryId')} placeholder="None" /></div>
          <div className="col-md-6"><FormSelect label="Infrastructure Resource" options={infrastructureOptions(data)} {...bindSelect('infrastructureId')} placeholder="None" /></div>
          <div className="col-lg-8"><MultiSelect label="Other components included in this deployment" options={componentOptions(data, (c) => c.id !== v.componentId)} value={v.included} onChange={(x) => set('included', x)} extraFields={[{ key: 'notes', label: 'Notes' }]} help="Optional, e.g. a shared library bundled into the build." /></div>
        </div>
      ),
    },
    {
      key: 'review', title: 'Review & Save', description: 'Confirm before saving',
      render: () => (
        <ReviewSummary sections={[
          { title: 'Deployment', fields: [
            { label: 'Name', value: v.name }, { label: 'Code', value: v.code || slugify(v.name) },
            { label: 'Environment', value: v.environment && <StatusBadge value={v.environment} dot={false} /> }, { label: 'Status', value: v.status && <StatusBadge value={v.status} /> },
            { label: 'Type', value: v.deploymentType }, { label: 'Hosting Platform', value: v.platform }, { label: 'Version', value: v.version },
            { label: 'Deploy Method', value: v.deployMethod }, { label: 'Branch', value: v.branch }, { label: 'Deployed At', value: v.lastDeployedAt && fmt.dateTime(fromLocal(v.lastDeployedAt)) },
            { label: 'Deployment URL', value: v.deploymentUrl }, { label: 'Health Check URL', value: v.healthCheckUrl }, { label: 'Description', value: v.notes, wide: true },
          ] },
          { title: 'Relationships', fields: [
            { label: 'Application', value: byId(data, 'applications', v.applicationId)?.name },
            { label: 'Component', value: byId(data, 'components', v.componentId)?.name },
            { label: 'Repository', value: byId(data, 'repositories', v.repositoryId)?.name },
            { label: 'Infrastructure', value: byId(data, 'infrastructure', v.infrastructureId)?.name },
            { label: 'Also includes', value: nameList(data, 'components', v.included) },
          ] },
        ]} />
      ),
    },
  ];
  return (
    <>
      <PageHeader title={dep ? `Edit ${dep.name}` : 'Add Deployment'} description={dep ? `Update ${dep.id}.` : 'Record a deployment of an application or component to an environment.'} />
      <StepWizard steps={steps} errors={form.errors} setErrors={form.setErrors} dirty={form.dirty} onSubmit={save}
        onCancel={() => navigate(dep ? `/deployments/${dep.id}` : '/deployments')} submitLabel={dep ? 'Save Changes' : 'Save Deployment'} />
    </>
  );
}
