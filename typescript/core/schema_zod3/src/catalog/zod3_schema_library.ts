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

/**
 * The Zod 3 schema library: everything web_core does with Zod 3 schemas.
 */

import {
  AccessibilityAttributesSchema,
  CommonSchemas,
  ComponentCommonSchema,
} from '../common/common-types.js';
import {A2uiMessageSchema as V08MessageSchema} from '../v0_8/server-to-client.js';
import {A2uiMessageSchema as V09MessageSchema} from '../v0_9/server-to-client.js';
import {AgentToRendererMessageSchema} from '../v1_0/agent-to-renderer.js';
import {zod3ToJsonSchema} from './zod3_json_schema.js';
import {isZod3Schema, zodSchemaOf} from './zod_schema.js';
import type {CatalogDocumentShaper, SchemaLibrary} from '@a2ui/web_core/schema-library';
import {getSpecAnnotation} from './spec_annotations.js';
import {isSpecComponentSchema, isSpecFunctionSchema, SpecShaper} from './spec_shape.js';
import {zod3CatalogSchemaCompiler} from './zod3_catalog_compiler.js';

/** Writes the definitions of Zod 3 schemas annotated with `spec()`. */
const zod3DocumentShaper: CatalogDocumentShaper = {
  component(name, component, {protocolVersion, commonTypesUri}) {
    if (!isZod3Schema(component.schema) || !isSpecComponentSchema(component.schema)) {
      return undefined;
    }
    const shaper = new SpecShaper(protocolVersion, commonTypesUri);
    const {schema, catalogDefs} = shaper.componentSchema(
      name,
      component.schema,
      component.allowedParents,
      component.allowedChildren,
    );
    const defs = new Map(
      [...catalogDefs].map(([defName, model]) => [defName, shaper.defSchema(model)]),
    );
    return {definition: schema, defs};
  },
  function(name, fn, {protocolVersion, commonTypesUri}) {
    if (!isZod3Schema(fn.schema) || !isSpecFunctionSchema(fn.schema)) return undefined;
    return new SpecShaper(protocolVersion, commonTypesUri).functionSchema(name, fn);
  },
  definition(model, {protocolVersion, commonTypesUri}) {
    if (!isZod3Schema(model)) return undefined;
    const annotation = getSpecAnnotation(zodSchemaOf(model));
    if (!annotation) return undefined;
    return {
      name: annotation.defName,
      definition: new SpecShaper(protocolVersion, commonTypesUri).defSchema(model),
    };
  },
};

/**
 * The descriptions the Zod 3 mirrors of the common types carry on their
 * `REF:` markers, by definition name.
 */
function mirrorDescriptions(): ReadonlyMap<string, string> {
  return new Map(
    Object.values(CommonSchemas).flatMap(mirror => {
      const description = (mirror as {description?: unknown}).description;
      if (typeof description !== 'string' || !description.startsWith('REF:')) return [];
      const content = description.substring(4);
      const pipeIndex = content.indexOf('|');
      if (pipeIndex === -1) return [];
      const name = content.substring(0, pipeIndex).split('/').pop()!;
      return [[name, content.substring(pipeIndex + 1)] as [string, string]];
    }),
  );
}

let library: SchemaLibrary | undefined;

/**
 * Returns the Zod 3 schema library, created on first use.
 */
export function zod3SchemaLibrary(): SchemaLibrary {
  return (library ??= {
    name: 'zod3',
    catalogSchemaCompiler: zod3CatalogSchemaCompiler,
    protocolSchemas: {
      '0.8': V08MessageSchema,
      '0.9': V09MessageSchema,
      '1.0': AgentToRendererMessageSchema,
    },
    envelopeSchemas: {
      accessibility: AccessibilityAttributesSchema.optional(),
      metadata: ComponentCommonSchema.shape.metadata,
    },
    toJsonSchema: schema =>
      isZod3Schema(schema) ? zod3ToJsonSchema(zodSchemaOf(schema)) : undefined,
    documentShaper: zod3DocumentShaper,
    commonTypeDescriptions: mirrorDescriptions(),
  });
}
