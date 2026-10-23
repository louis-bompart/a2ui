/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Catalog interfaces and component/function registration utilities.
 */

export {
  defineA2uiSchema,
  formatA2uiSchemaIssue,
  isA2uiSchema,
  validateA2uiSchema,
  type A2uiSchema,
  type A2uiSchemaResult,
  type InferA2uiSchemaOutput,
  type StandardJSONSchemaV1,
  type StandardSchemaV1,
} from './a2ui_schema.js';
export {
  setDefaultCatalogSchemaCompiler,
  type CatalogSchemaCompiler,
  type CatalogSchemaContext,
} from './schema_compiler.js';
export type {PeerCatalogSource} from './schema_loader.js';
export {
  installSchemaLibrary,
  uninstallSchemaLibrary,
  type CatalogDocumentContext,
  type CatalogDocumentShaper,
  type EnvelopeSchemas,
  type ProtocolSchemas,
  type SchemaLibrary,
} from './schema_library.js';
export * from './types.js';
export * from './function_invoker.js';
export {JsonComponentApi, JsonFunctionApi} from './json_entries.js';
export type {JsonSchemaObject} from './json_schema.js';
