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

import * as assert from 'node:assert';
import {describe, it} from 'node:test';

import {z} from 'zod';

import {A2uiCatalogError, A2uiExpressionError} from '../errors.js';
import {
  formatA2uiSchemaIssue,
  isA2uiSchema,
  validateA2uiSchema,
  zodSchemaOf,
  type A2uiSchema,
  type InferA2uiSchemaOutput,
  type StandardSchemaV1,
} from './a2ui_schema.js';
import {Catalog, createFunctionImplementation, type ComponentApi} from './types.js';

/** A Standard Schema built without any schema library. */
function numberArgs(): A2uiSchema<{value: number}> {
  return {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value: unknown) => {
        const v = (value as {value?: unknown} | null)?.value;
        return typeof v === 'number'
          ? {value: {value: v}}
          : {issues: [{message: 'Expected a number', path: ['value']}]};
      },
    },
  };
}

describe('A2uiSchema', () => {
  it('recognizes Zod 3 schemas and other Standard Schemas', () => {
    assert.strictEqual(isA2uiSchema(z.object({})), true);
    assert.strictEqual(isA2uiSchema(numberArgs()), true);
    assert.strictEqual(isA2uiSchema({themeSchema: z.object({})}), false);
    assert.strictEqual(isA2uiSchema(null), false);
  });

  it('validates synchronously', () => {
    assert.deepStrictEqual(validateA2uiSchema(numberArgs(), {value: 1}), {value: {value: 1}});
    assert.deepStrictEqual(validateA2uiSchema(numberArgs(), {value: 'x'}).issues, [
      {message: 'Expected a number', path: ['value']},
    ]);
  });

  it('rejects a schema that validates asynchronously', () => {
    const asyncSchema: A2uiSchema = {
      '~standard': {version: 1, vendor: 'test', validate: async value => ({value})},
    };
    assert.throws(() => validateA2uiSchema(asyncSchema, {}), A2uiCatalogError);
  });

  it('formats issues with their path', () => {
    assert.strictEqual(
      formatA2uiSchemaIssue({message: 'Required', path: ['a', {key: 0}, 'b']}),
      'a.0.b: Required',
    );
    assert.strictEqual(formatA2uiSchemaIssue({message: 'Required'}), 'root: Required');
  });

  it('formats Zod 3 issues with their details', () => {
    const result = validateA2uiSchema(z.object({}).strict(), {extra: 1});
    assert.deepStrictEqual(result.issues?.map(formatA2uiSchemaIssue), [
      "root: Unrecognized key(s) in object: 'extra'",
    ]);
  });

  it('returns the Zod 3 schema behind an A2uiSchema, and rejects other schemas', () => {
    const schema = z.object({});
    assert.strictEqual(zodSchemaOf(schema), schema);
    assert.throws(() => zodSchemaOf(numberArgs()), A2uiCatalogError);
  });

  it('infers the validated type', () => {
    const props: InferA2uiSchemaOutput<ReturnType<typeof numberArgs>> = {value: 1};
    const zodProps: InferA2uiSchemaOutput<StandardSchemaV1<unknown, {text: string}>> = {
      text: 'hi',
    };
    assert.deepStrictEqual([props, zodProps], [{value: 1}, {text: 'hi'}]);
  });
});

describe('Catalog with Standard Schemas', () => {
  it('invokes a function whose arguments are validated by any Standard Schema', () => {
    const double = createFunctionImplementation(
      {name: 'double', returnType: 'number', schema: numberArgs()},
      args => args.value * 2,
    );
    const catalog = new Catalog('test-cat', '1.0', [], [double]);
    const ctx = {} as never;

    assert.strictEqual(catalog.invoker('double', {value: 21}, ctx), 42);
    assert.throws(
      () => catalog.invoker('double', {value: 'x'}, ctx),
      (e: unknown) =>
        e instanceof A2uiExpressionError &&
        e.message === "Validation failed for function 'double': value: Expected a number",
    );
  });

  it('accepts a Standard Schema as the theme schema', () => {
    const themeSchema = numberArgs();
    const catalog = new Catalog('test-cat', '1.0', [], [], themeSchema);
    assert.strictEqual(catalog.themeSchema, themeSchema);
  });

  it('types component properties from the schema', () => {
    const api = {name: 'Counter', schema: numberArgs()} satisfies ComponentApi;
    const catalog = new Catalog('test-cat', '1.0', [api]);
    assert.strictEqual(catalog.components.get('Counter'), api);
  });
});
