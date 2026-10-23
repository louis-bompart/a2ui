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
import type {CatalogSchemaCompiler} from './schema_compiler.js';
import type {JsonSchemaObject} from './json_schema.js';
import type {ComponentApi, FunctionApi} from './types.js';

/**
 * The schemas that validate the messages of each protocol version, by
 * canonical version. The v0.9 schema validates v0.9.1 messages too.
 */
export interface ProtocolSchemas {
  readonly '0.8'?: A2uiSchema | null;
  readonly '0.9'?: A2uiSchema | null;
  readonly '1.0'?: A2uiSchema | null;
}

/**
 * Schemas of the `ComponentCommon` properties that a component's own schema
 * may leave out, which `PayloadValidator` checks on their own.
 */
export interface EnvelopeSchemas {
  /** Validates `accessibility`, which may be `undefined`. */
  readonly accessibility?: A2uiSchema;
  /** Validates `metadata`, which may be `undefined`. */
  readonly metadata?: A2uiSchema;
}

/** What a `CatalogDocumentShaper` writes a definition for. */
export interface CatalogDocumentContext {
  /** The protocol version of the catalog. */
  readonly protocolVersion: string;
  /** How the catalog's document writes the common types document in references. */
  readonly commonTypesUri?: string;
}

/**
 * Writes the definitions of catalog entries and models whose schemas carry
 * a library's own annotations of what the catalog document writes, such as
 * Zod 3 schemas annotated with `spec()`, in the layout of the catalog's
 * protocol version.
 *
 * Each method returns `undefined` for a schema it does not shape, which
 * `Catalog.toJson` then generates from the schema's JSON Schema.
 */
export interface CatalogDocumentShaper {
  /**
   * Returns a component's definition and the named definitions its mixins
   * add to the document's `$defs`.
   */
  component(
    name: string,
    component: ComponentApi,
    context: CatalogDocumentContext,
  ):
    | {readonly definition: JsonSchemaObject; readonly defs: ReadonlyMap<string, JsonSchemaObject>}
    | undefined;
  /** Returns a function's definition. */
  function(
    name: string,
    fn: FunctionApi,
    context: CatalogDocumentContext,
  ): JsonSchemaObject | undefined;
  /**
   * Returns the definition of a model the document declares, such as a
   * theme, with the name it declares it under in `$defs`, if it is named.
   */
  definition(
    model: A2uiSchema,
    context: CatalogDocumentContext,
  ): {readonly name?: string; readonly definition: JsonSchemaObject} | undefined;
}

/**
 * What a schema library, such as `@a2ui/schema-zod3`, provides to web_core:
 * the parts of A2UI that need to build or read schemas of that library.
 * Every part is optional.
 */
export interface SchemaLibrary {
  /** The library's name, for error messages. */
  readonly name: string;
  /** Compiles the definitions of the catalogs `Catalog.fromJson` loads. */
  readonly catalogSchemaCompiler?: CatalogSchemaCompiler;
  /** Validates protocol messages. */
  readonly protocolSchemas?: ProtocolSchemas;
  /** Validates the `ComponentCommon` properties a component schema leaves out. */
  readonly envelopeSchemas?: EnvelopeSchemas;
  /**
   * Converts a schema of the library that does not implement Standard JSON
   * Schema into its JSON Schema view (see `a2uiJsonSchemaOf`), or returns
   * `undefined` for a schema of another library.
   */
  toJsonSchema?(schema: A2uiSchema): Record<string, unknown> | undefined;
  /** Writes the definitions of entries annotated with the library's own annotations. */
  readonly documentShaper?: CatalogDocumentShaper;
  /**
   * The descriptions the library's own schemas of the common types carry on
   * the references they convert to, by definition name. A reference with
   * exactly one of them was not described by its author.
   */
  readonly commonTypeDescriptions?: ReadonlyMap<string, string>;
}

let installed: readonly SchemaLibrary[] = [];

/**
 * Installs a schema library. A library installed later takes precedence over
 * one installed earlier, for the parts both provide.
 *
 * @param library The library to install.
 */
export function installSchemaLibrary(library: SchemaLibrary): void {
  installed = [library, ...installed.filter(other => other !== library)];
}

/**
 * Uninstalls a schema library installed with `installSchemaLibrary`.
 *
 * @param library The library to uninstall.
 */
export function uninstallSchemaLibrary(library: SchemaLibrary): void {
  installed = installed.filter(other => other !== library);
}

/** Returns the installed schema libraries, most recently installed first. */
export function schemaLibraries(): readonly SchemaLibrary[] {
  return installed;
}

/**
 * Returns the first schema library's value of a part that some library
 * provides. The part is read with a function rather than by name, so that
 * minifiers that rename properties, such as Closure Compiler, rename it too.
 *
 * @param part Reads the part of a library, such as `library => library.protocolSchemas`.
 */
export function schemaLibraryPart<T>(
  part: (library: SchemaLibrary) => T | null | undefined,
): T | undefined {
  for (const library of schemaLibraries()) {
    const value = part(library);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}
