/*
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {isAtLeastVersion, normalizeVersionString, toCanonicalVersion} from '../common/semver.js';
import {V08_STANDARD_DEFS} from '../v0_8/standard_defs.js';
import {V09_STANDARD_DEFS} from '../v0_9/standard_defs.js';
import {V10_STANDARD_DEFS} from '../v1_0/standard_defs.js';

/** The reference a common types document is written as when a catalog names none. */
export const DEFAULT_COMMON_TYPES_URI = 'common_types.json';

const STANDARD_DEFS_BY_VERSION: Readonly<Record<string, Record<string, unknown>>> = {
  '0.8': V08_STANDARD_DEFS,
  '0.9': V09_STANDARD_DEFS,
  '0.9.1': V09_STANDARD_DEFS,
  '1.0': V10_STANDARD_DEFS,
};

/**
 * Returns the common types definitions of a protocol version. A version with
 * no entry of its own at or above 1.0 gets the v1.0 definitions, and any other
 * version the v0.9 definitions.
 *
 * @param version A protocol version.
 */
export function standardDefsForVersion(version: string | undefined): Record<string, unknown> {
  if (version) {
    const key = toCanonicalVersion(version) ?? normalizeVersionString(version);
    if (key in STANDARD_DEFS_BY_VERSION) return STANDARD_DEFS_BY_VERSION[key];
    if (isAtLeastVersion(version, '1.0')) return V10_STANDARD_DEFS;
  }
  return V09_STANDARD_DEFS;
}
