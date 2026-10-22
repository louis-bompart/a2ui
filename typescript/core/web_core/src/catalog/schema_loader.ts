/*
 * Copyright 2024 Google LLC
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

import {isAtLeastVersion} from '../common/semver.js';
import {assertUax31Identifier} from '../common/uax31.js';
import {A2uiCatalogError} from '../errors.js';
import {CommonSchemas} from '../types/common-types.js';
import type {A2uiSchema} from './a2ui_schema.js';
import {DeferredSchema, JsonComponentApi, JsonFunctionApi} from './json_entries.js';
import type {CatalogSchemaCompiler} from './schema_compiler.js';
import {
  buildComponentUnion,
  buildFunctionUnion,
  deepCopyJson,
  deepFreeze,
} from './schema_serializer.js';
import type {CatalogDocumentOptions, CatalogInterface, ComponentApi, FunctionApi} from './types.js';

/**
 * The fields of a parsed catalog document: its ID, version and entries, and
 * the document-level fields a `Catalog` keeps so that `toJson` reproduces the
 * document.
 */
export interface ParsedCatalogSchema extends CatalogDocumentOptions {
  id: string;
  protocolVersion: string;
  components: ComponentApi[];
  functions: FunctionApi[];
  themeSchema?: A2uiSchema;
}

/**
 * Protocol version assumed for a catalog schema that does not declare one.
 *
 * Catalog schemas only began carrying `protocolVersion` at v1.0, so a schema
 * that omits it predates that field.
 */
export const DEFAULT_PROTOCOL_VERSION = '0.9';

/**
 * A peer catalog that a cross-catalog `$ref` can resolve against: a catalog,
 * or a raw catalog document.
 */
export type PeerCatalogSource =
  | CatalogInterface<ComponentApi, FunctionApi>
  | Readonly<Record<string, unknown>>;

const COMMON_TYPES_DOCUMENT = 'common_types.json';
const CATALOG_DOCUMENT = 'catalog.json';

/** Whether `doc` is the document `name`, bare or as the last segment of a path. */
function isDocumentNamed(doc: string, name: string): boolean {
  return doc === name || doc.endsWith(`/${name}`);
}

/** Returns the last `/`-separated segment of a path or URI. */
function lastPathSegment(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Splits a `$ref` at its first `#` into its document and fragment. */
function splitRef(ref: string): {doc: string; fragment: string} {
  const hashIdx = ref.indexOf('#');
  return hashIdx < 0
    ? {doc: ref, fragment: ''}
    : {doc: ref.slice(0, hashIdx), fragment: ref.slice(hashIdx)};
}

/**
 * Where the document part of a `$ref` points: the document that contains the
 * reference (`self`), the common types document, a peer catalog, or nowhere
 * known.
 */
type RefDocument =
  | {readonly kind: 'self'}
  | {readonly kind: 'commonTypes'}
  | {readonly kind: 'peer'; readonly peer: PeerCatalogSource}
  | {readonly kind: 'unresolved'};

function isCatalogInstance(
  peer: PeerCatalogSource,
): peer is CatalogInterface<ComponentApi, FunctionApi> {
  return typeof (peer as CatalogInterface<ComponentApi, FunctionApi>).toJson === 'function';
}

function peerIds(peer: PeerCatalogSource): {id?: string; schemaId?: string} {
  if (isCatalogInstance(peer)) {
    return {id: peer.id, schemaId: peer.schemaId};
  }
  const cid = peer['catalogId'];
  const sid = peer['$id'];
  return {
    id: typeof cid === 'string' ? cid : undefined,
    schemaId: typeof sid === 'string' ? sid : undefined,
  };
}

/**
 * Resolves the document part `doc` of a `$ref` with the peer matching rule:
 *
 * 1. An empty `doc` is the document that contains the reference.
 * 2. `common_types.json`, bare or as a path suffix, is the common types
 *    document.
 * 3. A bare `catalog.json` is the document that contains the reference.
 * 4. Otherwise, the first peer whose `catalogId` or `$id` equals `doc`, ends
 *    with `/` + `doc`, or is a `/`-suffix of `doc`.
 * 5. Otherwise, a `doc` ending in `/catalog.json` is the document that contains
 *    the reference.
 * 6. Otherwise, the first peer whose `$id` or `catalogId` has the same last
 *    path segment as `doc`.
 * 7. Otherwise, the reference is unresolved.
 */
function resolveRefDocument(doc: string, peers: readonly PeerCatalogSource[]): RefDocument {
  if (!doc) return {kind: 'self'};
  if (isDocumentNamed(doc, COMMON_TYPES_DOCUMENT)) return {kind: 'commonTypes'};
  if (doc === CATALOG_DOCUMENT) return {kind: 'self'};

  for (const peer of peers) {
    const {id, schemaId} = peerIds(peer);
    for (const candidate of [id, schemaId]) {
      if (
        candidate &&
        (doc === candidate || candidate.endsWith(`/${doc}`) || doc.endsWith(`/${candidate}`))
      ) {
        return {kind: 'peer', peer};
      }
    }
  }

  if (doc.endsWith(`/${CATALOG_DOCUMENT}`)) return {kind: 'self'};

  const base = lastPathSegment(doc);
  for (const peer of peers) {
    const {id, schemaId} = peerIds(peer);
    for (const candidate of [schemaId, id]) {
      if (candidate && lastPathSegment(candidate) === base) {
        return {kind: 'peer', peer};
      }
    }
  }
  return {kind: 'unresolved'};
}

/**
 * Whether a JSON document contains a `$ref` into another catalog document: one
 * whose document part is neither empty, nor the common types document, nor a
 * bare `catalog.json`.
 *
 * @param node A catalog document or a part of one.
 */
export function hasCrossDocumentRefs(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasCrossDocumentRefs);
  if (!node || typeof node !== 'object') return false;
  for (const [key, value] of Object.entries(node)) {
    if (key === '$ref' && typeof value === 'string') {
      const {doc} = splitRef(value);
      if (doc && doc !== CATALOG_DOCUMENT && !isDocumentNamed(doc, COMMON_TYPES_DOCUMENT)) {
        return true;
      }
    } else if (hasCrossDocumentRefs(value)) {
      return true;
    }
  }
  return false;
}

