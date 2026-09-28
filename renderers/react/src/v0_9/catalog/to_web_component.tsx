/*
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type {ZodTypeAny} from 'zod';
import type {ComponentContext} from '@a2ui/web_core/v0_9';
import {
  isWebComponentImplementation,
  type A2uiWebComponentElement,
  type WebComponentImplementation,
} from '@a2ui/web_core/v0_9/universal';
import {HostRegistry} from '../host_registry';
import type {ReactComponentImplementation} from '../react_component_implementation';

/**
 * The host element of a node implemented in React.
 *
 * A host is the custom element (for example `<a2ui-react-badge>`) that stands
 * in the DOM for one node. Like any universal Web Component, it is handed
 * only the node's `ComponentContext` in `context`, by React and Web Component
 * parents alike, and it uses `display: contents` so it adds no layout box. It
 * renders nothing itself and holds no implementation: once connected and
 * given a `context`, it registers with its surface's `HostRegistry`, and
 * `A2uiSurface` portals the node's React content into it, resolving the node
 * from the surface's tree by the context's component id and data path.
 *
 * It renders only under an `A2uiSurface` for its surface; React
 * implementations are not portable to other frameworks' surfaces.
 */
export interface ReactHostElement extends HTMLElement, A2uiWebComponentElement {
  /** Calls `listener` whenever `context` is assigned. */
  subscribe(listener: () => void): () => void;
  /** The current `context`, for `useSyncExternalStore`. */
  getContext(): ComponentContext | undefined;
}

/**
 * The behaviour every React host element shares. `toWebComponent` derives one
 * empty subclass per tag name.
 */
class ReactWcHost extends HTMLElement implements ReactHostElement {
  private _context?: ComponentContext;
  private registry?: HostRegistry;
  private readonly listeners = new Set<() => void>();

  connectedCallback() {
    this.style.display = 'contents';
    this.register();
  }

  disconnectedCallback() {
    // Deferred, so re-parenting (a disconnect and a connect in the same
    // task) keeps the portal and its React state.
    queueMicrotask(() => {
      if (!this.isConnected) {
        this.registry?.delete(this);
        this.registry = undefined;
      }
    });
  }

  set context(ctx: ComponentContext | undefined) {
    this._context = ctx;
    this.register();
    this.notify();
  }

  get context(): ComponentContext | undefined {
    return this._context;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getContext = (): ComponentContext | undefined => this._context;

  private notify() {
    for (const listener of this.listeners) listener();
  }

  /** Joins the registry of the surface `context` belongs to. */
  private register() {
    if (!this.isConnected || !this._context) return;
    const registry = HostRegistry.forSurface(this._context.dataContext.surface);
    // A context from another surface moves the host to that surface.
    if (this.registry !== registry) {
      this.registry?.delete(this);
      this.registry = registry;
    }
    registry.add(this);
  }
}

const reactWcCache = new WeakMap<
  ReactComponentImplementation['render'],
  WebComponentImplementation
>();
const tagNameCounts = new Map<string, number>();

/**
 * Computes a unique custom element tag name of the form `a2ui-react-<name>`.
 *
 * Names are disambiguated with an incrementing suffix (`a2ui-react-<name>-2`,
 * ...) so that two different React implementations sharing a component name
 * get distinct tags.
 */
function computeTagName(name: string): string {
  const baseTagName = `a2ui-react-${name.toLowerCase()}`;
  const count = (tagNameCounts.get(baseTagName) ?? 0) + 1;
  tagNameCounts.set(baseTagName, count);
  return count === 1 ? baseTagName : `${baseTagName}-${count}`;
}

/**
 * Wraps a React implementation into the custom element that hosts it, and
 * returns it as a `WebComponentImplementation`.
 *
 * The element is named `a2ui-react-<name>` unless the implementation brings a
 * `tagName`. The element is not defined in the `customElements` registry
 * here; renderers define it on demand with `registerUniversalElement`, like
 * any other `WebComponentImplementation`.
 *
 * Calling this twice with the same `render` function returns the same
 * implementation.
 *
 * @param componentImpl The React implementation to host.
 * @returns The host element's tag name and constructor.
 */
export function toWebComponent<Schema extends ZodTypeAny = ZodTypeAny>(
  componentImpl: ReactComponentImplementation<Schema> & {tagName?: string},
): WebComponentImplementation<Schema> {
  const cached = reactWcCache.get(componentImpl.render);
  if (cached) {
    return cached as WebComponentImplementation<Schema>;
  }

  const tagName = componentImpl.tagName || computeTagName(componentImpl.name);
  // `customElements` refuses to define one class under two tag names.
  const element = class extends ReactWcHost {};

  const implementation: WebComponentImplementation<Schema> = {
    name: componentImpl.name,
    schema: componentImpl.schema,
    tagName,
    element,
  };

  reactWcCache.set(componentImpl.render, implementation);
  return implementation;
}

/**
 * The host element of a React implementation: `toWebComponent`'s result,
 * cached per `render` function. Factory-made entries already carry the same
 * element; hand-written implementations get theirs here.
 */
export function hostElementFor(
  implementation: ReactComponentImplementation,
): WebComponentImplementation {
  return toWebComponent(implementation);
}

/**
 * Duck-types a catalog entry as a `ReactComponentImplementation`
 * (`typeof entry.render === 'function'`), so catalogs built from plain object
 * literals are recognized without class inheritance or brand symbols.
 */
function isReactComponentImplementation(entry: unknown): entry is ReactComponentImplementation {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    'render' in entry &&
    typeof (entry as {render?: unknown}).render === 'function'
  );
}

/**
 * The custom element a catalog entry renders as: a React implementation's
 * host element, or a Web Component entry itself. Returns `undefined` for an
 * entry that is neither.
 */
export function customElementFor(entry: unknown): WebComponentImplementation | undefined {
  if (isReactComponentImplementation(entry)) {
    return hostElementFor(entry);
  }
  if (isWebComponentImplementation(entry)) {
    return entry;
  }
  return undefined;
}
