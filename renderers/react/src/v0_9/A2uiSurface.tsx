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

/**
 * Surface renderer driven by the node layer, with every node in its own
 * element.
 *
 * `A2uiSurface` owns one `NodeResolver` for the surface it is given and
 * subscribes to the resolved root node. It renders the root node's element
 * (`ChildElement`) and one portal per registered host.
 *
 * A host is the custom element that stands in the DOM for a node implemented
 * in React (for example `<a2ui-react-badge>`). Hosts register with the
 * surface's `HostRegistry` once connected, wherever they are in the DOM, and
 * `A2uiSurface` portals `HostContent` into each one. Every child renders the
 * way web_core's `renderA2uiNode` renders one, as `<tag>` with only a
 * `context`, so `HostContent` looks up the host's node in the surface's node
 * index by component id and data path, and renders the implementation with
 * it; its children render as their own elements and register in turn.
 *
 * Portals keep every component in this one React tree while its DOM sits in
 * its host, so the DOM shape of a node never depends on its parent, and
 * providers, error boundaries and Suspense above `A2uiSurface` reach every
 * component. The portals are siblings, so React context provided by one
 * catalog component does not reach its child components; components
 * communicate through the data model.
 */

import React, {useCallback, useMemo, useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {
  NodeResolver,
  effect,
  getValue,
  peekValue,
  type Signal,
  type SurfaceModel,
} from '@a2ui/web_core/v0_9';
import {registerUniversalElement} from '@a2ui/web_core/v0_9/universal';
import {customElementFor, type ReactHostElement} from './catalog/to_web_component';
import {HostRegistry} from './host_registry';
import {
  ChildElement,
  HostContent,
  LoadingPlaceholder,
  NodeIndexContext,
  NodeSurfaceContext,
} from './node-view';
import {createNodeIndex, type NodeIndex} from './node_index';
import type {ReactCatalogComponent} from './react_component_implementation';

const hostKeys = new WeakMap<ReactHostElement, string>();
let nextHostKey = 0;

/** A stable key per host, so each portal keeps its state across registry updates. */
function hostKey(host: ReactHostElement): string {
  let key = hostKeys.get(host);
  if (key === undefined) {
    key = `a2ui-host-${nextHostKey++}`;
    hostKeys.set(host, key);
  }
  return key;
}

export const A2uiSurface: React.FC<{
  surface: SurfaceModel<ReactCatalogComponent>;
}> = ({surface}) => {
  // Define the custom element of every entry in every catalog the surface can
  // resolve components through (`availableCatalogs` includes the default one):
  // a React implementation's host element, or a Web Component entry's own. This
  // runs during render, not in an effect, because the elements have to exist
  // before `ChildElement` creates them in this same pass.
  // `registerUniversalElement` is idempotent.
  useMemo(() => {
    for (const catalog of surface.availableCatalogs.values()) {
      for (const entry of catalog.components.values()) {
        const element = customElementFor(entry);
        if (element) {
          registerUniversalElement(element);
        }
      }
    }
  }, [surface]);

  // The resolver, and the node index built over it, are created inside
  // subscribe, which React calls only for committed renders: a render that is
  // discarded (concurrent mode, Suspense) never constructs one, and every
  // constructed resolver is disposed by its own unsubscribe. StrictMode's
  // double mount creates and disposes two in turn.
  // The factory reads nothing; the dependency exists to reset the box when
  // the surface is swapped.
  const box = useMemo(
    () => ({
      resolver: undefined as NodeResolver<ReactCatalogComponent> | undefined,
      index: undefined as Signal<NodeIndex<ReactCatalogComponent>> | undefined,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [surface],
  );
  const subscribe = useCallback(
    (onChange: () => void) => {
      const resolver = new NodeResolver(surface, surface.defaultCatalog);
      box.resolver = resolver;
      box.index = createNodeIndex(resolver);
      const stopEffect = effect(() => {
        getValue(resolver.rootNode);
        onChange();
      });
      return () => {
        stopEffect();
        resolver.dispose();
        if (box.resolver === resolver) {
          box.resolver = undefined;
          box.index = undefined;
        }
      };
    },
    [surface, box],
  );
  const getSnapshot = useCallback(
    () => (box.resolver ? peekValue(box.resolver.rootNode) : undefined),
    [box],
  );
  const root = useSyncExternalStore(subscribe, getSnapshot);

  const registry = HostRegistry.forSurface(surface);
  const hosts = useSyncExternalStore(registry.subscribe, registry.getSnapshot);

  if (!root) {
    return <LoadingPlaceholder componentId="root" />;
  }
  return (
    <NodeSurfaceContext.Provider value={surface}>
      <NodeIndexContext.Provider value={box.index ?? null}>
        <ChildElement surface={surface} node={root} />
        {hosts.map(host => createPortal(<HostContent host={host} />, host, hostKey(host)))}
      </NodeIndexContext.Provider>
    </NodeSurfaceContext.Provider>
  );
};
