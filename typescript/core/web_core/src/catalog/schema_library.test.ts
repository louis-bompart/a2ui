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
import {PayloadValidator} from '../validation/payload-validator.js';
import {a2uiJsonSchemaOf} from './a2ui_json_schema.js';
import {defineA2uiSchema, type A2uiSchema} from './a2ui_schema.js';
import type {CatalogSchemaCompiler} from './schema_compiler.js';
import {
  installSchemaLibrary,
  uninstallSchemaLibrary,
  type SchemaLibrary,
} from './schema_library.js';
import {Catalog} from './types.js';

const rejectAll = (message: string): A2uiSchema => ({
  '~standard': {version: 1, vendor: 'test', validate: () => ({issues: [{message}]})},
});

const acceptAll: A2uiSchema = {
  '~standard': {version: 1, vendor: 'test', validate: value => ({value})},
};

describe('installSchemaLibrary', () => {
  const installed: SchemaLibrary[] = [];
  const install = (library: SchemaLibrary) => {
    installed.push(library);
    installSchemaLibrary(library);
  };
  afterEach(() => {
    for (const library of installed.splice(0)) uninstallSchemaLibrary(library);
  });

  it('converts the schemas of a library to JSON Schema', () => {
    const marker = {
      '~standard': {version: 1, vendor: 'marker', validate: (v: unknown) => ({value: v})},
    };
    install({
      name: 'marker',
      toJsonSchema: schema =>
        schema['~standard'].vendor === 'marker' ? {type: 'string'} : undefined,
    });
    assert.deepStrictEqual(a2uiJsonSchemaOf(marker as A2uiSchema), {type: 'string'});
  });

  it("validates protocol messages with the library's schemas", () => {
    install({name: 'strict', protocolSchemas: {'0.9': rejectAll('Rejected by library')}});
    assert.throws(
      () =>
        new VersionAdapterFactory()
          .getAdapter('v0.9')
          .extractOperations({version: 'v0.9', deleteSurface: {surfaceId: 's1'}}),
      (e: unknown) => e instanceof A2uiValidationError && /Rejected by library/.test(e.message),
    );
  });

  it("validates the envelope properties with the library's schemas", () => {
    install({name: 'strict', envelopeSchemas: {accessibility: rejectAll('Bad accessibility')}});
    const catalog = new Catalog('test-cat', '0.9', [
      {name: 'Box', schema: defineA2uiSchema({type: 'object', properties: {}}, value => ({value}))},
    ]);
    assert.throws(
      () =>
        new PayloadValidator(catalog).validateComponent({
          id: 'b',
          component: 'Box',
          accessibility: {label: 'x'},
        }),
      (e: unknown) => e instanceof A2uiValidationError && /Bad accessibility/.test(e.message),
    );
  });

  it("compiles loaded catalogs with the library's compiler", () => {
    const compiler: CatalogSchemaCompiler = {
      component: () => acceptAll,
      functionArgs: () => acceptAll,
      theme: () => acceptAll,
    };
    install({name: 'permissive', catalogSchemaCompiler: compiler});
    const catalog = Catalog.fromJson({
      catalogId: 'https://example.com/permissive.json',
      components: {Box: {type: 'object', properties: {}, additionalProperties: false}},
    });
    assert.strictEqual(catalog.components.get('Box')!.schema['~standard'].vendor, 'test');
  });

  it('gives precedence to the library installed last', () => {
    install({name: 'first', protocolSchemas: {'0.9': rejectAll('first')}});
    install({name: 'second', protocolSchemas: {'0.9': null}});
    assert.doesNotThrow(() =>
      new VersionAdapterFactory()
        .getAdapter('v0.9')
        .extractOperations({version: 'v0.9', createSurface: {surfaceId: 's1'}}),
    );
  });
});
