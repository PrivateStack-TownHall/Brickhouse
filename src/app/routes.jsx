import { createHashRouter } from 'react-router';
import AppShell from '../components/layout/AppShell';
import OverviewPage from '../features/overview/OverviewPage';
import ApplicationsPage from '../features/applications/ApplicationsPage';
import ApplicationDetailPage from '../features/applications/ApplicationDetailPage';
import ApplicationWizard from '../features/applications/ApplicationWizard';
import RepositoriesPage from '../features/repositories/RepositoriesPage';
import RepositoryDetailPage from '../features/repositories/RepositoryDetailPage';
import RepositoryWizard from '../features/repositories/RepositoryWizard';
import ComponentsPage from '../features/components/ComponentsPage';
import ComponentDetailPage from '../features/components/ComponentDetailPage';
import ComponentWizard from '../features/components/ComponentWizard';
import DeploymentsPage from '../features/deployments/DeploymentsPage';
import DeploymentDetailPage from '../features/deployments/DeploymentDetailPage';
import DeploymentWizard from '../features/deployments/DeploymentWizard';
import ApisPage from '../features/apis/ApisPage';
import ApiDetailPage from '../features/apis/ApiDetailPage';
import ApiWizard from '../features/apis/ApiWizard';
import TechnologiesPage from '../features/technologies/TechnologiesPage';
import TechnologyDetailPage from '../features/technologies/TechnologyDetailPage';
import InfrastructurePage from '../features/infrastructure/InfrastructurePage';
import InfrastructureDetailPage from '../features/infrastructure/InfrastructureDetailPage';
import ArchitectureMapPage from '../features/architecture/ArchitectureMapPage';
import ProgressReviewPage from '../features/progress-review/ProgressReviewPage';
import ActivityLogPage from '../features/activities/ActivityLogPage';
import DataManagementPage from '../features/data-management/DataManagementPage';
import SettingsPage from '../features/settings/SettingsPage';
import NotFoundPage from '../features/overview/NotFoundPage';

const nameOf = (entity) => (params, data) => data[entity].find((r) => r.id === params.id)?.name || params.id;

/** CRUD routes for one registry entity. */
function registry(path, label, entity, List, Detail, Wizard) {
  return {
    path,
    handle: { crumb: label },
    children: [
      { index: true, element: <List /> },
      ...(Wizard ? [{ path: 'new', element: <Wizard key="new" />, handle: { crumb: 'New' } }] : []),
      {
        path: ':id',
        handle: { crumb: nameOf(entity) },
        children: [
          { index: true, element: <Detail /> },
          ...(Wizard ? [{ path: 'edit', element: <Wizard key="edit" mode="edit" />, handle: { crumb: 'Edit' } }] : []),
        ],
      },
    ],
  };
}

// Hash routing keeps BRICKHOUSE working from any static host or straight from disk.
export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage />, handle: { crumb: 'Overview' } },
      registry('applications', 'Applications', 'applications', ApplicationsPage, ApplicationDetailPage, ApplicationWizard),
      registry('repositories', 'Repositories', 'repositories', RepositoriesPage, RepositoryDetailPage, RepositoryWizard),
      registry('components', 'Components', 'components', ComponentsPage, ComponentDetailPage, ComponentWizard),
      registry('deployments', 'Deployments', 'deployments', DeploymentsPage, DeploymentDetailPage, DeploymentWizard),
      registry('apis', 'APIs & Services', 'apis', ApisPage, ApiDetailPage, ApiWizard),
      registry('technologies', 'Technology Stack', 'technologies', TechnologiesPage, TechnologyDetailPage),
      registry('infrastructure', 'Infrastructure', 'infrastructure', InfrastructurePage, InfrastructureDetailPage),
      { path: 'architecture', element: <ArchitectureMapPage />, handle: { crumb: 'Architecture Map' } },
      { path: 'progress', element: <ProgressReviewPage />, handle: { crumb: 'Progress & Review' } },
      { path: 'activity', element: <ActivityLogPage />, handle: { crumb: 'Activity Log' } },
      { path: 'data', element: <DataManagementPage />, handle: { crumb: 'Data Management' } },
      { path: 'settings', element: <SettingsPage />, handle: { crumb: 'Settings' } },
      { path: '*', element: <NotFoundPage />, handle: { crumb: 'Not found' } },
    ],
  },
]);
