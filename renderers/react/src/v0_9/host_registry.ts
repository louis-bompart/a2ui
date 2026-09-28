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

import type {ComponentApi, SurfaceModel} from '@a2ui/web_core/v0_9';
import type {ReactHostElement} from './catalog/to_web_component';

/**
 * The React host elements currently connected for one surface.
 *
 * A host is the custom element (for example `<a2ui-react-badge>`) that stands
 * in the DOM for a node implemented in React. Every parent renders its
 * children the way web_core's `renderA2uiNode` does, as `<tag>` with only a
 * `context`, so a host carries its context and nothing else. Hosts add
 * themselves here when they are connected and have a context, and remove
 * themselves a microtask after they are disconnected. `A2uiSurface` subscribes and renders a portal
 * into each host, so every React component of the surface renders from the
 * surface's single React root while sitting at its own position in the DOM.
 */
export class HostRegistry {
  private static readonly registries = new WeakMap<SurfaceModel<ComponentApi>, HostRegistry>();

  /**
   * The registry of `surface`. Hosts find it through their own `context`, so
   * a host created by React and one created by a Web Component container end
   * up in the same place, and surfaces sharing a catalog stay separate.
   */
  static forSurface(surface: SurfaceModel<ComponentApi>): HostRegistry {
    let registry = HostRegistry.registries.get(surface);
    if (!registry) {
      registry = new HostRegistry();
      HostRegistry.registries.set(surface, registry);
    }
    return registry;
  }

  private readonly hosts = new Set<ReactHostElement>();
  private snapshot: readonly ReactHostElement[] = [];
  private readonly listeners = new Set<() => void>();

  add(host: ReactHostElement): void {
    if (this.hosts.has(host)) return;
    this.hosts.add(host);
    this.publish();
  }

  delete(host: ReactHostElement): void {
    if (this.hosts.delete(host)) this.publish();
  }

  has(host: ReactHostElement): boolean {
    return this.hosts.has(host);
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): readonly ReactHostElement[] => this.snapshot;

  private publish(): void {
    this.snapshot = [...this.hosts];
    for (const listener of this.listeners) listener();
  }
}
