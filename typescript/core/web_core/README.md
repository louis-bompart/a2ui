# @a2ui/web_core

The `@a2ui/web_core` package provides state management, protocol parsing, and schema generation for the A2UI framework. It is framework-agnostic and provides the foundational engine for renderer packages such as Angular, React, and Lit.

## Features

- **Protocol Handling**: Implements A2UI specification message validation and state handling across all supported protocol versions.
- **State Management**: Reactive data and component models using `@preact/signals-core`.
- **DataContext**: Data binding, scoping, and function evaluation with dependency tracking.
- **Catalog System**: Component and function catalogs supporting runtime validation and schema generation.
- **Schema-Driven Code Generation**: Generates the TypeScript types of the protocol and of the basic catalogs directly from the specification's JSON schemas.
- **Schema-Library Agnostic**: Catalog entries are typed as any [Standard Schema](https://standardschema.dev). web_core depends on no schema library: the schemas that validate protocol messages and the compiler that turns the catalogs loaded from JSON into schemas come from an installed schema library, such as [`@a2ui/schema-zod3`](../schema_zod3/README.md).

## Architecture

Rendering is driven by a `SurfaceGroupModel` and its constituent `SurfaceModel` instances, with `DataModel` managing reactive state, `DataContext` providing expression evaluation, and `MessageProcessor` validating and applying incoming protocol messages.

## Schema & Code Generation

Protocol message schemas, common types, and catalog definitions are generated directly from the JSON schemas in the `specification/` directory.

### Running Code Generation

To regenerate the protocol types and catalog APIs:

```bash
# Generate the protocol types and versioned Basic Catalog APIs
yarn generate-schemas

# Or run individual version generators directly
node src/v0_9/scripts/generate-catalog.mjs
node src/v1_0/scripts/generate-catalog.mjs
```

### Catalog Schema Contract

The code generator uses **Schema Flattening** to remain version-, catalog-, and type-agnostic. Schema files adhere to the following structure:

#### 1. Catalog JSON (`catalog.json`)

- **Top-Level Dictionaries**:
  - `components`: Maps component names to JSON schema objects.
  - `functions`: Maps function names to JSON schema objects.
- **Discriminator**:
  - Derived from `catalog.discriminator.propertyName` (defaults to `"component"`).
  - The discriminator property and `"id"` are omitted from generated property schemas as they are handled by the runtime component envelope.
- **Inheritance & Envelopes**:
  - Components may use `allOf` to reference common envelopes (such as `ComponentCommon` or `CatalogComponentCommon`). The generator recursively resolves `$ref` pointers and merges `allOf` branches into a flat property bag.
- **Functions**:
  - Functions specify a `returnType` (e.g. `"string"`, `"number"`, `"boolean"`, `"validationResult"`) at the root level and define arguments inside an `args` or `parameters` object property.

#### 2. Reusable Type Definitions (`common_types.json`)

- **`$defs` Scope**:
  - Reusable type schemas reside under `$defs`. Definition names are not hardcoded; any definition present in `$defs` is resolved dynamically when referenced.
- **Reference Annotations**:
  - When a component property references `$defs/<DefName>`, the generator maps it to `<DefName>Schema` and attaches a `.describe('REF:#/$defs/<DefName>|<description>')` annotation.
  - At runtime, `generateValidationSchema` inspects these markers to emit `$ref` pointers and tree-shake unused `$defs` definitions.
- **Child References**:
  - Single child references and child collections are identified when their `$defs` reference targets or descriptions indicate a child component relationship (such as references to `ComponentId`, `Child`, or `ChildList`).

## Catalog Serialization

A `Catalog` has three serialization entry points:

- `Catalog.fromJson(json, protocolVersion?, catalogId?)` loads a catalog document into the catalog's model. Each entry is a `JsonComponentApi` or `JsonFunctionApi` whose model is its JSON Schema definition as written (`jsonSchema`); its `schema` is compiled from the definition on first use, by the default catalog schema compiler (see [Schema libraries](#schema-libraries)). The catalog keeps the document-level fields (metadata, named `$defs`, other top-level keys). `protocolVersion`, when given, takes precedence over the version the document declares and selects the loading rules, while `toJson` still writes the document's own `protocolVersion`; without it the document's version applies, then `DEFAULT_PROTOCOL_VERSION`. `catalogId` replaces the document's own ID.
- `catalog.toJson()` assembles the unbundled catalog document from the model, computing the `anyComponent` and `anyFunction` unions. A catalog loaded with `fromJson` returns its document unchanged (minus any entries omitted from the document's `anyComponent.oneOf` or `anyFunction.oneOf` unions, which `fromJson` filters out on load). An entry defined in code whose Zod 3 schema is annotated with `spec()` (from `@a2ui/schema-zod3`) has its definition computed from the model in the layout of the catalog's protocol version; any other entry defined in code is generated from the JSON Schema view of its schema. The result is computed once per catalog; each call returns a fresh copy.
- `catalog.validationSchema` is the self-contained schema used to validate payloads: common types and the catalog's own `$defs` are bundled into `$defs` and every `$ref` is local. It is computed once per catalog; each read returns a fresh copy.

```ts
import {Catalog} from '@a2ui/web_core';

const catalog = Catalog.fromJson(document);
const unchanged = catalog.toJson(); // deep-equals document
const schema = catalog.validationSchema; // bundled JSON Schema
```

The `Catalog` constructor takes a `CatalogOptions` object as its fifth argument, with the `themeSchema`, the document-level fields (`instructions`, `schemaUri`, `schemaId`, `title`, `description`, `declaredProtocolVersion`, `declaresCatalogId`, `declaresComponents`, `functionsLayout`, `unions`, `defs`, `extensionFields`) that `toJson` emits, and, for a catalog defined in code, `commonTypesUri`, `themeLocation` and `defModels`. `catalog.withEntries(components, functions)` returns a catalog with the same fields and other entries, as catalog transformers need.

### Specification annotations

A Zod 3 schema can be annotated with `spec()` and `specDef()` from `@a2ui/schema-zod3` to record what a catalog document writes about it beyond the schema itself, such as the mixins a component's definition composes with `allOf`. See the [`@a2ui/schema-zod3` README](../schema_zod3/README.md#specification-annotations).

The built-in basic catalogs are loaded from their published catalog documents instead. `scripts/generate-catalog-types.mjs`, run by `src/<version>/scripts/generate-catalog.mjs` as part of `yarn generate-schemas`, writes each document as a TypeScript constant (`basic_catalog_document.ts`), loads it with `Catalog.fromJson`, and writes a `<Name>Props` (or `<Name>Args`) interface derived from each entry's JSON Schema definition, with a typed `<Name>Api` that is the loaded entry. Each entry compiles its schema on first use, with the default catalog schema compiler, and `toJson` of each basic catalog writes its published document.

## Schema libraries

web_core reads every schema through [Standard Schema](https://standardschema.dev) (`~standard.validate`) and, to bind, serialize and inspect catalog entries, through its JSON Schema view: a schema implementing [Standard JSON Schema](https://standardschema.dev/json-schema), such as a Zod 4.2+ schema, is converted with its own converter. What needs a schema library of its own is provided by an installed `SchemaLibrary`:

- the schemas that validate the messages of each protocol version (`ProtocolSchemas`), and those of a component's `accessibility` and `metadata` envelope properties;
- the `CatalogSchemaCompiler` that `Catalog.fromJson`, and so the basic catalogs, use by default;
- the conversion to JSON Schema of the library's schemas that implement no Standard JSON Schema, such as Zod 3 schemas.

Each owner can also pass its part explicitly instead: a catalog its compiler, with `Catalog.fromJson(json, version, id, {schemaCompiler})`, and an application the protocol and envelope schemas, with the `protocolSchemas` and `envelopeSchemas` options of `MessageProcessor`. The installed libraries only fill in what is not passed.

`import '@a2ui/schema-zod3/install'` installs the Zod 3 library, and the Angular, Lit and React renderers import it. Without an installed library or explicit schemas, messages are not validated against the protocol schemas, and compiling the schema of an entry loaded with `Catalog.fromJson` throws unless a compiler is given (`Catalog.fromJson(json, version, id, {schemaCompiler})` or `setDefaultCatalogSchemaCompiler`).

```ts
import '@a2ui/schema-zod3/install';
import {MessageProcessor} from '@a2ui/web_core/v0_9';
import {basicCatalog} from '@a2ui/web_core/v0_9/basic_catalog';

const processor = new MessageProcessor([basicCatalog]);
```

A library is written against `@a2ui/web_core/schema-library`, which exports `installSchemaLibrary`, the `SchemaLibrary` and `CatalogSchemaCompiler` interfaces, and the helpers a compiler uses to read catalog documents.

## Development

### Building

The package uses `wireit` for build orchestration:

```bash
yarn build
```

### Testing

Run unit tests:

```bash
yarn test
```

Run conformance test suite:

```bash
node tests/conformance/conformance_test.mjs
```

Run the timing cases of `conformance/core/message_processor_scaling.yaml`, which check that processing a surface sent in many small messages takes time in proportion to its size. Times depend on the machine and its load, so `yarn test` leaves these cases out:

```bash
yarn test:timing
```

### Formatting & Linting

```bash
yarn format
yarn lint
```
