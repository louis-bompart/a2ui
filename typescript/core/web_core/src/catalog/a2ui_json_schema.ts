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
 * The JSON Schema view of an `A2uiSchema`, which web_core reads to bind,
 * serialize and inspect catalog entries without depending on the library the
 * schema was built with.
 *
 * In this view, A2UI types such as `DynamicString`, `Action`, `ComponentId`
 * or `ChildList` appear as `$ref`s to their definitions, such as
 * `common_types.json#/$defs/DynamicString`, or `#/$defs/<name>` for a
 * definition of the catalog document. Only the name the reference ends with
 * matters to web_core.
 */

import {A2uiCatalogError} from '../errors.js';
import type {A2uiSchema, StandardJSONSchemaV1} from './a2ui_schema.js';
import {schemaLibraries} from './schema_library.js';
import type {JsonSchemaObject} from './json_schema.js';

const views = new WeakMap<object, JsonSchemaObject>();

/**
 * Returns the JSON Schema view of a schema, computed once and deeply frozen.
 *
 * A schema implementing Standard JSON Schema is converted with its own
 * converter (`~standard.jsonSchema.output`), targeting draft 2020-12. Any
 * other schema is converted by the installed schema library it belongs to,
 * such as `@a2ui/schema-zod3` for a Zod 3 schema.
 *
 * @throws A2uiCatalogError when the schema can be converted neither way.
 */
export function a2uiJsonSchemaOf(schema: A2uiSchema): JsonSchemaObject {
  let view = views.get(schema);
  if (!view) {
    view = deepFreeze(convert(schema));
    views.set(schema, view);
  }
  return view;
}

/** Returns a mutable copy of the JSON Schema view of a schema. */
export function copyA2uiJsonSchemaOf(schema: A2uiSchema): Record<string, unknown> {
  return structuredClone(a2uiJsonSchemaOf(schema)) as Record<string, unknown>;
}

function convert(schema: A2uiSchema): Record<string, unknown> {
  const converter = (schema as unknown as Partial<StandardJSONSchemaV1>)['~standard']?.jsonSchema;
  if (converter && typeof converter.output === 'function') {
    const json = {...converter.output({target: 'draft-2020-12'})};
    delete json['$schema'];
    return json;
  }
  for (const library of schemaLibraries()) {
    const json = library.toJsonSchema?.(schema);
    if (json) return json;
  }
  throw new A2uiCatalogError(
    `Schema from '${schema['~standard']?.vendor}' implements no JSON Schema conversion: ` +
      'A2UI requires Standard JSON Schema (https://standardschema.dev/json-schema), ' +
      'or an installed schema library that converts it.',
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Returns the name of the definition a JSON Schema `$ref` points to, such as
 * `DynamicString` for `common_types.json#/$defs/DynamicString`, or an empty
 * string when the node has no `$ref`.
 */
export function refDefName(node: unknown): string {
  const ref = isJsonObject(node) ? node['$ref'] : undefined;
  if (typeof ref !== 'string') return '';
  const hash = ref.lastIndexOf('#');
  const segments = (hash === -1 ? ref : ref.slice(hash + 1)).split('/').filter(Boolean);
  return segments.pop() ?? '';
}

/** Whether a value is a JSON object (not an array). */
export function isJsonObject(value: unknown): value is JsonSchemaObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Returns the members of a node that only wraps one or more schemas without
 * constraining them further: the branches of `anyOf` / `oneOf` other than
 * `null`, and the non-empty members of `allOf`. Returns `[node]` for any other
 * node.
 */
export function unwrapJsonSchema(node: JsonSchemaObject): JsonSchemaObject[] {
  const allOf = node['allOf'];
  if (Array.isArray(allOf) && node['$ref'] === undefined) {
    const members = allOf.filter(m => isJsonObject(m) && Object.keys(m).length > 0);
    if (members.length === 1) return unwrapJsonSchema(members[0] as JsonSchemaObject);
  }
  return [node];
}

/**
 * Returns the branches of a union node (`anyOf` or `oneOf`), without the
 * branches that only make it nullable or optional (`{type: 'null'}`, and
 * `{not: {}}`, which matches nothing), or `undefined` for a node that is not
 * a union.
 */
export function unionBranches(node: JsonSchemaObject): JsonSchemaObject[] | undefined {
  const branches = node['anyOf'] ?? node['oneOf'];
  if (!Array.isArray(branches)) return undefined;
  return branches.filter((b): b is JsonSchemaObject => isJsonObject(b) && !isEmptyBranch(b));
}

function isEmptyBranch(node: JsonSchemaObject): boolean {
  const keys = Object.keys(node);
  if (keys.length !== 1) return false;
  if (keys[0] === 'type') return node['type'] === 'null';
  return keys[0] === 'not' && isJsonObject(node['not']) && Object.keys(node['not']).length === 0;
}

/**
 * Returns the schema a node stands for once a nullable union with a single
 * other branch, or an `allOf` with a single non-empty member, is unwrapped.
 */
export function coreJsonSchema(node: JsonSchemaObject): JsonSchemaObject {
  let current = unwrapJsonSchema(node)[0];
  const branches = unionBranches(current);
  if (branches && branches.length === 1 && current['$ref'] === undefined) {
    current = coreJsonSchema(branches[0]);
  }
  return current;
}

/** Returns the properties of an object node, or `undefined` for any other node. */
export function objectProperties(
  node: JsonSchemaObject,
): Record<string, JsonSchemaObject> | undefined {
  const properties = node['properties'];
  return isJsonObject(properties) ? (properties as Record<string, JsonSchemaObject>) : undefined;
}

/** Returns the element schema of an array node, or `undefined` for any other node. */
export function arrayItems(node: JsonSchemaObject): JsonSchemaObject | undefined {
  if (node['type'] !== 'array') return undefined;
  const items = node['items'];
  return isJsonObject(items) ? items : {};
}

/**
 * Names of the definitions a single child reference refers to: `ComponentId`,
 * and the aliases catalog documents declare for it, such as the v1.0 basic
 * catalog's `Child`.
 */
export const COMPONENT_ID_DEF_NAMES: ReadonlySet<string> = new Set([
  'ComponentId',
  'Child',
  'ChildComponentId',
]);

/** Names of the definitions a list of child references refers to. */
export const CHILD_LIST_DEF_NAMES: ReadonlySet<string> = new Set([
  'ChildList',
  'TemplateChildList',
]);