/** Stable identities of the documents local `#/...` pointers resolve into. */
const documentIds = new WeakMap<object, number>();
let nextDocumentId = 0;

/** Returns a key that identifies `doc` for cycle detection and caching. */
function documentKey(doc: object): number {
  let id = documentIds.get(doc);
  if (id === undefined) {
    id = nextDocumentId++;
    documentIds.set(doc, id);
  }
  return id;
}

/** A `$ref` resolved to the document and pointer it targets. */
interface RefTarget {
  /** The document the pointer resolves in. */
  readonly doc: Readonly<Record<string, unknown>>;
  /** The JSON pointer within `doc`, starting with `#/`. */
  readonly pointer: string;
  /**
   * Key identifying the target for cycle detection and caching: the
   * document's identity and the pointer for a pointer into the current
   * document, and the reference itself for a peer.
   */
  readonly key: string;
  /** Whether the target is in a peer catalog rather than the current document. */
  readonly isPeer: boolean;
}

/**
 * The peer catalogs `$ref`s resolve against while converting or inlining one
 * schema, with each peer's document read once.
 */
export class PeerScope {
  private readonly documents = new Map<PeerCatalogSource, Readonly<Record<string, unknown>>>();

  constructor(readonly peers: readonly PeerCatalogSource[] = []) {}

  /** Returns the catalog document of a peer. */
  documentOf(peer: PeerCatalogSource): Readonly<Record<string, unknown>> {
    if (!isCatalogInstance(peer)) return peer;
    let doc = this.documents.get(peer);
    if (!doc) {
      doc = peer.toJson();
      this.documents.set(peer, doc);
    }
    return doc;
  }

  /**
   * Resolves `ref`, written in `currentDoc`, to the document and pointer it
   * targets, or returns `undefined` for a reference to the common types, to
   * an unknown document, or without a JSON pointer fragment.
   */
  resolve(ref: string, currentDoc: Readonly<Record<string, unknown>>): RefTarget | undefined {
    const {doc, fragment} = splitRef(ref);
    if (!fragment.startsWith('#/')) return undefined;
    const target = resolveRefDocument(doc, this.peers);
    if (target.kind === 'self') {
      return {
        doc: currentDoc,
        pointer: fragment,
        key: `${documentKey(currentDoc)}:${fragment}`,
        isPeer: false,
      };
    }
    if (target.kind === 'peer') {
      return {doc: this.documentOf(target.peer), pointer: fragment, key: ref, isPeer: true};
    }
    return undefined;
  }

  /**
   * Throws if `ref` points into another catalog document that no peer
   * matches: such a reference is a catalog error, never a schema that accepts
   * any value.
   *
   * @throws {A2uiCatalogError} If `ref` is an unresolvable cross-catalog reference.
   */
  assertResolvable(ref: string): void {
    if (resolveRefDocument(splitRef(ref).doc, this.peers).kind === 'unresolved') {
      throwUnresolvableRef(ref);
    }
  }
}

