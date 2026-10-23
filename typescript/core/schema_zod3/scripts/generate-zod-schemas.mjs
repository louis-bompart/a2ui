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

import {join, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

/**
 * @fileoverview Runs the Zod schema generator of each protocol version,
 * `scripts/generate-<version>-schemas.mjs`.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

for (const version of ['v0_9', 'v1_0']) {
  const mod = await import(pathToFileURL(join(__dirname, `generate-${version}-schemas.mjs`)).href);
  await mod.generateSchemas();
}

console.log('Successfully finished generating Zod schemas for all versions.');
