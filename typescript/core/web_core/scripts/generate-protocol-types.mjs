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

import {readFileSync, writeFileSync} from 'node:fs';
import {join, posix} from 'node:path';
import {fileURLToPath} from 'node:url';

import {TypeWriter} from './generate-catalog-types.mjs';
import {deepMergeSchemas, inlineAllOfRefs} from './generate-superset-common-types.mjs';

/**
 * @fileoverview Generates the TypeScript types of the A2UI protocol from the
 * JSON schemas of the specification.
 *
 * Each protocol version gets one module per group of messages, at the paths
 * the Zod schemas of web_core used to live at. Every definition a module
 * declares is a named type, which a `$ref` to it is written as; the few types
 * whose JSON Schema does not say what TypeScript should, such as the recursive
 * `FunctionCall` and `DynamicValue`, are written by hand below.
 */

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SPEC = join(ROOT, '..', '..', '..', 'specification');

const HEADER = `/*
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

// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from the specification's JSON schemas via scripts/generate-protocol-types.mjs
`;

const RETURN_TYPES = "'string' | 'number' | 'boolean' | 'array' | 'object' | 'any' | 'void'";

/**
 * Writes the types of a group of JSON documents, resolving references across
 * them and to the named types of every module of the group.
 */
class ProtocolTypeWriter extends TypeWriter {
  /**
   * @param {Map<string, object>} docs The documents, by file name.
   * @param {Map<string, {name: string, module: string}>} named The named
   *     types, by `<file>#<pointer>` of the schema they stand for.
   * @param {string} module The module being written.
   * @param {Record<string, string>} constTypes Types to write for `const` values.
   */
  constructor(docs, named, module, constTypes) {
    super({}, {}, new Set());
    this.docs = docs;
    this.fileOfDoc = new Map([...docs].map(([file, doc]) => [doc, file]));
    this.named = named;
    this.module = module;
    this.constTypes = constTypes;
    /** Types to import, by module. */
    this.imports = new Map();
  }

  locate(ref, doc) {
    const hash = ref.indexOf('#');
    const file = hash === -1 ? ref : ref.slice(0, hash);
    const pointer = hash === -1 ? '#' : ref.slice(hash);
    return {file: file === '' ? this.fileOfDoc.get(doc) : posix.basename(file), pointer};
  }

  resolve(ref, doc) {
    const {file, pointer} = this.locate(ref, doc);
    const target = this.docs.get(file);
    if (!target) throw new Error(`Unresolvable reference: ${ref}`);
    let node = target;
    for (const segment of pointer.slice(1).split('/').filter(Boolean)) {
      node = node?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    if (node === undefined) throw new Error(`Unresolvable reference: ${ref}`);
    return {node, doc: target, isCommon: false};
  }

  namedType(ref, doc) {
    const {file, pointer} = this.locate(ref, doc);
    // A reference into a catalog document, such as to its `anyComponent`,
    // stands for whatever the catalog declares.
    if (!this.docs.has(file)) return 'any';
    const entry = this.named.get(`${file}${pointer}`);
    if (!entry) return undefined;
    this.use(entry);
    return entry.name;
  }

  /** Records that the module uses a named type. */
  use(entry) {
    if (entry.module === this.module) return;
    if (!this.imports.has(entry.module)) this.imports.set(entry.module, new Set());
    this.imports.get(entry.module).add(entry.name);
  }

  constType(value) {
    return this.constTypes[value] ?? super.constType(value);
  }
}

/**
 * Generates the modules of a group of protocol types.
 *
 * @param {object} group
 * @param {string} group.specDir The directory of the JSON documents.
 * @param {string} group.outDir The directory to write the modules to.
 * @param {Record<string, string>} [group.constTypes] Types to write for `const` values.
 * @param {Record<string, object>} [group.docs] Documents to use instead of reading them.
 * @param {boolean} [group.index] Whether to write an `index.ts` that exports every module.
 * @param {string[]} [group.indexExtras] Other modules the index exports.
 * @param {Array<{module: string, types: Array<object>}>} group.modules The
 *     modules, each with its types: `{name, file, pointer}` for the schema at
 *     `pointer` in `file`, or `{name, ts, uses}` for a type written by hand
 *     that uses the named types `uses`, with an optional `description`.
 */
export function generateProtocolTypes(group) {
  const docs = new Map();
  const load = file => {
    if (!docs.has(file)) {
      docs.set(
        file,
        group.docs?.[file] ?? JSON.parse(readFileSync(join(group.specDir, file), 'utf-8')),
      );
    }
    return docs.get(file);
  };
  const named = new Map();
  const byName = new Map();
  for (const {module, types} of group.modules) {
    for (const type of types) {
      const entry = {name: type.name, module};
      byName.set(type.name, entry);
      if (type.file) {
        load(type.file);
        named.set(`${type.file}${type.pointer}`, entry);
      }
    }
  }
  for (const file of group.extraDocs ?? []) load(file);

  for (const {module, types, reexports = []} of group.modules) {
    const writer = new ProtocolTypeWriter(docs, named, module, group.constTypes ?? {});
    const blocks = [];
    for (const type of types) {
      let ts;
      let description = type.description;
      if (type.ts) {
        ts = type.ts;
        for (const name of type.uses ?? []) writer.use(byName.get(name));
      } else {
        const schema = writer.resolve(type.pointer, load(type.file)).node;
        description ??= schema.description;
        // The schema itself, not the reference to its own name.
        ts = writer.type({...schema}, load(type.file), new Set([`false:${type.pointer}`]));
      }
      blocks.push(`${jsDoc(description)}export type ${type.name} = ${ts};`);
    }
    const imports = [...writer.imports]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([from, names]) => `import type {${[...names].sort().join(', ')}} from './${from}.js';`)
      .join('\n');
    const head = [imports, ...reexports].filter(Boolean).join('\n');
    writeFileSync(
      join(group.outDir, `${module}.ts`),
      `${HEADER}${head ? `\n${head}\n` : ''}\n${blocks.join('\n\n')}\n`,
    );
  }
  if (group.index) {
    const lines = [...group.modules.map(({module}) => module), ...(group.indexExtras ?? [])].map(
      module => `export * from './${module}.js';`,
    );
    writeFileSync(join(group.outDir, 'index.ts'), `${HEADER}\n${lines.join('\n')}\n`);
  }
}

