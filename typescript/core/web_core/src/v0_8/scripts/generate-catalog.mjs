import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

import {generateJsonCatalog} from '../../../scripts/generate-catalog-types.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const v08Dir = join(__dirname, '..');
const repoRoot = join(v08Dir, '..', '..', '..', '..', '..');

console.log('Generating v0.8 Basic Catalog APIs...');

// A v0.8 catalog document has no common types, functions or catalog ID: every
// property is written inline, and the theme is the top-level `styles`.
generateJsonCatalog({
  catalogPath: join(repoRoot, 'specification', 'v0_8', 'json', 'standard_catalog_definition.json'),
  catalogModuleImportPath: '../../../catalog',
  catalogId: 'https://a2ui.org/specification/v0_8/standard_catalog_definition.json',
  protocolVersion: '0.8',
  documentOutPath: join(v08Dir, 'basic_catalog', 'basic_catalog_document.ts'),
  componentsOutPath: join(v08Dir, 'basic_catalog', 'components', 'basic_components.ts'),
});

console.log('Successfully generated v0.8 Basic Catalog APIs.');
