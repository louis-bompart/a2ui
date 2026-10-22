/*
 * Copyright 2024 Google LLC
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

import {a2uiJsonSchemaOf} from './a2ui_json_schema.js';
import type {
  A2uiSchema,
  A2uiSchemaResult,
  DeferredA2uiSchema,
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from './a2ui_schema.js';
import type {JsonSchemaObject} from './spec_annotations.js';

/**
 * The JSON Schema definitions of the entries `Catalog.fromJson` loaded, by
 * entry and by the schema each entry's definition compiles to. Kept out of
 * the entries' own properties, so that a copy of an entry made with object
 * spread keeps the definition only while it keeps the entry's `schema`: a
 * copy that changes its `schema` does not carry a definition that no longer
 * describes it.
 */
const definitions = new WeakMap<object, JsonSchemaObject>();

/**
 * Returns the JSON Schema definition of a catalog entry that
 * `Catalog.fromJson` loaded, or of a copy of one with the same `schema`, or
 * `undefined` for an entry defined in code.
 *
 * @param entry A component or function.
 */
export function loadedDefinition(entry: object): JsonSchemaObject | undefined {
  const own = definitions.get(entry);
  if (own) return own;
  const schema = (entry as {schema?: unknown}).schema;
  return typeof schema === 'object' && schema !== null ? definitions.get(schema) : undefined;
}

/**
 * A schema compiled from a definition on first use: by the first validation,
 * or the first read of its vendor or JSON Schema. Creating one, or copying the
 * entry holding it, compiles nothing, so a catalog can be loaded before the
 * compiler it uses by default is set.
 */
export class DeferredSchema implements DeferredA2uiSchema, StandardJSONSchemaV1 {
  readonly '~standard': StandardSchemaV1.Props & StandardJSONSchemaV1.Props;
  private compiled?: A2uiSchema;

  constructor(private readonly compile: () => A2uiSchema) {
    const resolve = () => this.resolveDeferredSchema();
    const output = () => ({...a2uiJsonSchemaOf(resolve())});
    this['~standard'] = {
      version: 1,
      get vendor() {
        return resolve()['~standard'].vendor;
      },
      validate: (value: unknown) =>
        resolve()['~standard'].validate(value) as A2uiSchemaResult<unknown>,
      jsonSchema: {input: output, output},
    };
  }

  resolveDeferredSchema(): A2uiSchema {
    return (this.compiled ??= this.compile());
  }
}

/**
 * Defines lazily computed, enumerable getters on `target`, so that an object
 * spread of it copies their values.
 */
function defineViews(target: object, views: Record<string, () => unknown>): void {
  for (const [key, compute] of Object.entries(views)) {
    let computed = false;
    let value: unknown;
    Object.defineProperty(target, key, {
      enumerable: true,
      get() {
        if (!computed) {
          value = compute();
          computed = true;
        }
        return value;
      },
    });
  }
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item: unknown): item is string => typeof item === 'string')
    : undefined;
}

/**
 * A component that `Catalog.fromJson` loaded from a catalog document.
 *
 * Its model is its JSON Schema definition as the document writes it
 * (`jsonSchema`), deeply frozen. Every other field is a view of it: the
 * `schema` is compiled from it on first use, and `allowedParents` and
 * `allowedChildren` are read from it. `Catalog.toJson` writes the definition,
 * so a loaded catalog serializes as written.
 *
 * A copy made with object spread keeps the definition while it keeps the
 * `schema`, as a web component implementation of the component does. A copy
 * with another `schema` is an ordinary component defined in code, serialized
 * from its `schema`.
 */
export class JsonComponentApi {
  /** Name of the component as it appears in A2UI JSON. */
  readonly name: string;
  /** Schema of the component's properties, compiled from `jsonSchema` on first use. */
  readonly schema: A2uiSchema;
  /** Allowed parent component types, as the definition declares them. */
  declare readonly allowedParents?: string[];
  /** Allowed child component types, as the definition declares them. */
  declare readonly allowedChildren?: string[];

