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

import type {CallId, Extensions, FunctionCall, FunctionResponse} from './common-types.js';
import type {ComponentsList} from './helpers.js';

export type CreateSurfaceMessage = {
  version: 'v1.0';
  /**
   * Signals the renderer to create a new surface and begin rendering it. Creating a surface implicitly instantiates the canonical 'Surface' container component ('common_types.json#/$defs/Surface') with 'child': 'root'. It is an error to try to create a surface with an existing ID without first deleting it; surfaceId MUST be globally unique for the renderer's lifetime. When this message is sent, the renderer expects 'updateComponents' and/or 'updateDataModel' messages for the same surfaceId to define the component tree.
   */
  createSurface: {
    /**
     * The unique identifier for the UI surface to be rendered. It must be globally unique for the renderer's lifetime.
     */
    surfaceId: string;
    /**
     * A string that uniquely identifies the default catalog for this surface. It is recommended to prefix this with an internet domain that you own, to avoid conflicts e.g. 'mycompany.com:somecatalog'. Components and function calls that do not explicitly specify a catalogId will use this surface-level default catalogId.
     */
    catalogId?: string;
    /**
     * If true, the renderer will send the full data model of this surface in the metadata of every A2A message sent to the agent that created the surface. Defaults to false.
     */
    sendDataModel?: boolean;
    components?: ComponentsList;
    /**
     * The initial root data model object for the surface.
     */
    dataModel?: Record<string, any>;
    /**
     * Optional surface-level metadata.
     */
    metadata?: {
      extensions?: Extensions;
    };
  };
};

export type UpdateComponentsMessage = {
  version: 'v1.0';
  /**
   * Updates a surface with a new set of components. This message can be sent multiple times to update the component tree of an existing surface. One of the components in one of the components lists MUST have an 'id' of 'root' to serve as the root of the component tree. The createSurface message MUST have been previously sent for this surfaceId.
   */
  updateComponents: {
    /**
     * The unique identifier for the UI surface to be updated. It must be globally unique for the renderer's lifetime.
     */
    surfaceId: string;
    components: ComponentsList;
  };
};

export type UpdateDataModelMessage = {
  version: 'v1.0';
  /**
   * Updates the data model for an existing surface. This message can be sent multiple times to update the data model. The createSurface message MUST have been previously sent for this surfaceId.
   */
  updateDataModel: {
    /**
     * The unique identifier for the UI surface this data model update applies to. It must be globally unique for the renderer's lifetime.
     */
    surfaceId: string;
    /**
     * An optional path to a location within the data model (e.g., '/user/name'). If omitted, or set to '/', refers to the entire data model.
     */
    path?: string;
    /**
     * The data to be updated in the data model. To delete the key/value at 'path', set 'value' explicitly to null.
     */
    value: any;
  };
};

export type DeleteSurfaceMessage = {
  version: 'v1.0';
  /**
   * Signals the renderer to delete the surface identified by 'surfaceId'. The createSurface message MUST have been previously sent for this surfaceId.
   */
  deleteSurface: {
    /**
     * The unique identifier for the UI surface to be deleted. It must be globally unique for the renderer's lifetime.
     */
    surfaceId: string;
  };
};

export type CallRendererFunctionMessage = {
  version: 'v1.0';
  /**
   * Signals the renderer to execute a function locally on behalf of the agent.
   */
  callRendererFunction: {
    /**
     * Optional ID of the surface whose data model provides the evaluation context for this call. If omitted, the function executes in a surface-independent root context with an empty data model.
     */
    surfaceId?: string;
    /**
     * Unique ID for this instance of the function call. The renderer MUST copy this ID into the return response.
     */
    functionCallId: CallId;
    callFunction: FunctionCall;
  };
};

export type AgentFunctionResponseMessage = {
  version: 'v1.0';
  agentFunctionResponse: FunctionResponse;
};

/**
 * Describes a JSON payload for an A2UI (Agent to UI) message, which is used to dynamically construct and update user interfaces.
 */
export type AgentToRendererMessage =
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage
  | DeleteSurfaceMessage
  | CallRendererFunctionMessage
  | AgentFunctionResponseMessage;
