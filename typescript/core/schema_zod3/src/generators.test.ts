/*
 * Copyright 2026 Google LLC
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

import {describe, it} from 'node:test';
import assert from 'node:assert';

import {ExtensionsSchema} from './index.js';

const zodCore = await import(new URL('../../scripts/zod-generator-core.mjs', import.meta.url).href);
const {
  getHeader,
  transformZodSyntax,
  getDependencies,
  analyzeDependencies,
  resolveRefTarget,
  prepareRef,
  compileDefToZod,
} = zodCore;

const supersetGen = await import(
  new URL('../../scripts/generate-superset-common-types.mjs', import.meta.url).href
);
const {deepMergeSchemas, escapeStr, generateZod} = supersetGen;

describe('zod-generator-core.mjs', () => {
  it('generates standard header comment with version and script source', () => {
    const header = getHeader('v1.0', 'scripts/test-source.mjs');
    assert.ok(header.includes('Copyright 2024 Google LLC'));
    assert.ok(header.includes('AUTO-GENERATED FILE - DO NOT EDIT MANUALLY'));
    assert.ok(header.includes('specification/v1.0/json/ via scripts/test-source.mjs'));
  });

  it('transforms raw json-schema-to-zod syntax cleanly', () => {
    const raw = `export const DynamicNumberSchema: z.ZodType<unknown> = z.union([z.number(), z.literal("__REF__DataBindingSchema__")]);
const x = z.core.$ZodIssue;
ctx.addIssue(issue);
if (a == i) {}`;

    const cleaned = transformZodSyntax(raw);
    assert.ok(!cleaned.includes(': z.ZodType<unknown>'));
    assert.ok(cleaned.includes('export const DynamicNumberSchema ='));
    assert.ok(cleaned.includes('DataBindingSchema'));
    assert.ok(!cleaned.includes('__REF__'));
    assert.ok(cleaned.includes('z.ZodIssue'));
    assert.ok(cleaned.includes('ctx.addIssue(issue as any);'));
    assert.ok(cleaned.includes('=== i)'));
  });

  it('extracts definition dependencies from JSON schema nodes', () => {
    const schemaNode = {
      type: 'object',
      properties: {
        id: {$ref: '#/$defs/ComponentId'},
        action: {$ref: '#/$defs/Action'},
      },
    };
    const deps = getDependencies(schemaNode);
    assert.ok(deps.has('ComponentId'));
    assert.ok(deps.has('Action'));
  });

  it('ignores FunctionCall.oneOf during dependency analysis to avoid false cycles', () => {
    const functionCallNode = {
      type: 'object',
      properties: {
        call: {type: 'string'},
        args: {$ref: '#/$defs/DynamicValue'},
      },
      oneOf: [{$ref: '#/$defs/IndexSystemFunction'}],
    };
    const deps = getDependencies(functionCallNode, new Set(), 'FunctionCall');
    assert.ok(deps.has('DynamicValue'));
    assert.ok(!deps.has('IndexSystemFunction'));
  });

  it('analyzes dependency graph and performs topological sorting and cycle detection', () => {
    const defs = {
      A: {$ref: '#/$defs/B'},
      B: {$ref: '#/$defs/C'},
      C: {type: 'string'},
      Cyclic1: {$ref: '#/$defs/Cyclic2'},
      Cyclic2: {$ref: '#/$defs/Cyclic1'},
    };
    const {topologicalOrder, lazyEdges} = analyzeDependencies(defs);
    assert.ok(topologicalOrder.indexOf('C') < topologicalOrder.indexOf('B'));
    assert.ok(topologicalOrder.indexOf('B') < topologicalOrder.indexOf('A'));
    assert.ok(lazyEdges.has('Cyclic1->Cyclic2') || lazyEdges.has('Cyclic2->Cyclic1'));
  });

  it('resolves $ref targets with appropriate wrappers and lazy evaluation', () => {
    const lazyEdges = new Set(['Parent->Child']);
    const topo = ['Child', 'Parent'];

    const lazyRef = resolveRefTarget('#/$defs/Child', 'Parent', lazyEdges, topo);
    assert.deepStrictEqual(lazyRef, {enum: ['__REF__z.lazy(() => ChildSchema)__']});

    const normalRef = resolveRefTarget('#/$defs/Child', 'Parent', new Set(), topo);
    assert.deepStrictEqual(normalRef, {enum: ['__REF__ChildSchema__']});

    const remoteRef = resolveRefTarget('https://example.com/schema.json', 'Parent');
    assert.deepStrictEqual(remoteRef, {type: 'object', additionalProperties: true});

    const themeRef = resolveRefTarget('catalog.json#/$defs/theme', 'Parent');
    assert.deepStrictEqual(themeRef, {});
  });

  it('prepares ref nodes for json-schema-to-zod syntax replacement', () => {
    const res = prepareRef({$ref: '#/$defs/DynamicNumber'}, 'Parent');
    assert.deepStrictEqual(res, {enum: ['__REF__DynamicNumberSchema__']});
  });

  it('compiles a JSON Schema definition into Zod code', () => {
    const def = {
      type: 'object',
      properties: {
        title: {type: 'string'},
        count: {type: 'number'},
      },
      required: ['title'],
    };
    const code = compileDefToZod(def, 'TestWidget');
    assert.ok(code.includes('export const TestWidgetSchema ='));
    assert.ok(code.includes('export type TestWidget = z.infer<typeof TestWidgetSchema>'));
  });
});

describe('generate-superset-common-types.mjs', () => {
  it('escapes string literals safely', () => {
    assert.strictEqual(escapeStr("hello 'world'"), "hello \\'world\\'");
    assert.strictEqual(escapeStr('line1\nline2'), 'line1\\nline2');
    assert.strictEqual(escapeStr(''), '');
  });

  it('generates Zod code for primitive types, arrays, objects, and literals', () => {
    const strCode = generateZod({type: 'string', default: 'abc', description: 'desc'});
    assert.ok(strCode.includes("z.string().default('abc').describe('desc')"));

    const numCode = generateZod({type: 'integer', default: 5});
    assert.ok(numCode.includes('z.number().int().default(5)'));

    const arrCode = generateZod({type: 'array', items: {type: 'string'}, minItems: 1});
    assert.ok(arrCode.includes('z.array(z.string()).min(1)'));

    const constCode = generateZod({const: 'Surface'});
    assert.ok(constCode.includes("z.literal('Surface')"));
  });

  it('validates ExtensionsSchema enforcing UAX #31 Unicode identifier keys', () => {
    // Valid Unicode identifier keys
    const valid = {
      a2ui_custom: 'test',
      myExt123: 42,
      _private_key: true,
      valid_identifier: {nested: 'value'},
    };
    const validResult = ExtensionsSchema.safeParse(valid);
    assert.strictEqual(validResult.success, true);

    // Invalid keys: containing dashes, spaces, punctuation, or leading digits
    const invalidWithDash = ExtensionsSchema.safeParse({'invalid-key': 123});
    assert.strictEqual(invalidWithDash.success, false);

    const invalidWithSpace = ExtensionsSchema.safeParse({'invalid key': 123});
    assert.strictEqual(invalidWithSpace.success, false);

    const invalidWithLeadingDigit = ExtensionsSchema.safeParse({'123start': 123});
    assert.strictEqual(invalidWithLeadingDigit.success, false);
  });

  it('generates a merged object schema with oneOf constraints as an object', () => {
    const merged = deepMergeSchemas([
      {
        type: 'object',
        properties: {
          functionCallId: {$ref: '#/$defs/CallId'},
          value: {description: 'The return value of the function.'},
          error: {type: 'object', properties: {code: {type: 'string'}}},
        },
        required: ['functionCallId'],
        oneOf: [{required: ['value']}, {required: ['error']}],
        additionalProperties: false,
      },
    ]);
    const generated = generateZod(merged, 'FunctionResponse');
    assert.ok(generated.includes('z.object({'));
    assert.ok(generated.includes("'functionCallId': CallIdSchema"));
    assert.ok(generated.includes("'value': z.unknown()"));
    assert.ok(!generated.includes('z.union([z.unknown(), z.unknown()])'));
  });
});
