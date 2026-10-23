## Unreleased

- Initial release ([#2160](https://github.com/a2ui-project/a2ui/issues/2160)). The Zod 3 schemas of the protocol, the Zod 3 catalog schema compiler, the conversion of Zod 3 schemas to JSON Schema and the `spec()`, `specDef()` and `exclusiveUnion()` annotations move here from `@a2ui/web_core`. `@a2ui/schema-zod3/install` installs the Zod 3 schema library into web_core; the other entry points install nothing, so a catalog can compile its document with `zod3CatalogSchemaCompiler` alone, whose schemas implement Standard JSON Schema.
