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
 * Converts Zod 3 schemas into their JSON Schema view (see `a2uiJsonSchemaOf`
 * in `@a2ui/web_core`): `REF:<ref>|<description>` description markers and
 * `markChildRef` marks become `$ref`s, a union made with `exclusiveUnion`
 * becomes a `oneOf`, and the keywords a `spec()` annotation adds to a schema
 * are written with it. A node with a `$ref` keeps the structure of the schema
 * it was converted from, except for a reference to a definition whose name
 * says what it is, such as `DynamicString` or `ChildList`.
 */

import {refDefName} from '@a2ui/web_core/schema-library';
import type {z} from 'zod';
import {zodToJsonSchema, type OverrideCallback} from 'zod-to-json-schema';

import {exclusiveUnionOverride} from './exclusive_union.js';
import {getSpecAnnotationOfDef} from './spec_annotations.js';

/** The common types definitions that a schema marked with `markChildRef` refers to. */
const CHILD_REF_TARGETS: Readonly<Record<string, string>> = {
  'component-id': 'common_types.json#/$defs/ComponentId',
  'child-list': 'common_types.json#/$defs/ChildList',
};

/**
 * Converts a Zod 3 schema into its JSON Schema view.
 */
export function zod3ToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const json = zodToJsonSchema(schema, {
    target: 'jsonSchema2019-09',
    $refStrategy: 'none',
    override: a2uiOverride,
    postProcess: (json, def) => {
      const keywords = getSpecAnnotationOfDef(def)?.keywords;
      return json && keywords ? ({...json, ...keywords} as typeof json) : json;
    },
  }) as Record<string, unknown>;
  delete json['$schema'];
  markersToRefs(json);
  return json;
}

/**
 * The definitions whose name alone tells what a value referring to them is,
 * so that the JSON Schema view of a reference to one of them is the bare
 * `$ref`. Expanding them would also recurse: a `FunctionCall`'s arguments are
 * dynamic values, which may be function calls.
 */
const OPAQUE_DEFS =
  /^(Dynamic.*|DataBinding|FunctionCall|ComponentId|ChildList|Action|CheckRule|Checkable)$/;

/** The Zod 3 types that wrap another schema. */
const WRAPPERS = new Set([
  'ZodOptional',
  'ZodNullable',
  'ZodDefault',
  'ZodCatch',
  'ZodReadonly',
  'ZodBranded',
  'ZodLazy',
]);

/** Returns the reference a `REF:<ref>|<description>` marker holds, if it is one. */
function markerRef(description: unknown): string | undefined {
  if (typeof description !== 'string' || !description.startsWith('REF:')) return undefined;
  const content = description.substring(4);
  const pipe = content.indexOf('|');
  return pipe === -1 ? content : content.substring(0, pipe);
}

/**
 * Stops at a schema described with a `REF:` marker to an opaque definition,
 * or marked with `markChildRef`, and writes a union made with
 * `exclusiveUnion` as `oneOf`.
 */
const a2uiOverride: OverrideCallback = (def, refs, seen, forceResolution) => {
  const description = (def as {description?: string}).description;
  const ref = markerRef(description);
  // Wrappers such as `.optional()` and `.default()` copy the description of
  // the schema they wrap, and are converted as usual so that they keep their
  // own keywords, such as `default`.
  const isWrapper = WRAPPERS.has((def as {typeName?: string}).typeName ?? '');
  if (ref !== undefined) {
    if (!isWrapper && OPAQUE_DEFS.test(refDefName({$ref: ref}))) return {description};
  } else {
    const childRef = (def as {a2uiChildRef?: string}).a2uiChildRef;
    const target = childRef === undefined ? undefined : CHILD_REF_TARGETS[childRef];
    if (target !== undefined && !isWrapper) {
      return description === undefined ? {$ref: target} : {$ref: target, description};
    }
  }
  return exclusiveUnionOverride(def, refs, seen, forceResolution);
};

/**
 * Replaces the `REF:<ref>|<description>` marker of each node with a `$ref` to
 * `<ref>` and the marker's description, keeping the node's structure.
 */
function markersToRefs(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) markersToRefs(item);
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  const obj = node as Record<string, unknown>;
  const description = obj['description'];
  const ref = markerRef(description);
  if (ref !== undefined) {
    const prose = (description as string).substring(4 + ref.length + 1);
    delete obj['description'];
    obj['$ref'] = ref;
    if (prose) obj['description'] = prose;
  }
  for (const value of Object.values(obj)) markersToRefs(value);
}
