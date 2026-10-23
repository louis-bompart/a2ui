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

/**
 * @fileoverview Generates a JSON-backed catalog from its published document.
 *
 * Writes three modules:
 *
 * - the document itself, as a TypeScript constant, and the catalog
 *   `Catalog.fromJson` loads from it, whose entries compile their schemas on
 *   first use;
 * - one `<Name>Props` interface per component, derived from its JSON Schema
 *   definition, and a typed `<Name>Api` that is the loaded entry;
 * - one `<Name>Args` interface per function and a typed `<Name>Api`.
 *
 * References to the common types are written as the TypeScript types the
 * common types module exports, and other references are resolved and written
 * inline. A component's properties are those of its definition and of the
 * mixins it composes with `allOf`, without the envelope properties.
 */

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
// Generated from the published catalog document via scripts/generate-catalog-types.mjs
`;

/** Envelope properties a component's props leave out. */
const ENVELOPE = new Set(['component', 'id', 'catalogId']);

/** Keywords that annotate a schema without constraining its type. */
const ANNOTATIONS = new Set(['description', 'title', 'default', 'examples', '$comment']);

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Converts a function name to a PascalCase identifier. */
export function toPascalCase(name) {
  const cleanName = name.startsWith('@') ? name.substring(1) : name;
  return cleanName
    .replace(/[-_./]([a-zA-Z0-9])/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, c => c.toUpperCase());
}

function jsDoc(description, indent = '') {
  if (typeof description !== 'string' || !description.trim()) return '';
  const lines = description.trim().replace(/\*\//g, '*\\/').split('\n');
  return `${indent}/**\n${lines.map(l => `${indent} * ${l}`.trimEnd()).join('\n')}\n${indent} */\n`;
}

function propertyKey(key) {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}

/** Returns the names of the types a TypeScript module exports. */
export function exportedTypeNames(modulePath) {
  const source = readFileSync(modulePath, 'utf-8');
  return new Set([...source.matchAll(/^export (?:type|interface) (\w+)/gm)].map(m => m[1]));
}

/**
 * Writes JSON Schemas as TypeScript types.
 */
export class TypeWriter {
  /**
   * @param {object} catalog The catalog document.
   * @param {object} commonTypes The common types document.
   * @param {Set<string>} commonTypeNames The types the common types module exports.
   */
  constructor(catalog, commonTypes, commonTypeNames) {
    this.catalog = catalog;
    this.commonTypes = commonTypes;
    this.commonTypeNames = commonTypeNames;
    /** Names of the common types the written types use. */
    this.usedCommonTypes = new Set();
  }

  /** Resolves a `$ref` written in `doc` to its target and document. */
  resolve(ref, doc) {
    const hash = ref.indexOf('#');
    const file = hash === -1 ? ref : ref.slice(0, hash);
    const pointer = hash === -1 ? '' : ref.slice(hash + 1);
    const target = file === '' ? doc : file.endsWith('common_types.json') ? this.commonTypes : null;
    if (!target) throw new Error(`Unresolvable reference: ${ref}`);
    let node = target;
    for (const segment of pointer.split('/').filter(Boolean)) {
      node = node?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    if (node === undefined) throw new Error(`Unresolvable reference: ${ref}`);
    return {node, doc: target, isCommon: target === this.commonTypes};
  }

  /**
   * Returns the name of the TypeScript type a `$ref` written in `doc` is
   * written as, or `undefined` to write the type it points to inline.
   */
  namedType(ref, doc) {
    const {isCommon} = this.resolve(ref, doc);
    const name = ref.split('/').pop();
    if (isCommon && this.commonTypeNames.has(name)) {
      this.usedCommonTypes.add(name);
      return name;
    }
    return undefined;
  }

  /** Returns the TypeScript type of a `const` value. */
  constType(value) {
    return JSON.stringify(value);
  }

  /** Returns the TypeScript type of a schema written in `doc`. */
  type(schema, doc, seen = new Set()) {
    if (!isObject(schema)) return 'any';
    if (typeof schema.$ref === 'string') {
      const named = this.namedType(schema.$ref, doc);
      if (named) return named;
      const {node, doc: targetDoc, isCommon} = this.resolve(schema.$ref, doc);
      const key = `${isCommon}:${schema.$ref}`;
      if (seen.has(key)) return 'any';
      return this.type(node, targetDoc, new Set([...seen, key]));
    }
    if ('const' in schema) return this.constType(schema.const);
    if (Array.isArray(schema.enum)) return union(schema.enum.map(v => JSON.stringify(v)));
    for (const keyword of ['oneOf', 'anyOf']) {
      if (Array.isArray(schema[keyword])) {
        return union(schema[keyword].map(member => this.type(member, doc, seen)));
      }
    }
    if (Array.isArray(schema.allOf)) {
      const members = schema.allOf.map(member => this.type(member, doc, seen));
      const own = {...schema};
      delete own.allOf;
      if (Object.keys(own).some(key => !ANNOTATIONS.has(key))) {
        members.push(this.type(own, doc, seen));
      }
      return intersection(members);
    }
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (schema.type === undefined) {
      // Without a `type`, `additionalProperties` constrains only objects, and
      // allows any other value.
      return schema.properties ? this.objectType(schema, doc, seen) : 'any';
    }
    return union(
      types.map(type => {
        switch (type) {
          case 'string':
            return 'string';
          case 'number':
          case 'integer':
            return 'number';
          case 'boolean':
            return 'boolean';
          case 'null':
            return 'null';
          case 'array':
            return `${wrap(this.type(schema.items ?? {}, doc, seen))}[]`;
          case 'object':
            return this.objectType(schema, doc, seen);
          default:
            return 'any';
        }
      }),
    );
  }

  /** Returns the TypeScript type of an object schema. */
  objectType(schema, doc, seen) {
    const extra = schema.additionalProperties ?? schema.unevaluatedProperties;
    const properties = isObject(schema.properties) ? schema.properties : {};
    const required = new Set(Array.isArray(schema.required) ? schema.required : []);
    if (Object.keys(properties).length === 0) {
      return isObject(extra)
        ? `Record<string, ${this.type(extra, doc, seen)}>`
        : 'Record<string, any>';
    }
    return this.members(
      Object.entries(properties).map(([key, value]) => ({
        key,
        value,
        doc,
        required: required.has(key),
      })),
      seen,
      extra === true || isObject(extra),
    );
  }

  /** Writes an object type literal from its members. */
  members(members, seen = new Set(), open = false, indent = '  ') {
    const lines = members.map(
      ({key, value, doc, required}) =>
        `${jsDoc(value?.description, indent)}${indent}${propertyKey(key)}${required ? '' : '?'}: ${this.type(value, doc, seen)};`,
    );
    if (open) lines.push(`${indent}[key: string]: unknown;`);
    return `{\n${lines.join('\n')}\n${indent.slice(2)}}`;
  }

  /**
   * Returns the properties a component definition declares, with those of the
   * mixins it composes, its own winning, and without the envelope.
   */
  componentMembers(definition) {
    const members = new Map();
    const required = new Set();
    const collect = (node, doc) => {
      if (!isObject(node)) return;
      if (typeof node.$ref === 'string') {
        const target = this.resolve(node.$ref, doc);
        collect(target.node, target.doc);
        return;
      }
      for (const member of Array.isArray(node.allOf) ? node.allOf : []) collect(member, doc);
      for (const [key, value] of Object.entries(isObject(node.properties) ? node.properties : {})) {
        if (!ENVELOPE.has(key)) members.set(key, {key, value, doc});
      }
      for (const key of Array.isArray(node.required) ? node.required : []) required.add(key);
    };
    collect(definition, this.catalog);
    return [...members.values()].map(member => ({...member, required: required.has(member.key)}));
  }
}

function wrap(type) {
  return /[|&]/.test(type) && !/^[{(]/.test(type) ? `(${type})` : type;
}

function union(types) {
  const unique = [...new Set(types)];
  if (unique.includes('any')) return 'any';
  return unique.length === 1 ? unique[0] : unique.map(wrap).join(' | ');
}

function intersection(types) {
  const unique = [...new Set(types)].filter(type => type !== 'any');
  if (unique.length === 0) return 'any';
  return unique.length === 1 ? unique[0] : unique.map(wrap).join(' & ');
}

/** Returns a function's argument schema and return type from its definition. */
function functionSignature(name, definition) {
  const properties = isObject(definition.properties) ? definition.properties : {};
  const args = isObject(definition.parameters)
    ? definition.parameters
    : isObject(properties.args)
      ? properties.args
      : undefined;
  const returnType = definition.returnType ?? properties.returnType?.const ?? 'any';
  return {name, args, returnType, description: definition.description};
}

function functionSignatures(functions) {
  if (Array.isArray(functions)) {
    return functions.map(fn => functionSignature(fn.name, fn));
  }
  return Object.entries(functions ?? {}).map(([name, definition]) =>
    functionSignature(name, definition),
  );
}

/**
 * Generates the modules of a JSON-backed catalog.
 *
 * @param {object} options
 * @param {string} options.catalogPath The published catalog document.
 * @param {string} [options.commonTypesPath] The common types document, if the catalog refers to it.
 * @param {string} [options.commonTypesModulePath] The TypeScript module of the common types.
 * @param {string} [options.catalogId] The catalog ID, for a document that declares none.
 * @param {string} options.commonTypesImportPath The import path of that module from the
 *     components and functions directories.
 * @param {string} options.catalogModuleImportPath The import path of `src/catalog/` from the
 *     components and functions directories.
 * @param {string} options.protocolVersion The protocol version the catalog is loaded with.
 * @param {string} options.documentOutPath Where to write the document module.
 * @param {string} options.componentsOutPath Where to write the components module.
 * @param {string} [options.functionsOutPath] Where to write the functions module, for a
 *     catalog with functions.
 * @param {string} [options.specFunctionApisAlias] Another name to export the function APIs as.
 */
export function generateJsonCatalog(options) {
  const catalog = JSON.parse(readFileSync(options.catalogPath, 'utf-8'));
  const commonTypes = options.commonTypesPath
    ? JSON.parse(readFileSync(options.commonTypesPath, 'utf-8'))
    : {};
  const commonTypeNames = options.commonTypesModulePath
    ? exportedTypeNames(options.commonTypesModulePath)
    : new Set();
  const lib = options.catalogModuleImportPath;

  writeFileSync(
    options.documentOutPath,
    `${HEADER}