function jsDoc(description) {
  if (typeof description !== 'string' || !description.trim()) return '';
  const lines = description.trim().replace(/\*\//g, '*\\/').split('\n');
  return `/**\n${lines.map(l => ` * ${l}`.trimEnd()).join('\n')}\n */\n`;
}

/** Returns a type entry for each definition of a document. */
function defs(file, doc, overrides = {}) {
  return Object.keys(doc.$defs).map(name => ({
    name,
    file,
    pointer: `#/$defs/${name}`,
    ...overrides[name],
  }));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

/** Generates the v0.9 protocol types. */
export function generateV09Types() {
  const specDir = join(SPEC, 'v0_9', 'json');
  const common = readJson(join(specDir, 'common_types.json'));
  const s2c = readJson(join(specDir, 'server_to_client.json'));
  const messages = s2c.oneOf.map(ref => ref.$ref.split('/').pop());
  generateProtocolTypes({
    specDir,
    outDir: join(ROOT, 'src', 'v0_9', 'schema'),
    index: true,
    indexExtras: ['zod/index'],
    constTypes: {'v0.9': "'v0.9' | 'v0.9.1'"},
    modules: [
      {
        module: 'common-types',
        types: defs('common_types.json', common, {
          DynamicValue: {
            ts: 'string | number | boolean | unknown[] | DataBinding | FunctionCall',
            description: common.$defs.DynamicValue.description,
          },
          FunctionCall: {
            ts: `{\n  call: string;\n  args?: Record<string, unknown>;\n  returnType?: ${RETURN_TYPES};\n}`,
            description: common.$defs.FunctionCall.description,
          },
        }),
      },
      {
        module: 'server-to-client',
        types: [
          ...messages.map(name => ({
            name,
            file: 'server_to_client.json',
            pointer: `#/$defs/${name}`,
          })),
          {name: 'A2uiMessage', ts: messages.join(' | '), description: s2c.description},
          {name: 'A2uiMessageList', ts: 'A2uiMessage[]', description: 'A list of messages.'},
          {
            name: 'A2uiMessageListWrapper',
            ts: '{\n  messages: A2uiMessageList;\n}',
            description: 'An object wrapping a list of messages.',
          },
        ],
      },
      {
        module: 'client-to-server',
        types: [
          {name: 'A2uiClientAction', file: 'client_to_server.json', pointer: '#/properties/action'},
          {
            name: 'A2uiClientError',
            file: 'client_to_server.json',
            pointer: '#/properties/error',
          },
          {
            name: 'A2uiClientMessage',
            ts: "{\n  version: 'v0.9' | 'v0.9.1';\n} & ({action: A2uiClientAction} | {error: A2uiClientError})",
            description: 'A message sent from the client to the server.',
          },
          {name: 'A2uiClientDataModel', file: 'client_data_model.json', pointer: '#'},
          {
            name: 'A2uiClientMessageList',
            ts: 'A2uiClientMessage[]',
            description: 'A list of client messages.',
          },
          {
            name: 'A2uiClientMessageListWrapper',
            ts: '{\n  messages: A2uiClientMessageList;\n}',
            description: 'An object wrapping a list of client messages.',
          },
        ],
      },
      {
        module: 'client-capabilities',
        types: [
          {name: 'JsonSchema', ts: 'Record<string, unknown>', description: 'A JSON Schema.'},
          {
            name: 'FunctionDefinition',
            file: 'client_capabilities.json',
            pointer: '#/$defs/FunctionDefinition',
          },
          {name: 'InlineCatalog', file: 'client_capabilities.json', pointer: '#/$defs/Catalog'},
          {
            name: 'A2uiVersionCapabilities',
            file: 'client_capabilities.json',
            pointer: '#/properties/v0.9',
          },
        ],
      },
      {
        module: 'helpers',
        types: [
          {
            name: 'TemplateChildList',
            ts: '{\n  componentId: ComponentId;\n  path: string;\n}',
            uses: ['ComponentId'],
            description:
              'A template for generating a dynamic list of children from a data model list.',
          },
          {
            name: 'AnyComponent',
            ts: '{\n  component: string;\n  id?: ComponentId;\n  weight?: number;\n  [key: string]: unknown;\n}',
            uses: ['ComponentId'],
            description: 'A generic A2UI component definition.',
          },
          {
            name: 'A2uiClientCapabilities',
            ts: "{'v0.9': any; 'v0.9.1'?: any} | {'v0.9'?: any; 'v0.9.1': any}",
            description: 'The capabilities a v0.9 client reports.',
          },
        ],
      },
    ],
  });
}

/** Generates the v1.0 protocol types. */
export function generateV10Types() {
  const specDir = join(SPEC, 'v1_0', 'json');
  const common = readJson(join(specDir, 'common_types.json'));
  const a2r = readJson(join(specDir, 'agent_to_renderer.json'));
  const r2a = readJson(join(specDir, 'renderer_to_agent.json'));
  const catalogDefinition = readJson(join(specDir, 'catalog_definition.json'));
  const messages = a2r.oneOf.map(ref => ref.$ref.split('/').pop());
  const outgoing = r2a.oneOf.map(item => item.required.find(k => k !== 'version'));
  const outgoingName = prop => `${prop.charAt(0).toUpperCase()}${prop.slice(1)}Message`;
  generateProtocolTypes({
    specDir,
    outDir: join(ROOT, 'src', 'v1_0', 'schema'),
    index: true,
    indexExtras: ['zod/index'],
    modules: [
      {
        module: 'common-types',
        types: defs('common_types.json', common, {
          Child: {ts: 'ComponentId', description: common.$defs.Child.description},
          DataBinding: {
            ts: "{\n  '@path'?: string;\n  path?: string;\n}",
            description: common.$defs.DataBinding.description,
          },
          FunctionCommon: {
            ts: "{\n  '@call'?: string;\n  call?: string;\n  catalogId?: string;\n}",
            description: common.$defs.FunctionCommon.description,
          },
          IndexSystemFunction: {
            ts: "{\n  '@call'?: '@index';\n  call?: '@index';\n  args?: {offset?: DynamicNumber};\n}",
            description: common.$defs.IndexSystemFunction.description,
          },
          FunctionCall: {
            ts: `{\n  call?: string;\n  '@call'?: string;\n  catalogId?: string;\n  args?: Record<string, unknown>;\n  returnType?: ${RETURN_TYPES};\n}`,
            description: common.$defs.FunctionCall.description,
          },
          DynamicValue: {
            ts: 'string | number | boolean | unknown[] | DataBinding | FunctionCall | Record<string, unknown>',
            description: common.$defs.DynamicValue.description,
          },
          Extensions: {
            ts: 'Record<string, unknown>',
            description: common.$defs.Extensions.description,
          },
          FunctionResponse: {
            ts: '{\n  functionCallId: CallId;\n  value?: any;\n  error?: {code: string; message: string};\n}',
            description: common.$defs.FunctionResponse.description,
          },
        }),
      },
      {
        module: 'agent-to-renderer',
        types: [
          ...messages.map(name => ({
            name,
            file: 'agent_to_renderer.json',
            pointer: `#/$defs/${name}`,
          })),
          {name: 'AgentToRendererMessage', ts: messages.join(' | '), description: a2r.description},
        ],
      },
      {
        module: 'renderer-to-agent',
        types: [
          ...outgoing.map(prop => ({
            name: outgoingName(prop),
            ts: `{\n  version: 'v1.0';\n  ${prop}: ${prop}Payload;\n}`,
            payload: prop,
          })),
          {
            name: 'RendererToAgentMessage',
            ts: outgoing.map(outgoingName).join(' | '),
            description: r2a.description,
          },
        ].flatMap(type =>
          type.payload
            ? [
                {
                  name: `${type.payload}Payload`,
                  file: 'renderer_to_agent.json',
                  pointer: `#/properties/${type.payload}`,
                },
                type,
              ]
            : [type],
        ),
      },
      {
        module: 'renderer-capabilities',
        types: [
          {
            name: 'V10RendererCapabilities',
            file: 'renderer_capabilities.json',
            pointer: '#/properties/v1.0',
          },
        ],
      },
      {
        module: 'catalog-definition',
        types: Object.keys(catalogDefinition.$defs).flatMap(name => [
          {name, file: 'catalog_definition.json', pointer: `#/$defs/${name}`},
          {name: `${name}Input`, ts: name, description: `The input form of {@link ${name}}.`},
        ]),
      },
      {
        module: 'helpers',
        types: [
          {
            name: 'TemplateChildList',
            ts: '{\n  componentId: ComponentId;\n  path: string;\n}',
            uses: ['ComponentId'],
            description:
              'A template for generating a dynamic list of children from a data model list. The `componentId` is the component to use as a template.',
          },
          {
            name: 'AnyComponent',
            file: 'agent_to_renderer.json',
            pointer: '#/$defs/Component',
            ts: 'any',
            description: 'A generic A2UI component payload.',
          },
          {
            name: 'ComponentsList',
            file: 'agent_to_renderer.json',
            pointer: '#/$defs/ComponentsList',
            ts: 'AnyComponent[]',
            description: 'A non-empty array of UI component payloads.',
          },
          {
            name: 'RendererCapabilities',
            ts: 'Record<string, any>',
            description: 'Renderer capabilities, by protocol version.',
          },
        ],
      },
    ],
  });
}

/**
 * Generates the common types shared by every protocol version, merged from
 * the common types of each version with common types.
 */
export function generateSupersetTypes() {
  const versions = ['v0_9', 'v1_0'].map(v => readJson(join(SPEC, v, 'json', 'common_types.json')));
  const names = [...new Set(versions.flatMap(doc => Object.keys(doc.$defs)))];
  const merged = {$defs: {}};
  for (const name of names) {
    merged.$defs[name] = deepMergeSchemas(
      versions
        .filter(doc => doc.$defs[name])
        .map(doc => inlineAllOfRefs(doc.$defs[name], doc.$defs)),
    );
  }
  const description = name => merged.$defs[name].description;
  generateProtocolTypes({
    specDir: SPEC,
    outDir: join(ROOT, 'src', 'types'),
    docs: {'common_types.json': merged},
    modules: [
      {
        module: 'common-types',
        types: [
          ...defs('common_types.json', merged, {
            Child: {ts: 'ComponentId', description: description('Child')},
            DataBinding: {
              ts: "{\n  path?: string;\n  '@path'?: string;\n}",
              description: description('DataBinding'),
            },
            FunctionCommon: {
              ts: "{\n  call?: string;\n  '@call'?: string;\n  catalogId?: string;\n}",
              description: description('FunctionCommon'),
            },
            IndexSystemFunction: {
              ts: "{\n  call?: '@index';\n  '@call'?: '@index';\n  args?: {offset?: DynamicNumber};\n}",
              description: description('IndexSystemFunction'),
            },
            FunctionCall: {
              ts: `{\n  call?: string;\n  '@call'?: string;\n  args?: Record<string, unknown>;\n  returnType?: ${RETURN_TYPES};\n  catalogId?: string;\n}`,
              description: description('FunctionCall'),
            },
            DynamicValue: {
              ts: 'string | number | boolean | unknown[] | DataBinding | FunctionCall | Record<string, unknown>',
              description: description('DynamicValue'),
            },
            Extensions: {ts: 'Record<string, unknown>', description: description('Extensions')},
            ChildList: {
              ts: 'ComponentId[] | {\n  componentId: ComponentId;\n  path: string;\n}',
              description: description('ChildList'),
            },
          }),
          {
            name: 'DataBindingType',
            ts: 'DataBinding',
            description: 'Alias of {@link DataBinding}.',
          },
          {
            name: 'FunctionCallType',
            ts: 'FunctionCall',
            description: 'Alias of {@link FunctionCall}.',
          },
        ],
      },
      {
        module: 'helpers',
        reexports: ["export {MAX_FUNCTION_CALL_ARGS} from './limits.js';"],
        types: [
          {
            name: 'AnyComponent',
            ts: '{\n  component: string;\n  id?: ComponentId;\n  weight?: number;\n  [key: string]: unknown;\n}',
            uses: ['ComponentId'],
            description: 'Generic component definition payload.',
          },
        ],
      },
    ],
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  generateV09Types();
  generateV10Types();
  generateSupersetTypes();
}
