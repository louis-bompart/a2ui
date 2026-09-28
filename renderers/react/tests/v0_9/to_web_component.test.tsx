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

import {describe, it, expect, afterEach, beforeAll, vi} from 'vitest';
import {render, act, cleanup, fireEvent, within} from '@testing-library/react';
import React, {useState} from 'react';
import {z} from 'zod';
import {
  Catalog,
  ChildListSchema,
  CommonSchemas,
  ComponentContext,
  ComponentModel,
  SurfaceModel,
} from '@a2ui/web_core/v0_9';
import {registerUniversalElement} from '@a2ui/web_core/v0_9/universal';
import {
  hostElementFor,
  toWebComponent,
  type ReactHostElement,
} from '../../src/v0_9/catalog/to_web_component';
import {
  createBinderlessComponentImplementation,
  createComponentImplementation,
  type ReactComponentImplementation,
} from '../../src/v0_9';
import {A2uiSurface} from '../../src/v0_9/A2uiSurface';
import {HostRegistry} from '../../src/v0_9/host_registry';

const Label = createComponentImplementation(
  {name: 'HostLabel', schema: z.object({text: CommonSchemas.DynamicString.optional()})},
  ({props}) => <span data-testid="label">{String(props.text ?? '')}</span>,
);

/** Holds React state, to show whether the portal survives a DOM move. */
const Counter = createComponentImplementation({name: 'HostCounter', schema: z.object({})}, () => {
  const [count, setCount] = useState(0);
  return (
    <button data-testid="counter" onClick={() => setCount(c => c + 1)}>
      {`count:${count}`}
    </button>
  );
});

const List = createComponentImplementation(
  {name: 'HostList', schema: z.object({children: ChildListSchema.optional()})},
  ({props, buildChild}) => (
    <div data-testid="list">
      {(props.children ?? []).map(ref =>
        typeof ref === 'string' ? (
          <React.Fragment key={ref}>{buildChild(ref)}</React.Fragment>
        ) : null,
      )}
    </div>
  ),
);

const catalog = new Catalog<ReactComponentImplementation>('host-element-test', '0.9', [
  Label,
  Counter,
  List,
]);

/** A surface whose root lists two labels (`a`, `b`) and a counter. */
function createSurface(id: string): SurfaceModel<ReactComponentImplementation> {
  const surface = new SurfaceModel<ReactComponentImplementation>(id, catalog);
  const add = (componentId: string, type: string, props: Record<string, unknown>) =>
    surface.componentsModel.addComponent(new ComponentModel(componentId, type, props, catalog));
  add('root', 'HostList', {children: ['a', 'b', 'counter']});
  add('a', 'HostLabel', {text: 'A'});
  add('b', 'HostLabel', {text: 'B'});
  add('counter', 'HostCounter', {});
  return surface;
}

/** Renders `surface` and returns the host React created for component `id`. */
function renderSurface(surface: SurfaceModel<ReactComponentImplementation>) {
  const view = render(<A2uiSurface surface={surface} />);
  const hostOf = (id: string): ReactHostElement => {
    const host = [...view.container.querySelectorAll('*')].find(
      (element): element is ReactHostElement =>
        element.localName.startsWith('a2ui-react-') &&
        (element as ReactHostElement).context?.componentModel.id === id,
    );
    if (!host) throw new Error(`No host for ${id}.`);
    return host;
  };
  return {view, hostOf};
}

/** Creates a detached host element holding the context of component `id`. */
function createHost(
  tagName: string,
  surface: SurfaceModel<ReactComponentImplementation>,
  id: string,
): ReactHostElement {
  const host = document.createElement(tagName) as ReactHostElement;
  host.context = new ComponentContext(surface, id, '/');
  return host;
}

/** Appends a container to the document; removed in `afterEach`. */
function appendContainer(): HTMLDivElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

/** Lets deferred host unregistration (a microtask) run. */
async function flushMicrotasks() {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  // Unmount the surfaces before detaching the hosts they portal into.
  cleanup();
  document.body.textContent = '';
});