import {Catalog} from '${lib.replace(/^\.\.\//, '')}/types.js';

/**
 * The published catalog document. It is parsed from its JSON text, as a
 * document fetched at run time would be, so that minifiers that rename
 * properties, such as Closure Compiler, leave its keys as written.
 */
export const BASIC_CATALOG_DOCUMENT: Record<string, unknown> = JSON.parse(${JSON.stringify(JSON.stringify(catalog))});

/**
 * The catalog loaded from the published document. Its entries compile their
 * schemas on first use, with the default catalog schema compiler.
 */
export const LOADED_BASIC_CATALOG = Catalog.fromJson(BASIC_CATALOG_DOCUMENT, '${options.protocolVersion}'${options.catalogId ? `, '${options.catalogId}'` : ''});
`,
  );

  // Components.
  const components = new TypeWriter(catalog, commonTypes, commonTypeNames);
  const componentBlocks = [];
  const componentNames = Object.keys(catalog.components ?? {});
  for (const name of componentNames) {
    const definition = catalog.components[name];
    componentBlocks.push(
      `${jsDoc(definition.description ?? `The properties of a \`${name}\` component.`)}export interface ${name}Props ${components.members(components.componentMembers(definition))}

/** The \`${name}\` component of the catalog. */
export const ${name}Api: LoadedComponentApi<'${name}', ${name}Props> = loadedComponentApi(
  LOADED_BASIC_CATALOG,
  '${name}',
);`,
    );
  }
  writeFileSync(
    options.componentsOutPath,
    `${HEADER}
