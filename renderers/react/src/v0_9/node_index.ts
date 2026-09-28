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

import {
  type ComponentApi,
  type ComponentNode,
  type NodeResolver,
  type Signal,
  ResolvedBinding,
  computed,
  getValue,
  isComponentNode,
} from '@a2ui/web_core/v0_9';

/**
 * Every resolved node of a surface, keyed by `nodeKey(componentId, dataPath)`.
 */
export type NodeIndex<C extends ComponentApi = ComponentApi> = ReadonlyMap<
  string,
  ComponentNode<C>
>;

/** The index key of the node for `componentId` at `dataPath`. */
export function nodeKey(componentId: string, dataPath: string): string {
  return JSON.stringify([componentId, dataPath]);
}

/**
 * Builds a reactive index of the nodes in `resolver`'s tree.
 *
 * A host element is handed only a `context`, so it has to find its node by
 * the context's component id and data path. `NodeResolver` keeps its own
 * index private, so the surface builds this one: a single walk over the tree
 * per change, instead of one walk per host.
 *
 * The walk runs inside a `computed` that reads the root and every node's
 * props, so the index rebuilds when a child arrives, is replaced, is upgraded
 * from a placeholder, or is removed. `ResolvedBinding` holds plain snapshots,
 * so a data change emits new props and rebuilds the index too; a host whose
 * entry did not change does not re-render.
 *
 * Placeholders are skipped. When the same component appears more than once at
 * the same data path, the first node in depth-first order wins; the others
 * render identically, because the same component in the same data scope has
 * the same props.
 */
export function createNodeIndex<C extends ComponentApi>(
  resolver: NodeResolver<C>,
): Signal<NodeIndex<C>> {
  return computed(() => {
    const index = new Map<string, ComponentNode<C>>();
    const root = getValue(resolver.rootNode);
    if (root) {
      addNode(index, root);
    }
    return index;
  });
}

function addNode<C extends ComponentApi>(
  index: Map<string, ComponentNode<C>>,
  node: ComponentNode<C>,
): void {
  if (!node.isPlaceholder) {
    const key = nodeKey(node.componentId, node.dataPath);
    if (!index.has(key)) {
      index.set(key, node);
    }
  }
  addValue(index, getValue(node.props));
}

function addValue<C extends ComponentApi>(
  index: Map<string, ComponentNode<C>>,
  value: unknown,
): void {
  if (isComponentNode(value)) {
    // Every node in the props came from the same resolver, whose catalog
    // carries `C` entries.
    addNode(index, value as ComponentNode<C>);
    return;
  }
  if (value instanceof ResolvedBinding) {
    addValue(index, value.value);
    return;
  }
  const items = Array.isArray(value) ? value : isPlainObject(value) ? Object.values(value) : [];
  for (const item of items) {
    addValue(index, item);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
