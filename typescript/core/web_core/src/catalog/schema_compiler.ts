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

import type {A2uiSchema} from './a2ui_schema.js';
import type {PeerCatalogSource} from './schema_loader.js';
import type {JsonSchemaObject} from './spec_annotations.js';

/** What a `CatalogSchemaCompiler` compiles a definition of a catalog document against. */
export interface CatalogSchemaContext {
  /** The catalog document the definition belongs to, which its local `$ref`s point into. */
  readonly document: JsonSchemaObject;
  /** The peer catalogs its cross-catalog `$ref`s resolve against, in matching order. */
  readonly peers: readonly PeerCatalogSource[];
  /** The protocol version of the catalog, whose loading rules apply. */
  readonly protocolVersion: string;
}

/**
 * Compiles the JSON Schema definitions of a catalog document into the schemas
 * that validate its components, function arguments and theme.
 *
 * `Catalog.fromJson` compiles each entry's definition on first use, with the
 * compiler it is given, else the default one (see
 * `setDefaultCatalogSchemaCompiler`).
 */
export interface CatalogSchemaCompiler {
  /**
   * Compiles a component's definition, as the document writes it, into the
   * schema of its properties. The schema leaves out the envelope properties
   * (`id`, `component`, `catalogId`), which the payload validator removes
   * before it validates the properties.
   */
  component(definition: JsonSchemaObject, context: CatalogSchemaContext): A2uiSchema;
  /**
   * Compiles a function's argument schema, or returns a schema accepting any
   * arguments when the function declares none.
   */
  functionArgs(argsSchema: JsonSchemaObject | undefined, context: CatalogSchemaContext): A2uiSchema;
  /**
   * Compiles a theme's object schema. A theme is open unless its schema
   * closes it with `additionalProperties` or `unevaluatedProperties`.
   */
  theme(themeSchema: JsonSchemaObject, context: CatalogSchemaContext): A2uiSchema;
}

let defaultCompiler: CatalogSchemaCompiler | undefined;

/**
 * Sets the compiler `Catalog.fromJson` uses when it is given none.
 *
 * @param compiler The compiler, or `undefined` to restore the built-in one.
 */
export function setDefaultCatalogSchemaCompiler(compiler: CatalogSchemaCompiler | undefined): void {
  defaultCompiler = compiler;
}

/**
 * Returns the compiler `Catalog.fromJson` uses when it is given none.
 *
 * @param builtIn The compiler to use when no default was set.
 */
export function defaultCatalogSchemaCompiler(
  builtIn: CatalogSchemaCompiler,
): CatalogSchemaCompiler {
  return defaultCompiler ?? builtIn;
}