/** Reports a reference whose target cannot be found as a catalog error. */
export function throwUnresolvableRef(ref: string): never {
  throw new A2uiCatalogError(`Unresolvable schema reference: '${ref}'`);
}

/**
 * Builds a JSON-loaded catalog entry linked to the given peer catalogs, by
 * entry: each entry `fromJson` loads, and each entry rebuilt from one, maps to
 * the function that built it. The function does not depend on any peers.
 */
const entryBuilders = new WeakMap<
  object,
  (peers: readonly PeerCatalogSource[]) => ComponentApi | FunctionApi
>();

/**
 * Returns a copy of a catalog entry whose Zod schema resolves cross-catalog
 * `$ref`s against `peers`. An entry `fromJson` loaded is rebuilt from the same
 * definition; any other entry is returned as is.
 *
 * @param entry A component or function.
 * @param peers The peer catalogs, in matching order.
 */
export function linkEntry<E extends ComponentApi | FunctionApi>(
  entry: E,
  peers: readonly PeerCatalogSource[],
): E {
  const build = entryBuilders.get(entry);
  return build ? (build(peers) as E) : entry;
}

function stripEnvelopeFromSubschema(node: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'unevaluatedProperties' || k === 'additionalProperties' || k === 'title') {
      continue;
    }
    cleaned[k] = v;
  }
  if (
    cleaned.properties &&
    typeof cleaned.properties === 'object' &&
    !Array.isArray(cleaned.properties)
  ) {
    const nextProps: Record<string, unknown> = {};
    for (const [pk, pv] of Object.entries(cleaned.properties as Record<string, unknown>)) {
      if (!isEnvelopeField(pk)) {
        nextProps[pk] = pv;
      }
    }
    cleaned.properties = nextProps;
  }
  if (Array.isArray(cleaned.required)) {
    cleaned.required = cleaned.required.filter(
      (r): r is string => typeof r === 'string' && !isEnvelopeField(r),
    );
  }
  if (Array.isArray(cleaned.allOf)) {
    const specific: unknown[] = [];
    const inherited: unknown[] = [];
    for (const item of cleaned.allOf) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const itemObj = item as Record<string, unknown>;
        const itemProps = itemObj.properties;
        const hasComp =
          Boolean(itemProps) &&
          typeof itemProps === 'object' &&
          !Array.isArray(itemProps) &&
          'component' in (itemProps as Record<string, unknown>);
        const strippedItem = stripEnvelopeFromSubschema(itemObj);
        if (hasComp) {
          specific.push(strippedItem);
        } else {
          inherited.push(strippedItem);
        }
      } else {
        inherited.push(item);
      }
    }
    cleaned.allOf = [...specific, ...inherited];
  }
  return cleaned;
}

function stripReferencedComponentEnvelope(
  node: Record<string, unknown>,
  pointer: string,
): Record<string, unknown> {
  if (!pointer.startsWith('#/components/')) return node;
  const parts = pointer.slice(2).split('/');
  if (parts.length !== 2) return node;
  return stripEnvelopeFromSubschema(node);
}

/**
 * Resolves a `$ref` into a peer catalog to its target, without the component
 * envelope when the target is a whole component.
 */
export function resolvePeerTarget(
  target: RefTarget,
): {doc: Record<string, unknown>; target: Record<string, unknown>} | undefined {
  const doc = target.doc as Record<string, unknown>;
  const raw = resolveJsonPointer(doc, target.pointer);
  return raw ? {doc, target: stripReferencedComponentEnvelope(raw, target.pointer)} : undefined;
}

/**
 * Returns a copy of `node` with local `#/...` and peer catalog `<doc>#/...`
 * references resolved inline, preserving references to standard common types.
 *
 * Documents are matched with the peer matching rule: a reference to a bare
 * `catalog.json`, or to a document ending in `/catalog.json` that no peer
 * matches exactly, points into `rootDoc`. References inside an inlined peer
 * document resolve against the same `peers`, and its local pointers against
 * that peer's document.
 *
 * @param node The schema to inline references in.
 * @param rootDoc The document `node` belongs to.
 * @param peers The peer catalogs, in matching order.
 * @param options `inlineLocalDefs`: whether to inline local `#/$defs/...`
 *     pointers of `rootDoc` (pointers inside a peer document are always
 *     inlined). `visited`: keys of the references already being inlined.
 */
