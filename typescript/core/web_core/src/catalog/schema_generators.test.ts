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

import {describe, it} from 'node:test';
import assert from 'node:assert';

const schemaMerge = await import(
  new URL('../../../scripts/schema-merge.mjs', import.meta.url).href
);
const {
  getLatestDescription,
  mergeUnionSchemas,
  collectAllPropertyNames,
  findRequiredInAllProperties,
  mergeObjectSchemas,
  mergeEnumSchemas,
  deepMergeSchemas,
} = schemaMerge;

describe('schema-merge.mjs', () => {
  it('merges object schemas with oneOf constraints as objects rather than union of unknowns', () => {
    const functionResponseV10 = {
      type: 'object',
      description: 'The return response matching a function invocation.',
      properties: {
        functionCallId: {$ref: '#/$defs/CallId'},
        value: {description: 'The return value of the function.'},
        error: {
          type: 'object',
          properties: {
            code: {type: 'string'},
            message: {type: 'string'},
          },
          required: ['code', 'message'],
          additionalProperties: false,
        },
      },
      required: ['functionCallId'],
      oneOf: [{required: ['value']}, {required: ['error']}],
      additionalProperties: false,
    };

    const merged = deepMergeSchemas([functionResponseV10]);
    assert.strictEqual(merged.type, 'object');
    assert.ok(merged.properties);
    assert.ok(merged.properties.functionCallId);
    assert.ok(merged.properties.value);
    assert.ok(merged.properties.error);
    assert.strictEqual(merged.oneOf, undefined);
  });

  it('merges enum schemas across multiple specification versions', () => {
    const enumV09 = {type: 'string', enum: ['off', 'polite']};
    const enumV10 = {type: 'string', enum: ['polite', 'assertive']};

    const merged = mergeEnumSchemas([enumV09, enumV10]);
    assert.deepStrictEqual(merged.enum.sort(), ['assertive', 'off', 'polite']);
  });

  it('merges union schemas and deduplicates branches', () => {
    const u1 = {oneOf: [{type: 'string'}, {$ref: '#/$defs/DataBinding'}]};
    const u2 = {oneOf: [{$ref: '#/$defs/DataBinding'}, {type: 'number'}]};

    const merged = mergeUnionSchemas([u1, u2]);
    assert.strictEqual(merged.oneOf.length, 3);
  });

  it('collects all property names across multiple schemas', () => {
    const s1 = {properties: {a: {type: 'string'}, b: {type: 'number'}}};
    const s2 = {properties: {b: {type: 'number'}, c: {type: 'boolean'}}};

    const names = collectAllPropertyNames([s1, s2]);
    assert.deepStrictEqual(Array.from(names).sort(), ['a', 'b', 'c']);
  });

  it('finds properties that are required across all versions where they exist', () => {
    const s1 = {properties: {id: {type: 'string'}, name: {type: 'string'}}, required: ['id']};
    const s2 = {
      properties: {id: {type: 'string'}, name: {type: 'string'}},
      required: ['id', 'name'],
    };

    const required = findRequiredInAllProperties([s1, s2], ['id', 'name']);
    assert.deepStrictEqual(required, ['id']);
  });

  it('retrieves the latest description from a list of schemas', () => {
    assert.strictEqual(
      getLatestDescription([{description: 'Old description'}, {description: 'New description'}]),
      'New description',
    );
    assert.strictEqual(getLatestDescription([{}, {}]), undefined);
  });

  it('merges object schemas and resolves combined property definitions', () => {
    const s1 = {type: 'object', properties: {a: {type: 'string'}}, required: ['a']};
    const s2 = {type: 'object', properties: {b: {type: 'number'}}, required: ['b']};
    const merged = mergeObjectSchemas([s1, s2]);
    assert.strictEqual(merged.type, 'object');
    assert.ok(merged.properties.a);
    assert.ok(merged.properties.b);
  });
});

const catalogTypesGen = await import(
  new URL('../../../scripts/generate-catalog-types.mjs', import.meta.url).href
);
const {TypeWriter, toPascalCase} = catalogTypesGen;

describe('generate-catalog-types.mjs', () => {
  const commonTypes = {
    $defs: {
      DynamicString: {anyOf: [{type: 'string'}, {type: 'object'}]},
      ComponentCommon: {
        type: 'object',
        properties: {id: {type: 'string'}, accessibility: {type: 'object'}},
        required: ['id'],
      },
      Inlined: {type: 'array', items: {type: 'number'}},
    },
  };
  const catalog = {
    $defs: {Shared: {type: 'object', properties: {weight: {type: 'number'}}}},
  };
  const writer = () => new TypeWriter(catalog, commonTypes, new Set(['DynamicString']));

  it('converts function names to PascalCase identifiers', () => {
    assert.strictEqual(toPascalCase('@index'), 'Index');
    assert.strictEqual(toPascalCase('format_string'), 'FormatString');
    assert.strictEqual(toPascalCase('open-url'), 'OpenUrl');
  });

  it('writes common types the module exports by name, and inlines the others', () => {
    const types = writer();
    assert.strictEqual(
      types.type({$ref: 'common_types.json#/$defs/DynamicString'}, catalog),
      'DynamicString',
    );
    assert.strictEqual(types.type({$ref: 'common_types.json#/$defs/Inlined'}, catalog), 'number[]');
    assert.deepStrictEqual([...types.usedCommonTypes], ['DynamicString']);
  });

  it('writes enums, constants, unions and primitives', () => {
    const types = writer();
    assert.strictEqual(
      types.type({type: 'string', enum: ['a', 'b']}, catalog),
      "'a' | 'b'".replace(/'/g, '"'),
    );
    assert.strictEqual(types.type({const: 3}, catalog), '3');
    assert.strictEqual(
      types.type({oneOf: [{type: 'string'}, {type: 'integer'}]}, catalog),
      'string | number',
    );
    assert.strictEqual(types.type({description: 'anything'}, catalog), 'any');
    assert.strictEqual(
      types.type({type: 'object', additionalProperties: {type: 'boolean'}}, catalog),
      'Record<string, boolean>',
    );
  });

  it("flattens a component's mixins into its props, without the envelope", () => {
    const types = writer();
    const members = types.componentMembers({
      allOf: [
        {$ref: 'common_types.json#/$defs/ComponentCommon'},
        {$ref: '#/$defs/Shared'},
        {
          type: 'object',
          properties: {
            component: {const: 'Box'},
            label: {$ref: 'common_types.json#/$defs/DynamicString'},
          },
          required: ['component', 'label'],
        },
      ],
    });
    assert.deepStrictEqual(
      members.map(({key, required}: {key: string; required: boolean}) => [key, required]),
      [
        ['accessibility', false],
        ['weight', false],
        ['label', true],
      ],
    );
    assert.match(types.members(members), /label: DynamicString;/);
  });
});
