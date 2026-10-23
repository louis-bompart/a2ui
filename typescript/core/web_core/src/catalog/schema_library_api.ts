/*
 * Copyright 2026 Google LLC
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
/**
 * What a schema library, such as `@a2ui/schema-zod3`, uses from web_core:
 * the `SchemaLibrary` contract, the JSON Schema view of schemas, the
 * resolution of a catalog document's references, and the common types
 * definitions of each protocol version.
 */

export {
  a2uiJsonSchemaOf,
  arrayItems,
  CHILD_LIST_DEF_NAMES,
  COMPONENT_ID_DEF_NAMES,
  coreJsonSchema,
  isJsonObject,
  objectProperties,
  refDefName,
  unionBranches,
} from './a2ui_json_schema.js';
export {
  defineA2uiSchema,
  formatA2uiSchemaIssue,
  isA2uiSchema,
  resolveDeferredA2uiSchema,
  validateA2uiSchema,
  type A2uiSchema,
  type A2uiSchemaResult,
  type InferA2uiSchemaOutput,
  type StandardJSONSchemaV1,
  type StandardSchemaV1,
} from './a2ui_schema.js';
export type {JsonSchemaObject} from './json_schema.js';
export {
  setDefaultCatalogSchemaCompiler,
  type CatalogSchemaCompiler,
  type CatalogSchemaContext,
} from './schema_compiler.js';
export {
  installSchemaLibrary,
  schemaLibraries,
  uninstallSchemaLibrary,
  type CatalogDocumentContext,
  type CatalogDocumentShaper,
  type EnvelopeSchemas,
  type ProtocolSchemas,
  type SchemaLibrary,
} from './schema_library.js';
export {
  canonicalJsonStringify,
  isEnvelopeField,
  isShorthandParameterMap,
  PeerScope,
  resolveJsonPointer,
  resolvePeerTarget,
  throwUnresolvableRef,
  type PeerCatalogSource,
} from './schema_loader.js';
export {DEFAULT_COMMON_TYPES_URI, standardDefsForVersion} from './standard_defs.js';
export {formatZodIssue, type ZodIssueLike} from '../processing/format-zod-issue.js';