export function inlinePeerAndLocalRefs(
  node: unknown,
  rootDoc: Record<string, unknown>,
  peers: readonly PeerCatalogSource[] = [],
  options: {inlineLocalDefs?: boolean; visited?: Set<string>} = {},
): unknown {
  return inlineRefs(
    node,
    rootDoc,
    new PeerScope(peers),
    options.inlineLocalDefs ?? true,
    options.visited ?? new Set<string>(),
  );
}

function inlineRefs(
  node: unknown,
  rootDoc: Readonly<Record<string, unknown>>,
  scope: PeerScope,
  inlineLocalDefs: boolean,
  visited: Set<string>,
): unknown {
  if (Array.isArray(node)) {
    return node.map(item => inlineRefs(item, rootDoc, scope, inlineLocalDefs, visited));
  }
  if (!node || typeof node !== 'object') {
    return node;
  }

  const obj = node as Record<string, unknown>;
  if (typeof obj.$ref === 'string') {
    let target = scope.resolve(obj.$ref, rootDoc);
    if (target && !target.isPeer) {
      const defName = target.pointer.split('/').pop() ?? '';
      const isPreservedCommonType =
        target.pointer.startsWith('#/$defs/') && Object.hasOwn(CommonSchemas, defName);
      if (isPreservedCommonType || (!inlineLocalDefs && target.pointer.startsWith('#/$defs/'))) {
        target = undefined;
      }
    }

    if (target && !visited.has(target.key)) {
      const resolvedTarget = resolveJsonPointer(
        target.doc as Record<string, unknown>,
        target.pointer,
      );
      if (resolvedTarget) {
        const nextVisited = new Set(visited);
        nextVisited.add(target.key);
        const inlinedTarget = inlineRefs(
          resolvedTarget,
          target.doc,
          scope,
          target.isPeer ? true : inlineLocalDefs,
          nextVisited,
        );
        if (inlinedTarget && typeof inlinedTarget === 'object' && !Array.isArray(inlinedTarget)) {
          const stripped = stripReferencedComponentEnvelope(
            inlinedTarget as Record<string, unknown>,
            target.pointer,
          );
          const res: Record<string, unknown> = {...stripped};
          for (const [k, v] of Object.entries(obj)) {
            if (k === '$ref') continue;
            const inlinedVal = inlineRefs(v, rootDoc, scope, inlineLocalDefs, visited);
            if (
              k in res &&
              res[k] &&
              typeof res[k] === 'object' &&
              !Array.isArray(res[k]) &&
              inlinedVal &&
              typeof inlinedVal === 'object' &&
              !Array.isArray(inlinedVal)
            ) {
              res[k] = {
                ...(res[k] as Record<string, unknown>),
                ...(inlinedVal as Record<string, unknown>),
              };
            } else if (Array.isArray(res[k]) && Array.isArray(inlinedVal)) {
              const existing = res[k] as unknown[];
              res[k] = [...existing, ...inlinedVal.filter(item => !existing.includes(item))];
            } else {
              res[k] = inlinedVal;
            }
          }
          return res;
        }
        return inlinedTarget;
      }
    }
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = inlineRefs(v, rootDoc, scope, inlineLocalDefs, visited);
  }
  return out;
}

/**
 * Resolves a JSON Pointer within a root JSON document.
 *
 * Follows RFC 6901 pointer unescaping (~1 -> /, ~0 -> ~).
 *
 * @param rootDoc Root JSON document to resolve within.
 * @param pointer RFC 6901 JSON pointer string.
 * @returns The resolved document subtree, or undefined if not found.
 */
export function resolveJsonPointer(
  rootDoc: Record<string, unknown>,
  pointer: string,
): Record<string, unknown> | undefined {
  if (!pointer.startsWith('#/')) return undefined;
  const segments = pointer
    .slice(2)
    .split('/')
    .map(s => s.replace(/~1/g, '/').replace(/~0/g, '~'));

  let curr: unknown = rootDoc;
  for (const seg of segments) {
    if (curr && typeof curr === 'object' && seg in curr) {
      curr = (curr as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return typeof curr === 'object' && curr !== null ? (curr as Record<string, unknown>) : undefined;
}

/**
 * Serializes a value to canonical JSON with deterministically sorted object keys.
 *
 * Produces identical strings for semantically equivalent values regardless of
 * object property insertion order.
 *
 * @param val Value to serialize.
 * @returns Deterministic JSON string representation.
 */
export function canonicalJsonStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return `[${val.map(canonicalJsonStringify).join(',')}]`;
  }
  const keys = Object.keys(val as Record<string, unknown>).sort();
  const entries = keys.map(
    k => `${JSON.stringify(k)}:${canonicalJsonStringify((val as Record<string, unknown>)[k])}`,
  );
  return `{${entries.join(',')}}`;
}

/**
 * Whether a property name is one of the component envelope fields (`id`,
 * `component`, `catalogId`), which route a component rather than configure it.
 * The validation schema leaves them out of a component for the same reason, and
 * `PayloadValidator` strips them before parsing a component.
 *
 * @param propName Property name to check.
 * @returns True if the property belongs to the envelope rather than the component.
 */
export function isEnvelopeField(propName: string): boolean {
  return propName === 'id' || propName === 'component' || propName === 'catalogId';
}

/**
 * Checks whether an object schema represents a shorthand parameter map (a map
 * of parameter names to subschemas), rather than a full JSON Schema object or
 * reference combinator.
 */
export function isShorthandParameterMap(schema: unknown): boolean {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return false;
  }
  const s = schema as Record<string, unknown>;
  return (
    Object.keys(s).length > 0 &&
    s.properties === undefined &&
    typeof s.type !== 'string' &&
    !('$ref' in s) &&
    !('allOf' in s) &&
    !('oneOf' in s) &&
    !('anyOf' in s) &&
    !('not' in s) &&
    Object.values(s).every(v => v !== null && (typeof v === 'object' || typeof v === 'boolean'))
  );
}

