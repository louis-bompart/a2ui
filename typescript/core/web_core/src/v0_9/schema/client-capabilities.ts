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

// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from the specification's JSON schemas via scripts/generate-protocol-types.mjs

/**
 * A JSON Schema.
 */
export type JsonSchema = Record<string, unknown>;

/**
 * Describes a function's interface.
 */
export type FunctionDefinition = {
  /**
   * The unique name of the function.
   */
  name: string;
  /**
   * A human-readable description of what the function does and how to use it.
   */
  description?: string;
  /**
   * A JSON Schema describing the expected arguments (args) for this function.
   */
  parameters: any;
  /**
   * The type of value this function returns.
   */
  returnType: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any' | 'void';
};

/**
 * A collection of component and function definitions.
 */
export type InlineCatalog = {
  /**
   * Unique identifier for this catalog.
   */
  catalogId: string;
  /**
   * Definitions for UI components supported by this catalog.
   */
  components?: Record<string, any>;
  /**
   * Definitions for functions supported by this catalog.
   */
  functions?: FunctionDefinition[];
  /**
   * A schema that defines a catalog of A2UI theme properties. Each key is a theme property name (e.g. 'primaryColor'), and each value is the JSON schema for that property.
   */
  theme?: Record<string, any>;
};

/**
 * The capabilities structure for version 0.9 of the A2UI protocol.
 */
export type A2uiVersionCapabilities = {
  /**
   * An array of string identifiers for each of the component and function catalogs supported by the client.
   */
  supportedCatalogIds: string[];
  /**
   * An array of inline catalog definitions, which can contain both components and functions. This should only be provided if the agent declares 'acceptsInlineCatalogs: true' in its capabilities.
   */
  inlineCatalogs?: InlineCatalog[];
};
