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

export type CreateSurfaceMessage = {
  version: 'v0.9' | 'v0.9.1';
  /**
   * Signals the client to create a new surface and begin rendering it. It is an error to send 'createSurface' for a surfaceId that already exists without first deleting it. When this message is sent, the client will expect 'updateComponents' and/or 'updateDataModel' messages for the same surfaceId that define the component tree.
   */
  createSurface: {
    /**
     * The unique identifier for the UI surface to be rendered.
     */
    surfaceId: string;
    /**
     * A string that uniquely identifies this catalog. It is recommended to prefix this with an internet domain that you own, to avoid conflicts e.g. mycompany.com:somecatalog'.
     */
    catalogId: string;
    /**
     * Theme parameters for the surface (e.g., {'primaryColor': '#FF0000'}). These must validate against the 'theme' schema defined in the catalog.
     */
    theme?: any;
    /**
     * If true, the client will send the full data model of this surface in the metadata of every A2A message sent to the server that created the surface. Defaults to false.
     */
    sendDataModel?: boolean;
  };
};

export type UpdateComponentsMessage = {
  version: 'v0.9' | 'v0.9.1';
  /**
   * Updates a surface with a new set of components. This message can be sent multiple times to update the component tree of an existing surface. One of the components in one of the components lists MUST have an 'id' of 'root' to serve as the root of the component tree. A createSurface message MUST have been previously sent for the 'surfaceId' in this message; the surface's catalog is the one specified by that createSurface.
   */
  updateComponents: {
    /**
     * The unique identifier for the UI surface to be updated.
     */
    surfaceId: string;
    /**
     * A list containing all UI components for the surface.
     */
    components: any[];
  };
};

export type UpdateDataModelMessage = {
  version: 'v0.9' | 'v0.9.1';
  /**
   * Updates the data model for an existing surface. This message can be sent multiple times to update the data model. A createSurface message MUST have been previously sent for the 'surfaceId' in this message; the surface's catalog is the one specified by that createSurface.
   */
  updateDataModel: {
    /**
     * The unique identifier for the UI surface this data model update applies to.
     */
    surfaceId: string;
    /**
     * An optional path to a location within the data model (e.g., '/user/name'). If omitted, or set to '/', refers to the entire data model.
     */
    path?: string;
    /**
     * The data to be updated in the data model. If present, the value at 'path' is replaced (or created). If omitted, the key at 'path' is removed.
     */
    value?: any;
  };
};

export type DeleteSurfaceMessage = {
  version: 'v0.9' | 'v0.9.1';
  /**
   * Signals the client to delete the surface identified by 'surfaceId'. A createSurface message MUST have been previously sent for the 'surfaceId' in this message; the surface's catalog is the one specified by that createSurface.
   */
  deleteSurface: {
    /**
     * The unique identifier for the UI surface to be deleted.
     */
    surfaceId: string;
  };
};

/**
 * Describes a JSON payload for an A2UI (Agent to UI) message, which is used to dynamically construct and update user interfaces.
 */
export type A2uiMessage =
  | CreateSurfaceMessage
  | UpdateComponentsMessage
  | UpdateDataModelMessage
  | DeleteSurfaceMessage;

/**
 * A list of messages.
 */
export type A2uiMessageList = A2uiMessage[];

/**
 * An object wrapping a list of messages.
 */
export type A2uiMessageListWrapper = {
  messages: A2uiMessageList;
};