/** An object schema gathered from function arguments, with the document it belongs to. */
/**
 * Extracts declared parameter names from a function's argument schema.
 */
function functionParameterNames(schema: unknown, rootDoc?: Record<string, unknown>): string[] {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return [];
  }
  const s = schema as Record<string, unknown>;
  const names: string[] = [];
  const visited = new Set<string>();

  const extractProperties = (node: unknown): void => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    const n = node as Record<string, unknown>;
    if (typeof n.$ref === 'string' && rootDoc && n.$ref.startsWith('#/')) {
      if (!visited.has(n.$ref)) {
        visited.add(n.$ref);
        const target = resolveJsonPointer(rootDoc, n.$ref);
        if (target) {
          extractProperties(target);
        }
      }
    }
    if (
      n.properties &&
      typeof n.properties === 'object' &&
      n.properties !== null &&
      !Array.isArray(n.properties)
    ) {
      names.push(...Object.keys(n.properties as Record<string, unknown>));
    }
    if (Array.isArray(n.allOf)) {
      for (const member of n.allOf) {
        extractProperties(member);
      }
    }
  };

  if (
    (s.properties &&
      typeof s.properties === 'object' &&
      s.properties !== null &&
      !Array.isArray(s.properties)) ||
    Array.isArray(s.allOf) ||
    typeof s.$ref === 'string'
  ) {
    extractProperties(s);
    return names;
  }

  if (isShorthandParameterMap(s)) {
    return Object.keys(s);
  }

  return [];
}

/**
 * Parses raw catalog function definitions into typed FunctionApi objects.
 *
 * Validates UAX #31 identifier requirements when targeting protocol v1.0 or higher,
 * filters against permitted function names, and converts parameter schemas to Zod validators.
 *
 * @param rawFunctions Raw function definitions from the catalog schema (array or dictionary).
 * @param rootDoc Optional root schema document for reference resolution.
 * @param permittedNames Optional set of allowed function names from `anyFunction.oneOf`.
 * @param protocolVersion The protocol version of the catalog.
 * @param compiler Compiles the parameter schemas.
 * @returns Array of parsed FunctionApi objects.
 * @throws {A2uiCatalogError} If a function or argument identifier fails UAX #31 validation in v1.0+.
 */
