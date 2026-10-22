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

import type {Extensions} from './common-types.js';

/**
 * JSON Schema structure that validates a wire-level FunctionCall object.
 */
export type FunctionCallValidationSchema = {
  type: 'object';
  description?: string;
  properties: {
    '@call': {
      const: string;
    };
    /**
     * A JSON Schema describing the expected arguments (args) for this function.
     */
    args?: any;
  };
  required: string[];
};

/**
 * The input form of {@link FunctionCallValidationSchema}.
 */
export type FunctionCallValidationSchemaInput = FunctionCallValidationSchema;

/**
 * Describes a function's validation schema and interface metadata.
 */
export type FunctionDefinition = FunctionCallValidationSchema & {
  /**
   * The type of value this function returns.
   */
  returnType:
    | 'string'
    | 'number'
    | 'boolean'
    | 'array'
    | 'object'
    | 'validationResult'
    | 'any'
    | 'void';
  /**
   * Specifies which roles are authorized to invoke this function.
   */
  allowedCallers?: 'rendererOnly' | 'agentOnly' | 'rendererOrAgent';
  /**
   * Specifies whether this function requires a user activation context to execute.
   */
  requiresUserActivation?: boolean;
} & Record<string, any>;

/**
 * The input form of {@link FunctionDefinition}.
 */
export type FunctionDefinitionInput = FunctionDefinition;

/**
 * Describes a component's validation schema and composition constraints.
 */
export type ComponentDefinition = {
  /**
   * The list of parent component type names that can contain this component type. If omitted, all parent component types are allowed. To restrict a component so it can appear only as the top-level component (id='root') of a surface, set "allowedParents": ["Surface"]. To allow a component as either the top-level component of a surface or a child of a specific container, specify both (e.g., "allowedParents": ["Surface", "CanvasContainer"]).
   */
  allowedParents?: string[];
  /**
   * The list of child component type names allowed inside this container or slot. If omitted, all child component types are allowed.
   */
  allowedChildren?: string[];
  /**
   * Optional static metadata.
   */
  metadata?: {
    extensions?: Extensions;
  };
} & Record<string, any>;

/**
 * The input form of {@link ComponentDefinition}.
 */
export type ComponentDefinitionInput = ComponentDefinition;

/**
 * Dynamic validation result object returned by a validation condition function or data binding.
 */
export type ValidationResult = {
  /**
   * Whether the check passed.
   */
  valid: boolean;
  /**
   * Machine-readable error code (e.g. EXPIRED_CARD, OUT_OF_RANGE).
   */
  code?: string;
  /**
   * Human-readable error or warning message.
   */
  message?: string;
  /**
   * Severity level of the validation result.
   */
  severity?: 'error' | 'warning' | 'info';
};

/**
 * The input form of {@link ValidationResult}.
 */
export type ValidationResultInput = ValidationResult;