import {loadedComponentApi, type LoadedComponentApi} from '${lib}/json_entries.js';
import type {ComponentApi} from '${lib}/types.js';
${commonTypesImport(components.usedCommonTypes, options.commonTypesImportPath)}import {LOADED_BASIC_CATALOG} from '../basic_catalog_document.js';

${componentBlocks.join('\n\n')}

/** The components of the catalog, in the order of its document. */
export const BASIC_COMPONENTS: ComponentApi[] = [
${componentNames.map(name => `  ${name}Api,`).join('\n')}
];
`,
  );

  if (!options.functionsOutPath) return;

  // Functions.
  const functions = new TypeWriter(catalog, commonTypes, commonTypeNames);
  const functionBlocks = [];
  const signatures = functionSignatures(catalog.functions);
  for (const {name, args, returnType, description} of signatures) {
    const typeName = toPascalCase(name);
    const argsType = args ? functions.type(args, catalog) : 'Record<string, any>';
    functionBlocks.push(
      `/** The arguments of the \`${name}\` function. */
export type ${typeName}Args = ${argsType === 'any' ? 'Record<string, any>' : argsType};

${jsDoc(description ?? `The \`${name}\` function of the catalog.`)}export const ${typeName}Api: LoadedFunctionApi<'${name}', '${returnType}', ${typeName}Args> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, '${name}');`,
    );
  }
  writeFileSync(
    options.functionsOutPath,
    `${HEADER}
import {loadedFunctionApi, type LoadedFunctionApi} from '${lib}/json_entries.js';
${commonTypesImport(functions.usedCommonTypes, options.commonTypesImportPath)}import {LOADED_BASIC_CATALOG} from '../basic_catalog_document.js';

${functionBlocks.join('\n\n')}

/** The functions of the catalog, in the order of its document. */
export const BASIC_FUNCTION_APIS = [
${signatures.map(({name}) => `  ${toPascalCase(name)}Api,`).join('\n')}
];
${options.specFunctionApisAlias ? `\nexport const ${options.specFunctionApisAlias} = BASIC_FUNCTION_APIS;\n` : ''}`,
  );
}

function commonTypesImport(names, importPath) {
  if (names.size === 0) return '';
  return `import type {${[...names].sort().join(', ')}} from '${importPath}';\n`;
}
