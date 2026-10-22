/*
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Catalog,
  catalogDocumentOptions,
  type ComponentApi,
  type FunctionApi,
} from '../../catalog/types.js';
import type {A2uiSchema} from '../../catalog/a2ui_schema.js';
import {LOADED_BASIC_CATALOG} from './basic_catalog_document.js';
import {BASIC_COMPONENTS} from './components/basic_components.js';

/**
 * The ID of the v0.8 basic (standard) catalog. The published v0.8 catalog
 * document declares no `catalogId`, so this is the ID v0.8 messages use for it.
 */
export const BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v0_8/standard_catalog_definition.json';

/**
 * Schema of the v0.8 basic catalog's theme, the `styles` of its published
 * document.
 */
export const ThemeSchema: A2uiSchema = LOADED_BASIC_CATALOG.themeSchema!;

/**
 * The v0.8 basic catalog: the component APIs of the published v0.8 standard
 * catalog and its `styles` theme, without implementations.
 *
 * Its components, theme and document-level fields are those `Catalog.fromJson`
 * loads from the published catalog document (see
 * src/v0_8/scripts/generate-catalog.mjs), so `toJson` writes the published
 * document and `validationSchema` is built from it.
 */
export const basicCatalog = new Catalog<ComponentApi, FunctionApi>(
  BASIC_CATALOG_ID,
  '0.8',
  BASIC_COMPONENTS,
  [],
  {...catalogDocumentOptions(LOADED_BASIC_CATALOG), themeSchema: ThemeSchema},
);
