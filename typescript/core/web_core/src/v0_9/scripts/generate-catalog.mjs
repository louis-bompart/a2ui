/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateJsonCatalog} from '../../../scripts/generate-catalog-types.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const v09Dir = join(__dirname, '..');
const repoRoot = join(v09Dir, '..', '..', '..', '..', '..');

console.log('Generating v0.9 Basic Catalog APIs...');

generateJsonCatalog({
  catalogPath: join(repoRoot, 'specification', 'v0_9', 'catalogs', 'basic', 'catalog.json'),
  commonTypesPath: join(repoRoot, 'specification', 'v0_9', 'json', 'common_types.json'),
  commonTypesModulePath: join(v09Dir, 'schema', 'common-types.ts'),
  commonTypesImportPath: '../../schema/common-types.js',
  catalogModuleImportPath: '../../../catalog',
  protocolVersion: '0.9',
  documentOutPath: join(v09Dir, 'basic_catalog', 'basic_catalog_document.ts'),
  componentsOutPath: join(v09Dir, 'basic_catalog', 'components', 'basic_components.ts'),
  specFunctionApisAlias: 'V09_SPEC_FUNCTION_APIS',
  functionsOutPath: join(v09Dir, 'basic_catalog', 'functions', 'basic_functions_api.ts'),
});

console.log('Successfully generated v0.9 Basic Catalog APIs.');
