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

/**
 * Reports a user-initiated action from a component.
 */
export type actionPayload = {
  /**
   * The name of the action, taken from the component's action.event.name property.
   */
  name: string;
  /**
   * An optional human-readable string describing the action performed by the user, taken from the component's action.event.userMessage property after resolving bindings.
   */
  userMessage?: string;
  /**
   * The id of the surface where the event originated. It must be globally unique for the renderer's lifetime.
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
  /**
   * Optional renderer-side metadata to send back to the agent with the action.
   */
  metadata?: {
    extensions?: Extensions;
  };
};

export type ActionMessage = {
  version: 'v1.0';
  action: actionPayload;
};

/**
 * Signals the agent to execute a function remotely on behalf of the renderer.
 */
export type callAgentFunctionPayload = {
  /**
   * The surface ID where the call originated.
   */
  surfaceId: string;
  /**
   * Unique ID for this instance of the function call. The agent MUST copy this ID into the return response.
   */
  functionCallId: CallId;
  callFunction: FunctionCall;
};

export type CallAgentFunctionMessage = {
  version: 'v1.0';
  callAgentFunction: callAgentFunctionPayload;
};

export type rendererFunctionResponsePayload = FunctionResponse;

export type RendererFunctionResponseMessage = {
  version: 'v1.0';
  rendererFunctionResponse: rendererFunctionResponsePayload;
};

/**
 * Reports a renderer-side error.
 */
export type errorPayload = any;

export type ErrorMessage = {
  version: 'v1.0';
  error: errorPayload;
};

/**
 * Describes a JSON payload for a renderer-to-agent event message.
 */
export type RendererToAgentMessage =
  | ActionMessage
  | CallAgentFunctionMessage
  | RendererFunctionResponseMessage
  | ErrorMessage;
