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

import type {ComponentDefinition, FunctionDefinition} from './catalog-definition.js';

/**
 * The capabilities structure for version 1.0 of the A2UI protocol.
 */
export type V10RendererCapabilities = {
  /**
   * An array of string identifiers for each of the component and function catalogs supported by the renderer. Multiple catalogs can be mixed in a single surface.
   */
  supportedCatalogIds: string[];
  /**
   * An array of inline catalog definitions, which can contain both components and functions. This should only be provided if the agent declares 'acceptsInlineCatalogs: true' in its capabilities.
   */
  inlineCatalogs?: {
    $schema?: string;
    $id?: string;
    /**
     * The A2UI specification version of this catalog definition (e.g. '1.0'). Defaults to '0.9' if omitted.
     */
    protocolVersion?: string;
    /**
     * Standardized schema definitions referenced from outside the catalog file.
     */
    $defs?: {
      /**
       * Unified validation schema for all components.
       */
      anyComponent: any;
      /**
       * Unified validation schema for all functions.
       */
      anyFunction: any;
    };
    /**
     * The title of the catalog.
     */
    title?: string;
    /**
     * A human-readable description of the catalog.
     */
    description?: string;
    /**
     * Unique identifier for this catalog.
     */
    catalogId: string;
    /**
     * Markdown-formatted design guidelines or instructions specific to this catalog.
     */
    instructions?: string;
    /**
     * Definitions for UI components supported by this catalog.
     */
    components?: Record<string, ComponentDefinition>;
    /**
     * Definitions for functions supported by this catalog.
     */
    functions?: Record<string, FunctionDefinition>;
  }[];
};
