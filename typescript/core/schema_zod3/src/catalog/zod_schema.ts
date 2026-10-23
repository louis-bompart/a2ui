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

import {A2uiCatalogError} from '@a2ui/web_core/errors';
import {resolveDeferredA2uiSchema, type A2uiSchema} from '@a2ui/web_core/schema-library';
import type {z} from 'zod';

/**
 * Returns the Zod 3 schema behind an `A2uiSchema`, such as the schema of an
 * entry `Catalog.fromJson` loaded with the Zod 3 catalog schema compiler.
 *
 * @throws A2uiCatalogError when the schema is not a Zod 3 schema.
 */
export function zodSchemaOf(model: A2uiSchema): z.ZodTypeAny {
  const schema = resolveDeferredA2uiSchema(model);
  if (!isZod3Schema(schema)) {
    throw new A2uiCatalogError(
      `Schema from '${schema['~standard']?.vendor}' is not a Zod 3 schema.`,
    );
  }
  return schema as unknown as z.ZodTypeAny;
}

/**
 * Whether a schema is a Zod 3 schema, or a deferred schema that compiles to
 * one.
 *
 * Checked through the vendor name, a string that survives property renaming
 * by minifiers such as Closure Compiler. Zod 4 schemas, which have the same
 * vendor name, are told apart by their `_zod` internals.
 */
export function isZod3Schema(model: A2uiSchema): boolean {
  const schema = resolveDeferredA2uiSchema(model);
  return schema['~standard']?.vendor === 'zod' && (schema as {_zod?: unknown})._zod === undefined;
}
