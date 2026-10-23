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
import {afterEach, describe, it} from 'node:test';

import {A2uiValidationError} from '../errors.js';
import {VersionAdapterFactory} from '../processing/adapters/factory.js';
import {MessageProcessor} from '../processing/message-processor.js';
import {a2uiJsonSchemaOf, zod3ToJsonSchema} from './a2ui_json_schema.js';
import {zodSchemaOf, type A2uiSchema, type StandardJSONSchemaV1} from './a2ui_schema.js';
import {
  setDefaultCatalogSchemaCompiler,
  type CatalogSchemaCompiler,
  type CatalogSchemaContext,
} from './schema_compiler.js';
import type {JsonSchemaObject} from './spec_annotations.js';
import {Catalog} from './types.js';
import {zod3CatalogSchemaCompiler} from './zod3_catalog_compiler.js';

/**
 * A schema that checks only the `required` keywords of an object schema, and
 * whose JSON Schema is that schema: what a compiler built on another
 * validator would produce.
 */
function requiredOnly(json: JsonSchemaObject): A2uiSchema & StandardJSONSchemaV1 {
  const required = (Array.isArray(json['required']) ? (json['required'] as string[]) : []).filter(
    key => !ENVELOPE.has(key),
  );
  const output = () => ({...json});
  return {
    '~standard': {
      version: 1,
      vendor: 'required-only',
      validate: value => {
        const missing = required.filter(key => !(key in (value as object)));
        return missing.length === 0
          ? {value}
          : {issues: missing.map(key => ({message: 'Required', path: [key]}))};
      },
      jsonSchema: {input: output, output},
    },
  };
}

const ENVELOPE = new Set(['id', 'component', 'catalogId']);

/** A compiler that records what it compiles. */
function recordingCompiler(): CatalogSchemaCompiler & {calls: string[]} {
  const calls: string[] = [];
  const record =
    (kind: string) =>
    (json: JsonSchemaObject | undefined, context: CatalogSchemaContext): A2uiSchema => {
      calls.push(`${kind}@${context.protocolVersion}`);
      return requiredOnly(json ?? {});
    };
  return {
    calls,
    component: record('component'),
    functionArgs: record('functionArgs'),
    theme: record('theme'),
  };
}

const DOCUMENT = {
  catalogId: 'https://example.com/compiled.json',
  components: {
    Badge: {
      type: 'object',
      properties: {component: {const: 'Badge'}, label: {type: 'string'}},
      required: ['component', 'label'],
    },
  },
  functions: {
    shout: {
      type: 'object',
      properties: {call: {const: 'shout'}, args: {type: 'object', required: ['text']}},
    },
  },
};

describe('CatalogSchemaCompiler', () => {
  afterEach(() => setDefaultCatalogSchemaCompiler(undefined));

  it('compiles the definitions of a loaded catalog on first use', () => {
    const compiler = recordingCompiler();
    const catalog = Catalog.fromJson(DOCUMENT, '0.9', undefined, {schemaCompiler: compiler});
    assert.deepStrictEqual(compiler.calls, []);
    const badge = catalog.components.get('Badge')!;
    assert.strictEqual(badge.schema['~standard'].vendor, 'required-only');
    assert.strictEqual(catalog.functions.get('shout')!.schema['~standard'].vendor, 'required-only');
    assert.deepStrictEqual(compiler.calls, ['component@0.9', 'functionArgs@0.9']);
  });

  it('is the default once set', () => {
    const compiler = recordingCompiler();
    setDefaultCatalogSchemaCompiler(compiler);
    const catalog = Catalog.fromJson(DOCUMENT, '0.9');
    assert.strictEqual(
      catalog.components.get('Badge')!.schema['~standard'].vendor,
      'required-only',
    );
  });

  it('validates the components a message processor receives', () => {
    const catalog = Catalog.fromJson(DOCUMENT, '0.9', undefined, {
      schemaCompiler: recordingCompiler(),
    });
    const proc = new MessageProcessor([catalog as never]);
    proc.processMessages([
      {version: 'v0.9', createSurface: {surfaceId: 's1', catalogId: catalog.id}},
    ]);
    const update = (component: Record<string, unknown>) =>
      proc.processMessages([
        {
          version: 'v0.9',
          updateComponents: {surfaceId: 's1', components: [component as never]},
        },
      ]);
    update({id: 'root', component: 'Badge', label: 'New'});
    assert.throws(
      () => update({id: 'other', component: 'Badge'}),
      (e: unknown) => e instanceof A2uiValidationError && /label: Required/.test(e.message),
    );
  });
});