describe('toWebComponent', () => {
  it('names the host element after the implementation', () => {
    const SimpleButton = createComponentImplementation(
      {name: 'SimpleButton', schema: z.object({label: z.string()})},
      ({props}) => <button>{props.label}</button>,
    );

    const wcImpl = toWebComponent(SimpleButton);

    expect(wcImpl.name).toBe('SimpleButton');
    expect(wcImpl.tagName).toBe('a2ui-react-simplebutton');
    expect(SimpleButton).toMatchObject({
      tagName: 'a2ui-react-simplebutton',
      element: wcImpl.element,
    });
  });

  it('uses the tag name an implementation brings', () => {
    const TagComp: ReactComponentImplementation & {tagName: string} = {
      name: 'ImplTagComp',
      schema: z.object({}),
      render: () => <div>Impl Tag</div>,
      tagName: 'custom-impl-react-tag',
    };

    const wcImpl = toWebComponent(TagComp);

    expect(wcImpl.tagName).toBe('custom-impl-react-tag');
  });

  it('returns the cached result for the same render function', () => {
    const CachedComp = createComponentImplementation(
      {name: 'CachedComp', schema: z.object({})},
      () => <div>Cached</div>,
    );

    expect(toWebComponent(CachedComp)).toBe(toWebComponent(CachedComp));
    expect(toWebComponent(CachedComp).tagName).toBe('a2ui-react-cachedcomp');
  });

  it('gives a hand-written implementation a host element, and a factory entry its own', () => {
    const handWritten: ReactComponentImplementation = {
      name: 'HandWrittenHost',
      schema: z.object({}),
      render: () => null,
    };
    const factoryMade = createComponentImplementation(
      {name: 'FactoryHost', schema: z.object({})},
      () => null,
    );

    expect(hostElementFor(handWritten).tagName).toBe('a2ui-react-handwrittenhost');
    expect(hostElementFor(handWritten)).toBe(hostElementFor(handWritten));
    expect(factoryMade).toMatchObject({
      tagName: 'a2ui-react-factoryhost',
      element: hostElementFor(factoryMade).element,
    });
  });

  it('suffixes the tag names of implementations that share a name', () => {
    const api = {name: 'MultiCollision', schema: z.object({})};
    const first = createComponentImplementation(api, () => <div>1</div>);
    const second = createComponentImplementation(api, () => <div>2</div>);
    const third = createComponentImplementation(api, () => <div>3</div>);

    expect(first).toMatchObject({tagName: 'a2ui-react-multicollision'});
    expect(second).toMatchObject({tagName: 'a2ui-react-multicollision-2'});
    expect(third).toMatchObject({tagName: 'a2ui-react-multicollision-3'});
  });

  it('does not define the host element until A2uiSurface renders', () => {
    const Late = createComponentImplementation({name: 'LateDefined', schema: z.object({})}, () => (
      <span data-testid="late">late</span>
    ));
    const lateCatalog = new Catalog<ReactComponentImplementation>('late-test', '0.9', [Late]);
    const surface = new SurfaceModel<ReactComponentImplementation>('surf-late', lateCatalog);
    surface.componentsModel.addComponent(
      new ComponentModel('root', 'LateDefined', {}, lateCatalog),
    );

    expect(customElements.get('a2ui-react-latedefined')).toBeUndefined();

    const view = render(<A2uiSurface surface={surface} />);

    expect(customElements.get('a2ui-react-latedefined')).toBe(hostElementFor(Late).element);
    expect(within(view.container).getByTestId('late')).toHaveTextContent('late');
  });

  it('creates implementations without touching customElements', () => {
    vi.stubGlobal('customElements', undefined);

    const bound = createComponentImplementation(
      {name: 'NoRegistry', schema: z.object({})},
      () => null,
    );
    const binderless = createBinderlessComponentImplementation(
      {name: 'NoRegistryBinderless', schema: z.object({})},
      () => null,
    );

    expect(bound).toMatchObject({tagName: 'a2ui-react-noregistry'});
    expect(binderless).toMatchObject({tagName: 'a2ui-react-noregistrybinderless'});
  });
});

