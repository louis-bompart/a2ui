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

import type {StandardJSONSchemaV1, StandardSchemaV1} from '@standard-schema/spec';
import type {z} from 'zod';

import {A2uiCatalogError} from '../errors.js';
import {formatZodIssue} from '../processing/format-zod-issue.js';

export type {StandardJSONSchemaV1, StandardSchemaV1};

/**
 * Schema of a catalog entry's properties or arguments, or of a catalog's theme.
 *
 * Any [Standard Schema](https://standardschema.dev) is accepted, such as a
 * schema built with Zod (3.24 or later), Valibot or ArkType.
 *
 * @template Output The type of a value the schema has validated.
 */
export type A2uiSchema<Output = unknown> = StandardSchemaV1<unknown, Output>;

/** The type of a value that the schema `S` has validated. */
export type InferA2uiSchemaOutput<S extends A2uiSchema> = StandardSchemaV1.InferOutput<S>;

/** The result of validating a value against an `A2uiSchema`. */
export type A2uiSchemaResult<Output> = StandardSchemaV1.Result<Output>;

/** Whether a value is an `A2uiSchema`, that is, implements Standard Schema. */
export function isA2uiSchema(value: unknown): value is A2uiSchema {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return false;
  }
  const props = (value as Partial<StandardSchemaV1>)['~standard'];
  return typeof props === 'object' && props !== null && typeof props.validate === 'function';
}

/**
 * Validates a value against a schema synchronously.
 *
 * @throws A2uiCatalogError when the schema validates asynchronously, which
 *     A2UI does not support because payloads are processed synchronously.
 */
export function validateA2uiSchema<Output>(
  schema: A2uiSchema<Output>,
  value: unknown,
): A2uiSchemaResult<Output> {
  const result = schema['~standard'].validate(value);
  if (result instanceof Promise) {
    throw new A2uiCatalogError(
      `Schema from '${schema['~standard'].vendor}' validated asynchronously, which A2UI does not support.`,
    );
  }
  return result;
}

/**
 * Formats a validation issue as `<path>: <message>`, with `root` for an
 * issue without a path.
 *
 * Issues reported by Zod 3 are formatted with `formatZodIssue`, which keeps
 * details such as the unrecognized keys of an object.
 */
export function formatA2uiSchemaIssue(issue: StandardSchemaV1.Issue): string {
  if (isZodIssue(issue)) {
    return formatZodIssue(issue);
  }
  const path =
    issue.path?.map(segment => String(typeof segment === 'object' ? segment.key : segment)) ?? [];
  return `${path.join('.') || 'root'}: ${issue.message}`;
}

function isZodIssue(issue: StandardSchemaV1.Issue): issue is z.ZodIssue {
  return typeof (issue as {code?: unknown}).code === 'string' && Array.isArray(issue.path);
}

/**
 * Returns the Zod 3 schema behind an `A2uiSchema`.
 *
 * Parts of web_core still read the structure of Zod 3 schemas to serialize
 * and bind components. Until they read the schema's JSON Schema instead, they
 * accept only Zod 3 schemas.
 *
 * @internal
 * @throws A2uiCatalogError when the schema is not a Zod 3 schema.
 */
export function zodSchemaOf(schema: A2uiSchema): z.ZodTypeAny {
  // Checked through the vendor name, a string that survives property renaming
  // by minifiers such as Closure Compiler. Zod 4 schemas, which have the same
  // vendor name, are told apart by their `_zod` internals.
  const isZod3 =
    schema['~standard']?.vendor === 'zod' && (schema as {_zod?: unknown})._zod === undefined;
  if (!isZod3) {
    throw new A2uiCatalogError(
      `Schema from '${schema['~standard']?.vendor}' is not supported yet: only Zod 3 schemas are.`,
    );
  }
  return schema as unknown as z.ZodTypeAny;
}