function parseFunctionDefinitions(
  rawFunctions: unknown,
  rootDoc: Record<string, unknown>,
  permittedNames: Set<string> | undefined,
  protocolVersion: string,
  compiler: CatalogSchemaCompiler,
): FunctionApi[] {
  const atLeastV10 = isAtLeastVersion(protocolVersion, '1.0');
  const result: FunctionApi[] = [];
  if (!rawFunctions) return result;

  /** Validates a function's own name and its declared argument names. */
  const assertFunctionIdentifiers = (name: string, paramNames: string[]): void => {
    if (!atLeastV10) return;
    assertUax31Identifier(name, `function identifier: '${name}'`);
    for (const argName of paramNames) {
      assertUax31Identifier(argName, `argument identifier: '${argName}' in function '${name}'`);
    }
  };

  if (Array.isArray(rawFunctions)) {
    for (const fn of rawFunctions) {
      if (fn && typeof fn === 'object' && typeof fn.name === 'string') {
        const paramNames = functionParameterNames(fn.parameters, rootDoc);
        assertFunctionIdentifiers(fn.name, paramNames);
        if (permittedNames && !permittedNames.has(fn.name)) {
          continue;
        }
        const build = (peers: readonly PeerCatalogSource[]): FunctionApi => {
          const entry = new JsonFunctionApi(fn.name, fn as Record<string, unknown>, definition =>
            compiler.functionArgs(
              definition['parameters'] && typeof definition['parameters'] === 'object'
                ? (definition['parameters'] as Record<string, unknown>)
                : undefined,
              {document: rootDoc, peers, protocolVersion},
            ),
          );
          entryBuilders.set(entry, build);
          return entry;
        };
        result.push(build([]));
      }
    }
    return result;
  }

  if (typeof rawFunctions === 'object' && rawFunctions !== null) {
    for (const [name, defn] of Object.entries(rawFunctions)) {
      const rawDefn = defn && typeof defn === 'object' ? (defn as Record<string, unknown>) : {};
      const argsSchema = functionArgsSchema(rawDefn);
      const paramNames = functionParameterNames(argsSchema, rootDoc);
      assertFunctionIdentifiers(name, paramNames);
      if (permittedNames && !permittedNames.has(name)) {
        continue;
      }
      if (!defn || typeof defn !== 'object') continue;
      const build = (peers: readonly PeerCatalogSource[]): FunctionApi => {
        const entry = new JsonFunctionApi(name, defn as Record<string, unknown>, definition =>
          compiler.functionArgs(functionArgsSchema(definition), {
            document: rootDoc,
            peers,
            protocolVersion,
          }),
        );
        entryBuilders.set(entry, build);
        return entry;
      };
      result.push(build([]));
    }
  }

  return result;
}

/**
 * Returns the schema of the arguments of a function a `functions` map
 * defines: its call schema's `args`, a bare map of argument schemas with the
 * object keywords beside it, or, for a definition that is not a call schema,
 * the definition itself.
 *
 * @param d The function's definition.
 */
function functionArgsSchema(
  d: Readonly<Record<string, unknown>>,
): Record<string, unknown> | undefined {
  const props =
    d.properties &&
    typeof d.properties === 'object' &&
    d.properties !== null &&
    !Array.isArray(d.properties)
      ? (d.properties as Record<string, unknown>)
      : undefined;
  let argsSchema = props?.args ?? d.args ?? d.parameters;
  if (!argsSchema && props && !('call' in props) && !('@call' in props) && !('function' in props)) {
    argsSchema = d;
  } else if (isShorthandParameterMap(argsSchema)) {
    argsSchema = {
      type: 'object',
      properties: argsSchema as Record<string, unknown>,
      required: d.required,
      additionalProperties: d.additionalProperties,
    };
  }
  return argsSchema && typeof argsSchema === 'object' && !Array.isArray(argsSchema)
    ? (argsSchema as Record<string, unknown>)
    : undefined;
}

/**
 * Extracts permitted definition names matching a reference prefix from a `oneOf` array.
 *
 * @param oneOf Array of reference schema objects from `anyComponent` or `anyFunction`.
 * @param prefix Prefix to match and strip, such as `#/components/` or `#/functions/`.
 * @returns Set of unescaped allowed names, or undefined if `oneOf` is not an array.
 */
function extractPermittedNames(oneOf: unknown, prefix: string): Set<string> | undefined {
  if (!Array.isArray(oneOf)) return undefined;
  const permitted = new Set<string>();
  for (const item of oneOf) {
    if (typeof item?.$ref === 'string' && item.$ref.startsWith(prefix)) {
      const rawName = item.$ref.slice(prefix.length);
      const unescapedName = rawName.replace(/~([01])/g, (_: string, p1: string) =>
        p1 === '1' ? '/' : '~',
      );
      permitted.add(unescapedName);
    }
  }
  return permitted;
}

/**
 * Parses raw catalog component schemas into typed ComponentApi definitions.
 *
 * Validates UAX #31 identifier requirements for v1.0+ specifications, filters
 * components if permitted names are specified, and transforms JSON schemas into
 * runtime Zod schemas.
 *
 * @param componentsMap Mapping of component name to raw component schema definition.
 * @param catalogSchema Enclosing raw catalog schema for resolving local references.
 * @param permittedNames Optional set of allowed component names from anyComponent.oneOf.
 * @param protocolVersion The protocol version of the catalog.
 * @param compiler Compiles the component definitions.
 * @returns Array of parsed ComponentApi objects with validation schemas and hierarchy constraints.
 * @throws {A2uiCatalogError} If a component or property identifier fails UAX #31 validation in v1.0+.
 */
