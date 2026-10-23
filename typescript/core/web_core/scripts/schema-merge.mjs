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

/**
 * @fileoverview Merges the JSON schemas a definition has in each protocol
 * version into one schema that accepts what any of them accepts, for the
 * types and schemas shared by every version.
 */

export function getLatestDescription(schemas) {
  const descriptions = schemas.map(s => s.description).filter(Boolean);
  return descriptions.length > 0 ? descriptions[descriptions.length - 1] : undefined;
}

export function mergeUnionSchemas(schemas) {
  const branches = [];
  const seen = new Set();
  for (const s of schemas) {
    const items = s.oneOf || s.anyOf || [s];
    for (let item of items) {
      if (
        item &&
        Array.isArray(item.allOf) &&
        item.allOf.length === 2 &&
        item.allOf[0].$ref &&
        item.allOf[1].properties
      ) {
        item = {$ref: item.allOf[0].$ref};
      }
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        seen.add(key);
        branches.push(JSON.parse(JSON.stringify(item)));
      }
    }
  }
  return {oneOf: branches};
}

export function collectAllPropertyNames(schemas) {
  const names = new Set();
  for (const s of schemas) {
    if (s.properties) {
      Object.keys(s.properties).forEach(p => names.add(p));
    }
  }
  return names;
}

export function findRequiredInAllProperties(schemas, propNames) {
  const required = [];
  for (const prop of propNames) {
    const isPresentInAll = schemas.every(s => s.properties && s.properties[prop]);
    const isRequiredInAll =
      isPresentInAll && schemas.every(s => s.required && s.required.includes(prop));
    if (isRequiredInAll) {
      required.push(prop);
    }
  }
  return required;
}

export function mergeObjectSchemas(schemas) {
  const merged = {type: 'object', properties: {}};
  const propNames = collectAllPropertyNames(schemas);

  for (const prop of propNames) {
    const propSchemas = schemas.map(s => s.properties && s.properties[prop]).filter(Boolean);
    merged.properties[prop] = deepMergeSchemas(propSchemas);
  }

  const required = findRequiredInAllProperties(schemas, propNames);
  if (required.length > 0) {
    merged.required = required;
  }
  return merged;
}

/**
 * Inlines the properties of same-document `allOf` `$ref` branches into a schema.
 *
 * JSON Schema treats `allOf` as an intersection, but the superset merge only
 * reads `properties`. A def that inherits its envelope from a shared base, as
 * v1.0 `FunctionCall` does from `FunctionCommon`, would otherwise contribute no
 * properties and be silently dropped from the merged superset.
 *
 * @param {object} schema The definition to flatten.
 * @param {Record<string, object>} defs All `$defs` from the same document.
 * @param {Set<string>} seen Definition names already inlined, guarding cycles.
 * @returns {object} The schema with inherited properties folded in.
 */
export function inlineAllOfRefs(schema, defs, seen = new Set()) {
  if (!schema || typeof schema !== 'object' || !Array.isArray(schema.allOf)) {
    return schema;
  }

  const inheritedProperties = {};
  const inheritedRequired = [];

  for (const branch of schema.allOf) {
    const ref = typeof branch?.$ref === 'string' ? branch.$ref : '';
    if (!ref.startsWith('#/$defs/')) continue;

    const name = ref.slice('#/$defs/'.length);
    if (seen.has(name)) continue;

    const nextSeen = new Set(seen);
    nextSeen.add(name);

    const base = inlineAllOfRefs(defs[name], defs, nextSeen);
    if (!base || !base.properties) continue;

    Object.assign(inheritedProperties, base.properties);
    if (Array.isArray(base.required)) {
      inheritedRequired.push(...base.required);
    }
  }

  if (Object.keys(inheritedProperties).length === 0) {
    return schema;
  }

  return {
    ...schema,
    type: schema.type ?? 'object',
    properties: {...inheritedProperties, ...(schema.properties ?? {})},
    required: Array.from(new Set([...inheritedRequired, ...(schema.required ?? [])])),
  };
}

export function mergeEnumSchemas(schemas) {
  const enumValues = new Set();
  for (const s of schemas) {
    if (Array.isArray(s.enum)) {
      s.enum.forEach(v => enumValues.add(v));
    }
  }
  return {type: 'string', enum: Array.from(enumValues)};
}

/**
 * Deep merges a list of JSON Schema definitions across versions into a superset schema.
 *
 * @param {Array<object>} schemas List of schema objects in chronological order.
 * @returns {object} The merged superset JSON Schema.
 */
export function deepMergeSchemas(schemas) {
  if (!schemas || schemas.length === 0) return {};
  if (schemas.length === 1) {
    const res = JSON.parse(JSON.stringify(schemas[0]));
    if (
      res.properties &&
      res.oneOf &&
      (res.oneOf.every(item => item.required) || res.type === 'object')
    ) {
      delete res.oneOf;
    }
    return res;
  }

  const description = getLatestDescription(schemas);
  let merged;

  if (schemas.every(s => s.type === 'object' || s.properties)) {
    merged = mergeObjectSchemas(schemas);
  } else if (schemas.some(s => s.oneOf || s.anyOf)) {
    merged = mergeUnionSchemas(schemas);
  } else if (schemas.some(s => Array.isArray(s.enum))) {
    merged = mergeEnumSchemas(schemas);
  } else {
    merged = Object.assign({}, ...schemas);
  }

  if (description) {
    merged.description = description;
  }
  return merged;
}
