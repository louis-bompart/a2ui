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

import type {ComponentId} from './common-types.js';

/**
 * A template for generating a dynamic list of children from a data model list.
 */
export type TemplateChildList = {
  componentId: ComponentId;
  path: string;
};

/**
 * A generic A2UI component definition.
 */
export type AnyComponent = {
  component: string;
  id?: ComponentId;
  weight?: number;
  [key: string]: unknown;
};

/**
 * The capabilities a v0.9 client reports.
 */
export type A2uiClientCapabilities = {'v0.9': any; 'v0.9.1'?: any} | {'v0.9'?: any; 'v0.9.1': any};