function parseCatalogComponents(
  componentsMap: Record<string, unknown>,
  catalogSchema: Record<string, unknown>,
  permittedNames: Set<string> | undefined,
  protocolVersion: string,
  compiler: CatalogSchemaCompiler,
): ComponentApi[] {
  const atLeastV10 = isAtLeastVersion(protocolVersion, '1.0');
  const components: ComponentApi[] = [];

  for (const [name, rawCompSchema] of Object.entries(componentsMap)) {
    const rawComp = (rawCompSchema as Record<string, unknown>) || {};
    if (atLeastV10) {
      assertUax31Identifier(name, `component identifier: '${name}'`);
      const props = rawComp.properties;
      if (props && typeof props === 'object') {
        for (const propName of Object.keys(props as Record<string, unknown>)) {
          assertUax31Identifier(
            propName,
            `property identifier: '${propName}' in component '${name}'`,
          );
        }
      }
    }
    if (permittedNames && !permittedNames.has(name)) {
      continue;
    }
    const build = (peers: readonly PeerCatalogSource[]): ComponentApi => {
      const entry = new JsonComponentApi(name, rawComp, definition =>
        compiler.component(definition, {document: catalogSchema, peers, protocolVersion}),
      );
      entryBuilders.set(entry, build);
      return entry;
    };
    components.push(build([]));
  }
  return components;
}

/**
 * Extracts and compiles the theme schema from a catalog definition if present.
 *
 * Checks top-level theme, themeSchema, styles, and $defs.theme definitions.
 *
 * @param catalogSchema Raw catalog schema or capabilities definition object.
 * @param defs Optional $defs mapping from the root schema.
 * @returns Compiled Zod object schema for theme tokens, or undefined if not declared.
 */
function parseThemeSchema(
  catalogSchema: Record<string, unknown>,
  defs: Record<string, unknown> | undefined,
  protocolVersion: string,
  compiler: CatalogSchemaCompiler,
): A2uiSchema | undefined {
  const rawTheme =
    catalogSchema.theme ??
    catalogSchema.themeSchema ??
    catalogSchema.styles ??
    (defs?.theme as Record<string, unknown> | undefined);
  if (rawTheme && typeof rawTheme === 'object') {
    const rawThemeObj = rawTheme as Record<string, unknown>;
    const normalizedThemeSchema =
      'properties' in rawThemeObj || 'allOf' in rawThemeObj || rawThemeObj.type === 'object'
        ? rawThemeObj
        : {type: 'object', properties: rawThemeObj};
    return new DeferredSchema(() =>
      compiler.theme(normalizedThemeSchema, {
        document: catalogSchema,
        peers: [],
        protocolVersion,
      }),
    );
  }
  return undefined;
}

/**
 * Parses a raw A2UI catalog schema into its typed component, function, and metadata fields.
 *
 * Parses component and function definitions, extracts hierarchy constraints (`allowedParents`,
 * `allowedChildren`), unescapes RFC 6901 JSON pointers, and builds runtime Zod validators.
 *
 * @param inputSchema Raw catalog schema or capabilities definition object. It
 *   is copied first and never referenced afterwards.
 * @param protocolVersion Protocol version of the catalog. When given, it takes
 *   precedence over the `protocolVersion` the schema declares and selects the
 *   version's loading rules; the declared version is still kept as written.
 *   Catalog schemas published before v1.0 omit `protocolVersion`; when
 *   neither the caller nor the schema supplies it, `DEFAULT_PROTOCOL_VERSION`
 *   applies.
 * @param catalogIdOverride Catalog ID to use instead of the one the schema
 *   declares. The schema itself is kept as written.
 * @returns Parsed catalog fields ready to construct a `Catalog` instance.
 * @throws {Error} If the catalog ID is missing or not a string.
 */
