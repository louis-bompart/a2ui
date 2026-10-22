/*
 * Copyright 2024 Google LLC
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

/**
 * The fields of a Zod issue that `formatZodIssue` reads. Declared here, so
 * that formatting the issues of a Zod schema needs no Zod.
 */
export interface ZodIssueLike {
  readonly code: string;
  readonly path: ReadonlyArray<PropertyKey>;
  readonly message?: string;
  /** For `invalid_union`: the errors of each branch. */
  readonly unionErrors?: ReadonlyArray<{readonly issues: ReadonlyArray<ZodIssueLike>}>;
  /** For `unrecognized_keys`. */
  readonly keys?: ReadonlyArray<string>;
  /** For `invalid_enum_value`. */
  readonly options?: ReadonlyArray<unknown>;
  /** For `invalid_type` and `invalid_enum_value`. */
  readonly received?: unknown;
  /** For `invalid_type`. */
  readonly expected?: unknown;
}

/**
 * Formats a single Zod issue into a human-readable diagnostic message.
 *
 * Direct attribute extraction is used so that issue details (such as unrecognized
 * property keys or invalid enum options) are preserved even when running in
 * optimized/minified production builds where Zod's internal error map messages
 * may be obfuscated or stripped.
 *
 * @param err Zod validation issue to format.
 * @return Human-readable formatted error message.
 */
export function formatZodIssue(err: ZodIssueLike): string {
  const path = err.path.join('.') || 'root';

  switch (err.code) {
    case 'invalid_union': {
      const unionIssues = err.unionErrors?.flatMap(uErr => uErr.issues);
      if (unionIssues && unionIssues.length > 0) {
        return unionIssues.map(formatZodIssue).join('; ');
      }
      return `${path}: Invalid union`;
    }

    case 'unrecognized_keys': {
      const keysStr = (err.keys ?? []).map(k => `'${k}'`).join(', ');
      return `${path}: Unrecognized key(s) in object: ${keysStr}`;
    }

    case 'invalid_enum_value': {
      const optionsStr = (err.options ?? []).map(o => String(o)).join(' | ');
      return `${path}: Invalid enum value. Expected ${optionsStr}, received '${String(err.received)}'`;
    }

    case 'invalid_type':
      return `${path}: Expected ${String(err.expected)}, received ${String(err.received)}`;

    case 'custom':
      return `${path}: ${err.message}`;

    default:
      return err.message ? `${path}: ${err.message}` : `${path}: Validation error (${err.code})`;
  }
}