describe('VersionAdapterFactory protocol schemas', () => {
  const malformed = {version: 'v0.9', createSurface: {surfaceId: 's1'}};

  it('validates messages with the built-in schemas by default', () => {
    const factory = new VersionAdapterFactory();
    assert.throws(
      () => factory.getAdapter('v0.9').extractOperations(malformed),
      A2uiValidationError,
    );
  });

  it('validates messages with the schemas it is given', () => {
    const rejectAll: A2uiSchema = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: () => ({issues: [{message: 'Rejected'}]}),
      },
    };
    const factory = new VersionAdapterFactory({'0.9': rejectAll});
    assert.throws(
      () =>
        factory
          .getAdapter('v0.9.1')
          .extractOperations({version: 'v0.9.1', deleteSurface: {surfaceId: 's1'}}),
      (e: unknown) => e instanceof A2uiValidationError && /root: Rejected/.test(e.message),
    );
  });

  it('skips validating a version whose schema is null', () => {
    const factory = new VersionAdapterFactory({'0.9': null});
    assert.doesNotThrow(() => factory.getAdapter('v0.9').extractOperations(malformed));
  });
});

describe('MessageProcessor schema options', () => {
  const rejectAll: A2uiSchema = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: () => ({issues: [{message: 'Rejected'}]}),
    },
  };
  const catalog = Catalog.fromJson(DOCUMENT, '0.9', undefined, {
    schemaCompiler: recordingCompiler(),
  });
  const createSurface = {version: 'v0.9', createSurface: {surfaceId: 's1', catalogId: catalog.id}};
  const badge = (extra: Record<string, unknown>) => ({
    version: 'v0.9',
    updateComponents: {
      surfaceId: 's1',
      components: [{id: 'root', component: 'Badge', label: 'New', ...extra} as never],
    },
  });

  it('validates messages with the protocol schemas it is given', () => {
    const proc = new MessageProcessor([catalog as never], undefined, {
      protocolSchemas: {'0.9': rejectAll},
    });
    assert.throws(
      () => proc.processMessages([createSurface as never]),
      (e: unknown) => e instanceof A2uiValidationError && /Rejected/.test(e.message),
    );
  });

  it('rejects protocol schemas given with an adapter registry', () => {
    assert.throws(
      () =>
        new MessageProcessor([catalog as never], undefined, {
          adapterRegistry: new VersionAdapterFactory(),
          protocolSchemas: {'0.9': null},
        }),
      /not both/,
    );
  });

  it('validates the envelope with the envelope schemas it is given', () => {
    const proc = new MessageProcessor([catalog as never], undefined, {
      envelopeSchemas: {accessibility: rejectAll},
    });
    proc.processMessages([createSurface as never]);
    assert.throws(
      () => proc.processMessages([badge({accessibility: {label: 'Badge'}}) as never]),
      (e: unknown) => e instanceof A2uiValidationError && /Rejected/.test(e.message),
    );
  });

  it('skips validating the envelope when its schemas are null', () => {
    const proc = new MessageProcessor([catalog as never], undefined, {envelopeSchemas: null});
    proc.processMessages([createSurface as never]);
    assert.doesNotThrow(() =>
      proc.processMessages([badge({accessibility: 'not an object'}) as never]),
    );
  });
});

describe('zod3CatalogSchemaCompiler', () => {
  it('returns schemas that describe themselves as JSON Schema', () => {
    const catalog = Catalog.fromJson(DOCUMENT, '0.9', undefined, {
      schemaCompiler: zod3CatalogSchemaCompiler,
    });
    const schema = zodSchemaOf(catalog.components.get('Badge')!.schema);
    const converter = (schema as unknown as StandardJSONSchemaV1)['~standard'].jsonSchema;
    assert.ok(converter, 'the compiled schema implements Standard JSON Schema');
    assert.deepStrictEqual(converter.output({target: 'draft-2020-12'}), zod3ToJsonSchema(schema));
    assert.deepStrictEqual(Object.keys(a2uiJsonSchemaOf(schema)['properties'] ?? {}), ['label']);
  });
});