describe('React host element', () => {
  beforeAll(() => {
    for (const implementation of catalog.components.values()) {
      registerUniversalElement(hostElementFor(implementation));
    }
  });

  it('uses display: contents once connected', () => {
    const host = document.createElement(hostElementFor(Label).tagName);
    appendContainer().appendChild(host);

    expect(host.style.display).toBe('contents');
  });

  it('holds only the context React hands it', () => {
    const surface = createSurface('surf-props');
    const {hostOf} = renderSurface(surface);

    const host = hostOf('a');

    expect(host.localName).toBe('a2ui-react-hostlabel');
    expect(host.context?.componentModel.id).toBe('a');
    expect(host.context?.dataContext.path).toBe('/');
    expect('node' in host).toBe(false);
  });

  it('registers with its surface once connected with a context, and unregisters after disconnect', async () => {
    const surface = createSurface('surf-register');
    const registry = HostRegistry.forSurface(surface);
    const host = document.createElement(hostElementFor(Label).tagName) as ReactHostElement;
    const container = appendContainer();

    container.appendChild(host);
    expect(registry.has(host)).toBe(false);

    host.context = new ComponentContext(surface, 'a', '/');
    expect(registry.has(host)).toBe(true);

    host.remove();
    // Unregistration waits a microtask, in case the host is only being moved.
    expect(registry.has(host)).toBe(true);
    await flushMicrotasks();
    expect(registry.has(host)).toBe(false);
  });

  it('does not register while detached', () => {
    const surface = createSurface('surf-detached');
    const host = document.createElement(hostElementFor(Label).tagName) as ReactHostElement;
    host.context = new ComponentContext(surface, 'a', '/');

    expect(HostRegistry.forSurface(surface).has(host)).toBe(false);
  });

  it('moves to the registry of the surface its new context belongs to', () => {
    const first = createSurface('surf-first');
    const second = createSurface('surf-second');
    const host = document.createElement(hostElementFor(Label).tagName) as ReactHostElement;
    appendContainer().appendChild(host);
    host.context = new ComponentContext(first, 'a', '/');

    host.context = new ComponentContext(second, 'a', '/');

    expect(HostRegistry.forSurface(first).has(host)).toBe(false);
    expect(HostRegistry.forSurface(second).has(host)).toBe(true);
  });

  it('receives its content from the A2uiSurface of its surface', () => {
    const surface = createSurface('surf-portal');
    renderSurface(surface);
    const host = createHost(hostElementFor(Label).tagName, surface, 'a');

    act(() => {
      appendContainer().appendChild(host);
    });

    expect(within(host).getByTestId('label')).toHaveTextContent('A');
  });

  it('re-renders its content when it is handed another context', () => {
    const surface = createSurface('surf-node');
    renderSurface(surface);
    const host = createHost(hostElementFor(Label).tagName, surface, 'a');
    act(() => {
      appendContainer().appendChild(host);
    });
    expect(within(host).getByTestId('label')).toHaveTextContent('A');

    act(() => {
      host.context = new ComponentContext(surface, 'b', '/');
    });

    expect(within(host).getByTestId('label')).toHaveTextContent('B');
  });

  it('keeps React state when moved to another parent', async () => {
    const surface = createSurface('surf-move');
    renderSurface(surface);
    const from = appendContainer();
    const to = appendContainer();
    const host = createHost(hostElementFor(Counter).tagName, surface, 'counter');
    act(() => {
      from.appendChild(host);
    });

    fireEvent.click(within(host).getByTestId('counter'));
    expect(within(host).getByTestId('counter')).toHaveTextContent('count:1');

    to.appendChild(host);
    await flushMicrotasks();

    expect(HostRegistry.forSurface(surface).has(host)).toBe(true);
    expect(within(to).getByTestId('counter')).toHaveTextContent('count:1');
    expect(from.childElementCount).toBe(0);
  });
});
