# @a2ui/schema-zod3

The Zod 3 schema library of A2UI. [`@a2ui/web_core`](../web_core/README.md) depends on no schema library; this package provides what it needs from Zod 3:

- the Zod 3 schemas of the protocol messages and common types, for each protocol version (`@a2ui/schema-zod3/v0_8`, `/v0_9`, `/v1_0`), and the superset common types (`@a2ui/schema-zod3`);
- the catalog schema compiler that turns the definitions of a catalog loaded with `Catalog.fromJson` into Zod 3 schemas (`zod3CatalogSchemaCompiler`);
- the conversion of Zod 3 schemas, which implement no Standard JSON Schema, to the JSON Schema view web_core reads (`zod3ToJsonSchema`);
- the `spec()`, `specDef()` and `exclusiveUnion()` annotations, which record what a catalog document writes about a Zod 3 schema beyond the schema itself.

## Usage

Importing the package, or any of its entry points, installs the Zod 3 library into web_core with `installSchemaLibrary`. From then on, web_core validates protocol messages with its schemas and compiles the catalogs loaded from JSON, including the basic catalogs, into Zod 3 schemas.

```ts
import '@a2ui/schema-zod3';
import {MessageProcessor} from '@a2ui/web_core/v0_9';
import {basicCatalog} from '@a2ui/web_core/v0_9/basic_catalog';

const processor = new MessageProcessor([basicCatalog]);
```

The Angular, Lit and React renderers import it, so an application using one of them needs nothing more.

To define a component with Zod 3, use the schemas of the common types, which carry the `$ref`s web_core binds them by:

```ts
import {ChildListSchema, DynamicStringSchema} from '@a2ui/schema-zod3/v0_9';
import type {ComponentApi} from '@a2ui/web_core/v0_9';
import {z} from 'zod';

export const CustomGridApi = {
  name: 'CustomGrid',
  schema: z.object({title: DynamicStringSchema, children: ChildListSchema}).strict(),
} satisfies ComponentApi;
```

A component may as well be defined with any other [Standard Schema](https://standardschema.dev) library that implements [Standard JSON Schema](https://standardschema.dev/json-schema), such as Zod 4.2+, without this package.

## Specification annotations

`spec(schema, annotation)` returns a copy of a Zod schema that records what a catalog document writes about it beyond the schema itself, without changing validation: `mixins` (the common types, such as `'ComponentCommon'`, and the `specDef()` models a component's definition composes with `allOf`), `closure` (`additionalProperties` or `unevaluatedProperties`), `required` (the order of the `required` list), `allOf` (schemas that follow the schema's own, such as a format rule) and `keywords` (such as `format`). `specDef(name, schema)` names a model that the document declares under `$defs`. The descriptions come from `.describe()`, and common types references from `REF:#/$defs/<Name>` description markers.

```ts
import {spec, specDef} from '@a2ui/schema-zod3';
import {Catalog} from '@a2ui/web_core/catalog';
import {z} from 'zod';

const Common = specDef('Common', z.object({weight: z.number().optional()}));
const Badge = {
  name: 'Badge',
  schema: spec(
    z
      .object({...Common.shape, label: z.string()})
      .describe('A badge.')
      .strict(),
    {mixins: ['ComponentCommon', Common]},
  ),
};
// Badge's definition composes ComponentCommon and #/$defs/Common with allOf,
// and $defs.Common is computed from the Common model.
const document = new Catalog('https://example.com/badges', '0.9', [Badge]).toJson();
```

## Development

The Zod 3 schemas of the protocol are generated from the specification's JSON schemas:

```bash
yarn generate-zod-schemas
```

```bash
yarn build
yarn test
```
