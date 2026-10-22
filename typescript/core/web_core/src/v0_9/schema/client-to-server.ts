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
 * Reports a user-initiated action from a component.
 */
export type A2uiClientAction = {
  /**
   * The name of the action, taken from the component's action.event.name property.
   */
  name: string;
  /**
   * The id of the surface where the event originated.
   */
  surfaceId: string;
  /**
   * The id of the component that triggered the event.
   */
  sourceComponentId: string;
  /**
   * An ISO 8601 timestamp of when the event occurred.
   */
  timestamp: string;
  /**
   * A JSON object containing the key-value pairs from the component's action.event.context, after resolving all data bindings.
   */
  context: Record<string, any>;
};

/**
 * Reports a client-side error.
 */
export type A2uiClientError =
  | {
      code: 'VALIDATION_FAILED';
      /**
       * The id of the surface where the error occurred.
       */
      surfaceId: string;
      /**
       * The JSON pointer to the field that failed validation (e.g. '/components/0/text').
       */
      path: string;
      /**
       * A short one or two sentence description of why validation failed.
       */
      message: string;
    }
  | {
      code: any;
      /**
       * A short one or two sentence description of why the error occurred.
       */
      message: string;
      /**
       * The id of the surface where the error occurred.
       */
      surfaceId: string;
      [key: string]: unknown;
    };

/**
 * A message sent from the client to the server.
 */
export type A2uiClientMessage = {
  version: 'v0.9' | 'v0.9.1';
} & ({action: A2uiClientAction} | {error: A2uiClientError});

/**
 * Schema for attaching the client data model to A2A message metadata. This object should be placed in the `a2uiClientDataModel` field of the metadata.
 */
export type A2uiClientDataModel = {
  version: 'v0.9' | 'v0.9.1';
  /**
   * A map of surface IDs to their current data models.
   */
  surfaces: Record<string, Record<string, any>>;
};

/**
 * A list of client messages.
 */
export type A2uiClientMessageList = A2uiClientMessage[];

/**
 * An object wrapping a list of client messages.
 */
export type A2uiClientMessageListWrapper = {
  messages: A2uiClientMessageList;
};