export function parseCatalogSchema(
  inputSchema: Record<string, unknown>,
  protocolVersion: string | undefined,
  catalogIdOverride: string | undefined,
  compiler: CatalogSchemaCompiler,
): ParsedCatalogSchema {
  // Everything the catalog keeps, including what the Zod schemas close over,
  // comes from this copy, so mutating the input afterwards cannot change it.
  const catalogSchema = deepCopyJson(inputSchema);
  const catalogId =
    catalogIdOverride ?? catalogSchema.catalogId ?? catalogSchema.$id ?? catalogSchema.id;
  if (!catalogId || typeof catalogId !== 'string') {
    throw new Error("Catalog ID must be specified via catalog metadata ('catalogId' or '$id').");
  }

  // Filter permitted components via anyComponent.oneOf if declared
  const defs = catalogSchema.$defs as Record<string, unknown> | undefined;
  const anyComp = defs?.anyComponent as Record<string, unknown> | undefined;
  const permittedNames = extractPermittedNames(anyComp?.oneOf, '#/components/');

  const resolvedVersion =
    protocolVersion ??
    (catalogSchema.protocolVersion as string | undefined) ??
    DEFAULT_PROTOCOL_VERSION;

  const componentsMap = (catalogSchema.components as Record<string, unknown>) ?? {};
  const components = parseCatalogComponents(
    componentsMap,
    catalogSchema,
    permittedNames,
    resolvedVersion,
    compiler,
  );

  // Filter permitted functions via anyFunction.oneOf if declared
  const anyFunc = defs?.anyFunction as Record<string, unknown> | undefined;
  const permittedFunctionNames = extractPermittedNames(anyFunc?.oneOf, '#/functions/');

  const functions = parseFunctionDefinitions(
    catalogSchema.functions,
    catalogSchema,
    permittedFunctionNames,
    resolvedVersion,
    compiler,
  );

  const themeSchema = parseThemeSchema(catalogSchema, defs, resolvedVersion, compiler);

  // The copy is frozen: the entries' definitions and the document fields
  // refer into it.
  deepFreeze(catalogSchema);

  return {
    id: catalogId,
    protocolVersion: resolvedVersion,
    components,
    functions,
    themeSchema,
    ...readDocumentFields(catalogSchema, components, functions),
  };
}

/** Top-level keys of a catalog document that `CatalogDocumentOptions` models. */
const DOCUMENT_STRING_FIELDS = {
  '$schema': 'schemaUri',
  '$id': 'schemaId',
  'title': 'title',
  'description': 'description',
  'instructions': 'instructions',
} as const;

/** Top-level keys of a catalog document that `Catalog` models besides the string fields. */
const DOCUMENT_STRUCTURE_FIELDS = new Set(['protocolVersion', 'catalogId', 'components']);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether `actual` is the union a catalog computes, ignoring object key order.
 */
function isComputedUnion(actual: unknown, computed: Record<string, unknown>): boolean {
  return canonicalJsonStringify(actual) === canonicalJsonStringify(computed);
}

/**
 * Reads the document-level fields of a catalog document into the model fields
 * `Catalog` keeps.
 *
 * The `anyComponent` and `anyFunction` unions become flags when they list
 * exactly the loaded entries, in order, as `toJson` computes them; a union of
 * any other form stays in `defs` as written. Keys the model has no field for
 * are kept in `extensionFields`.
 *
 * @param document The frozen catalog document.
 * @param components The components loaded from it.
 * @param functions The functions loaded from it.
 */
function readDocumentFields(
  document: Readonly<Record<string, unknown>>,
  components: readonly ComponentApi[],
  functions: readonly FunctionApi[],
): CatalogDocumentOptions {
  const fields: CatalogDocumentOptions = {};
  const extensionFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if (key in DOCUMENT_STRING_FIELDS && typeof value === 'string') {
      fields[DOCUMENT_STRING_FIELDS[key as keyof typeof DOCUMENT_STRING_FIELDS]] = value;
    } else if (key === 'protocolVersion' && typeof value === 'string') {
      fields.declaredProtocolVersion = value;
    } else if (key === 'functions' && (Array.isArray(value) || isPlainObject(value))) {
      fields.functionsLayout = Array.isArray(value) ? 'list' : 'map';
    } else if (key === '$defs' && isPlainObject(value)) {
      const anyComponent = isComputedUnion(
        value['anyComponent'],
        buildComponentUnion(components.map(c => c.name)),
      );
      const anyFunction = isComputedUnion(
        value['anyFunction'],
        buildFunctionUnion(functions.map(f => f.name)),
      );
      fields.unions = {anyComponent, anyFunction};
      const defs: Record<string, unknown> = {};
      for (const [name, def] of Object.entries(value)) {
        if ((name === 'anyComponent' && anyComponent) || (name === 'anyFunction' && anyFunction)) {
          continue;
        }
        defs[name] = def;
      }
      fields.defs = Object.freeze(defs);
    } else if (
      !DOCUMENT_STRUCTURE_FIELDS.has(key) ||
      (key === 'components' && !isPlainObject(value))
    ) {
      extensionFields[key] = value;
    }
  }
  fields.declaredProtocolVersion ??= null;
  fields.declaresCatalogId = typeof document['catalogId'] === 'string';
  fields.declaresComponents = isPlainObject(document['components']);
  fields.unions ??= {anyComponent: false, anyFunction: false};
  if (Object.keys(extensionFields).length > 0) {
    fields.extensionFields = Object.freeze(extensionFields);
  }
  return fields;
}
