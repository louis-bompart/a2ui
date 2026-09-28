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

import {describe, it, expect, afterEach} from 'vitest';
import {z} from 'zod';
import {
  Catalog,
  ChildListSchema,
  CommonSchemas,
  ComponentIdSchema,
  ComponentModel,
  NodeResolver,
  SurfaceModel,
  computed,
  effect,
  getValue,
  type ComponentApi,
} from '@a2ui/web_core/v0_9';
import {createNodeIndex, nodeKey} from '../../src/v0_9/node_index';

const TextApi = {name: 'Text', schema: z.object({text: CommonSchemas.DynamicString.optional()})};
const CardApi = {name: 'Card', schema: z.object({child: ComponentIdSchema.optional()})};
const ColumnApi = {name: 'Column', schema: z.object({children: ChildListSchema.optional()})};

const resolvers: NodeResolver[] = [];

afterEach(() => {
  for (const resolver of resolvers.splice(0)) resolver.dispose();
});

/** A surface over a catalog of plain component APIs, with its resolver and index. */
function setup() {
  const catalog = new Catalog<ComponentApi>('node-index-test', '0.9', [
    TextApi,
    CardApi,
    ColumnApi,
  ]);
  const surface = new SurfaceModel<ComponentApi>('node-index-surface', catalog);
  const resolver = new NodeResolver(surface, catalog);
  resolvers.push(resolver);
  const index = createNodeIndex(resolver);
  const add = (id: string, type: string, props: Record<string, unknown>) =>
    surface.componentsModel.addComponent(new ComponentModel(id, type, props));
  return {surface, index, add};
}

describe('createNodeIndex', () => {
  it('indexes the root and its children by component id and data path', () => {
    const {index, add} = setup();
    add('root', 'Column', {children: ['title', 'card']});
    add('title', 'Text', {text: 'Title'});
    add('card', 'Card', {child: 'body'});
    add('body', 'Text', {text: 'Body'});

    expect([...getValue(index).keys()]).toEqual([
      nodeKey('root', '/'),
      nodeKey('title', '/'),
      nodeKey('card', '/'),
      nodeKey('body', '/'),
    ]);
    expect(getValue(index).get(nodeKey('body', '/'))?.type).toBe('Text');
  });

  it('indexes template children at their scoped data paths', () => {
    const {surface, index, add} = setup();
    surface.dataModel.set('/items', [{name: 'A'}, {name: 'B'}]);
    add('root', 'Column', {children: {componentId: 'item', path: '/items'}});
    add('item', 'Text', {text: {path: 'name'}});

    expect(getValue(index).get(nodeKey('item', '/items/0'))?.dataPath).toBe('/items/0');
    expect(getValue(index).get(nodeKey('item', '/items/1'))?.dataPath).toBe('/items/1');
    expect(getValue(index).has(nodeKey('item', '/'))).toBe(false);
  });

  it('keeps the first node when a component is referenced twice at the same data path', () => {
    const {index, add} = setup();
    add('root', 'Column', {children: ['kid', 'kid']});
    add('kid', 'Text', {text: 'Twice'});

    expect(getValue(index).get(nodeKey('kid', '/'))?.instanceId).toBe('kid');
  });

  it('skips placeholders and adds the node once the component arrives', () => {
    const {index, add} = setup();
    add('root', 'Card', {child: 'late'});
    expect(getValue(index).has(nodeKey('late', '/'))).toBe(false);

    add('late', 'Text', {text: 'Arrived'});

    expect(getValue(index).get(nodeKey('late', '/'))?.isPlaceholder).toBe(false);
  });

  it('adds a template child when the data grows', () => {
    const {surface, index, add} = setup();
    surface.dataModel.set('/items', [{name: 'A'}]);
    add('root', 'Column', {children: {componentId: 'item', path: '/items'}});
    add('item', 'Text', {text: {path: 'name'}});
    expect(getValue(index).has(nodeKey('item', '/items/1'))).toBe(false);

    surface.dataModel.set('/items', [{name: 'A'}, {name: 'B'}]);

    expect(getValue(index).has(nodeKey('item', '/items/1'))).toBe(true);
  });

  it('removes the entry of a deleted component', () => {
    const {surface, index, add} = setup();
    add('root', 'Card', {child: 'kid'});
    add('kid', 'Text', {text: 'Kid'});
    expect(getValue(index).has(nodeKey('kid', '/'))).toBe(true);

    surface.componentsModel.removeComponent('kid');

    expect(getValue(index).has(nodeKey('kid', '/'))).toBe(false);
  });

  it('rebuilds once per change, however many lookups read it', () => {
    const {surface, index, add} = setup();
    surface.dataModel.set('/items', [{name: 'A'}, {name: 'B'}, {name: 'C'}]);
    add('root', 'Column', {children: {componentId: 'item', path: '/items'}});
    add('item', 'Text', {text: {path: 'name'}});
    const seen = new Set<unknown>();
    let builds = 0;
    const stops = [
      effect(() => {
        getValue(index);
        builds++;
      }),
      ...['/items/0', '/items/1', '/items/2'].map(path => {
        const lookup = computed(() => {
          const map = getValue(index);
          seen.add(map);
          return map.get(nodeKey('item', path));
        });
        return effect(() => {
          getValue(lookup);
        });
      }),
    ];
    seen.clear();
    builds = 0;

    surface.dataModel.set('/items/1/name', 'B2');

    expect(builds).toBe(1);
    expect(seen.size).toBe(1);
    for (const stop of stops) stop();
  });
});
