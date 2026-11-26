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
import { VISIBILITIES, ACCESS_STATUSES } from '../../services/schema';
import { ACCESS_STATUS_LABELS, REPOSITORY_LANGUAGES, REPOSITORY_ROLES } from '../../constants/registry';
import { applicationOptions, componentOptions, linkValues, nameList } from '../../utils/options';
import { slugify } from '../../helpers';
import NotFoundPage from '../overview/NotFoundPage';

const FIELDS = ['name', 'code', 'provider', 'organization', 'url', 'type', 'visibility', 'accessStatus', 'mainBranch', 'language', 'description', 'topics'];

export default function RepositoryWizard({ mode = 'create' }) {
  const { id } = useParams();
  const { data } = useRegistry();
  const repo = mode === 'edit' ? data.repositories.find((r) => r.id === id) : null;
  if (mode === 'edit' && !repo) return <NotFoundPage />;
  return <Body repo={repo} />;
}

function Body({ repo }) {
  const { data, run } = useRegistry();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const preApp = params.get('application');
  const form = useWizardForm(() => ({
    ...(repo ? Object.fromEntries(FIELDS.map((f) => [f, repo[f] ?? (f === 'topics' ? [] : '')]))
      : { name: '', code: '', provider: 'GitHub', organization: '', url: '', type: '', visibility: 'private', accessStatus: 'unknown', mainBranch: 'main', language: '', description: '', topics: [] }),
    applications: repo ? linkValues(data, 'applicationRepositories', 'repositoryId', 'applicationId', repo.id, ['role']) : preApp ? [{ targetId: preApp, role: '' }] : [],
    components: repo ? linkValues(data, 'componentRepositories', 'repositoryId', 'componentId', repo.id, ['path']) : [],
  }));
  const { values: v, set, bind, bindSelect } = form;

  const save = () => {
    const values = Object.fromEntries(FIELDS.map((f) => [f, v[f]]));
    if (!values.code) values.code = slugify(values.name);
    const links = [
      { relation: 'applicationRepositories', side: 'to', items: v.applications },
      { relation: 'componentRepositories', side: 'to', items: v.components },
    ];
    if (repo) {
      run(updateEntity, 'repositories', repo.id, values, links);
      toast(`Repository ${repo.id} updated.`);
      navigate(`/repositories/${repo.id}`);
    } else {
      const id = run(createEntity, 'repositories', values, links);
      toast(`Repository ${id} created.`);
      navigate(`/repositories/${id}`);
    }
  };

  const steps = [
    {
      key: 'info', title: 'Repository Information', description: 'Provider, location & defaults',
      fields: ['name', 'provider', 'type', 'visibility', 'url'],
      validate: () => requireFields(v, [['name', 'Repository name'], ['provider', 'Provider'], ['type', 'Repository type'], ['visibility', 'Visibility']]),
      render: () => (
        <div className="row">
          <div className="col-md-6"><FormField label="Repository Name" required placeholder="e.g. orange-lms-frontend" {...bind('name')} /></div>
          <div className="col-md-3"><FormField label="Repository Code" placeholder="auto from name" {...bind('code')} /></div>
          <div className="col-md-3"><FormSelect label="Provider" required options={data.categories.repositoryProviders} format={(x) => x} {...bindSelect('provider')} /></div>
          <div className="col-md-4"><FormField label="Organization / Group" placeholder="e.g. orange-kode" {...bind('organization')} /></div>
          <div className="col-md-8"><FormField label="Repository URL" type="url" placeholder="https://github.com/org/repo" {...bind('url')} /></div>
          <div className="col-md-3"><FormSelect label="Repository Type" required options={data.categories.repositoryTypes} {...bindSelect('type')} /></div>
          <div className="col-md-3"><FormSelect label="Visibility" required options={VISIBILITIES} {...bindSelect('visibility')} /></div>
          <div className="col-md-3"><FormSelect label="Access Status" options={ACCESS_STATUSES.map((a) => ({ value: a, label: ACCESS_STATUS_LABELS[a] }))} {...bindSelect('accessStatus')} help="Last manual access check." /></div>
          <div className="col-md-3"><FormField label="Primary Branch" placeholder="main" {...bind('mainBranch')} /></div>
          <div className="col-md-6"><FormSelect label="Default Language" options={REPOSITORY_LANGUAGES} format={(x) => x} {...bindSelect('language')} /></div>
          <div className="col-md-6" />
          <div className="col-12"><FormTextarea label="Description" {...bind('description')} /></div>
          <div className="col-12"><TagInput label="Topics / Tags" value={v.topics} onChange={(t) => set('topics', t)} /></div>
        </div>
      ),
    },
    {
      key: 'relations', title: 'Relations & Usage', description: 'Applications and components',
      render: () => (
        <div className="row">
          <div className="col-lg-6"><MultiSelect label="Applications" options={applicationOptions(data)} value={v.applications} onChange={(x) => set('applications', x)}
            extraFields={[{ key: 'role', label: 'Role', options: REPOSITORY_ROLES }]}
            help="A repository can serve several applications." /></div>
          <div className="col-lg-6"><MultiSelect label="Components" options={componentOptions(data)} value={v.components} onChange={(x) => set('components', x)}
            extraFields={[{ key: 'path', label: 'Path in repo (optional)' }]} help="Components whose source lives in this repository." /></div>
        </div>
      ),
    },
    {
      key: 'review', title: 'Review & Save', description: 'Confirm before saving',
      render: () => (
        <ReviewSummary sections={[
          { title: 'Repository', fields: [
            { label: 'Name', value: v.name }, { label: 'Code', value: v.code || slugify(v.name) }, { label: 'Provider', value: v.provider },
            { label: 'Organization', value: v.organization }, { label: 'URL', value: v.url }, { label: 'Type', value: v.type },
            { label: 'Visibility', value: v.visibility && <StatusBadge value={v.visibility} /> }, { label: 'Access Status', value: v.accessStatus }, { label: 'Primary Branch', value: v.mainBranch },
            { label: 'Language', value: v.language }, { label: 'Topics', value: v.topics.join(', ') }, { label: 'Description', value: v.description, wide: true },
          ] },
          { title: 'Relationships', fields: [
            { label: 'Applications', value: nameList(data, 'applications', v.applications) },
            { label: 'Components', value: nameList(data, 'components', v.components) },
          ] },
        ]} />
      ),
    },
  ];
  return (
    <>
      <PageHeader title={repo ? `Edit ${repo.name}` : 'Add Repository'} description={repo ? `Update ${repo.id}.` : 'Register a source code repository.'} />
      <StepWizard steps={steps} errors={form.errors} setErrors={form.setErrors} dirty={form.dirty} onSubmit={save}
        onCancel={() => navigate(repo ? `/repositories/${repo.id}` : '/repositories')} submitLabel={repo ? 'Save Changes' : 'Save Repository'} />
    </>
  );
}