  /**
   * @param name The component's name.
   * @param jsonSchema The component's definition, deeply frozen.
   * @param deriveSchema Derives the component's schema from its definition.
   */
  constructor(
    name: string,
    jsonSchema: JsonSchemaObject,
    deriveSchema: (jsonSchema: JsonSchemaObject) => A2uiSchema,
  ) {
    this.name = name;
    this.schema = new DeferredSchema(() => deriveSchema(jsonSchema));
    definitions.set(this, jsonSchema);
    definitions.set(this.schema, jsonSchema);
    defineViews(this, {
      allowedParents: () => stringList(jsonSchema['allowedParents']),
      allowedChildren: () => stringList(jsonSchema['allowedChildren']),
    });
    Object.freeze(this);
  }

  /** The component's JSON Schema definition, as its catalog document writes it. */
  get jsonSchema(): JsonSchemaObject {
    return definitions.get(this)!;
  }
}

/**
 * A function that `Catalog.fromJson` loaded from a catalog document.
 *
 * Its model is its JSON Schema definition as the document writes it
 * (`jsonSchema`): an entry of a `functions` map (the schema of a call to the
 * function) or an item of a `functions` list (with its `name` and
 * `parameters`), deeply frozen. Every other field is a view of it: the
 * `schema` of its arguments is compiled from it on first use, and
 * `returnType`, `description`, `allowedCallers` and `requiresUserActivation`
 * are read from it.
 *
 * A copy made with object spread, or a `FunctionImplementation` made from
 * it, keeps the definition while it keeps the `schema`.
 */
export class JsonFunctionApi {
  /** Name of the function as it appears in A2UI JSON payloads. */
  readonly name: string;
  /** Schema of the function's arguments, compiled from `jsonSchema` on first use. */
  readonly schema: A2uiSchema;
  /** Return type identifier, as the definition declares it, or `'any'`. */
  declare readonly returnType: string;
  /** The definition's description. */
  declare readonly description?: string;
  /** Allowed caller contexts, as the definition declares them. */
  declare readonly allowedCallers?: 'rendererOnly' | 'agentOnly' | 'rendererOrAgent';
  /** Whether the definition requires user activation. */
  declare readonly requiresUserActivation?: boolean;

  /**
   * @param name The function's name.
   * @param jsonSchema The function's definition, deeply frozen.
   * @param deriveSchema Derives the schema of the function's arguments
   *     from its definition.
   */
  constructor(
    name: string,
    jsonSchema: JsonSchemaObject,
    deriveSchema: (jsonSchema: JsonSchemaObject) => A2uiSchema,
  ) {
    this.name = name;
    this.schema = new DeferredSchema(() => deriveSchema(jsonSchema));
    definitions.set(this, jsonSchema);
    definitions.set(this.schema, jsonSchema);
    // A map entry may write the call metadata as constant properties of the
    // call schema, before v1.0 lifted it to keywords.
    const props = isObject(jsonSchema['properties']) ? jsonSchema['properties'] : undefined;
    const constant = (key: string): unknown => {
      const property = props?.[key];
      return isObject(property) ? property['const'] : undefined;
    };
    defineViews(this, {
      returnType: () => {
        const declared = jsonSchema['returnType'] ?? constant('returnType');
        return typeof declared === 'string' ? declared : 'any';
      },
      description: () =>
        typeof jsonSchema['description'] === 'string' ? jsonSchema['description'] : undefined,
      allowedCallers: () => jsonSchema['allowedCallers'] ?? constant('allowedCallers'),
      requiresUserActivation: () =>
        jsonSchema['requiresUserActivation'] ?? constant('requiresUserActivation'),
    });
    Object.freeze(this);
  }

  /** The function's JSON Schema definition, as its catalog document writes it. */
  get jsonSchema(): JsonSchemaObject {
    return definitions.get(this)!;
  }
}
