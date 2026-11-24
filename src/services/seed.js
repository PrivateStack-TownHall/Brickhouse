// Initial / master seed data. These JSON files are read-only at runtime:
// BRICKHOUSE copies them into Local Storage on first launch and never writes back.
import companies from '../../database/core/companies.json';
import applications from '../../database/core/applications.json';
import repositories from '../../database/core/repositories.json';
import components from '../../database/core/components.json';
import apis from '../../database/core/apis.json';
import endpoints from '../../database/core/endpoints.json';
import deployments from '../../database/core/deployments.json';
import reviews from '../../database/core/reviews.json';
import commits from '../../database/core/git-commits.json';
import technologies from '../../database/catalog/technologies.json';
import infrastructure from '../../database/catalog/infrastructure.json';
import categories from '../../database/catalog/categories.json';
import applicationRepositories from '../../database/relationships/application-repositories.json';
import applicationComponents from '../../database/relationships/application-components.json';
import componentRepositories from '../../database/relationships/component-repositories.json';
import componentTechnologies from '../../database/relationships/component-technologies.json';
import componentInfrastructure from '../../database/relationships/component-infrastructure.json';
import componentServices from '../../database/relationships/component-services.json';
import applicationApis from '../../database/relationships/application-apis.json';
import apiConsumers from '../../database/relationships/api-consumers.json';
import componentDeployments from '../../database/relationships/component-deployments.json';
import componentApis from '../../database/relationships/component-apis.json';
import apiInfrastructure from '../../database/relationships/api-infrastructure.json';
import applicationTechnologies from '../../database/relationships/application-technologies.json';
import applicationInfrastructure from '../../database/relationships/application-infrastructure.json';
import activities from '../../database/system/activities.json';
import settings from '../../database/system/settings.json';
import schemaVersion from '../../database/system/schema-version.json';
import idSequences from '../../database/system/id-sequences.json';

const SEED = {
  schemaVersion: schemaVersion.version,
  companies, applications, repositories, components, apis, endpoints, deployments, reviews, commits,
  technologies, infrastructure, categories,
  applicationRepositories, applicationComponents, componentRepositories, componentTechnologies,
  componentInfrastructure, componentServices, applicationApis, apiConsumers, componentDeployments,
  componentApis, apiInfrastructure, applicationTechnologies, applicationInfrastructure,
  activities, settings, idSequences,
};

export const SEED_SCHEMA = schemaVersion;

/** A fresh deep copy of the seed dataset (the imported modules are never mutated). */
export function buildSeedDataset() {
  const ds = JSON.parse(JSON.stringify(SEED));
  ds.meta = { source: 'seed', initializedAt: new Date().toISOString(), lastBackupAt: null, lastRestoreAt: null };
  return ds;
}
