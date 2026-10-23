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
 * The Zod 3 schema library for A2UI. Importing it installs nothing: an app
 * installs the library with `import '@a2ui/schema-zod3/install'`, or by
 * passing `zod3SchemaLibrary()` to `installSchemaLibrary`, and a catalog can
 * compile its document with `zod3CatalogSchemaCompiler` alone.
 */

export {exclusiveUnion, exclusiveUnionOverride} from './catalog/exclusive_union.js';
export {
  getSpecAnnotation,
  spec,
  specDef,
  type SpecAnnotation,
  type SpecMixin,
} from './catalog/spec_annotations.js';
export {zod3CatalogSchemaCompiler} from './catalog/zod3_catalog_compiler.js';
export {zod3ToJsonSchema} from './catalog/zod3_json_schema.js';
export {zod3SchemaLibrary} from './catalog/zod3_schema_library.js';
export {isZod3Schema, zodSchemaOf} from './catalog/zod_schema.js';
export * from './common/index.js';
