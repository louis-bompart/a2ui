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

// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated from the published catalog document via scripts/generate-catalog-types.mjs

import {loadedFunctionApi, type LoadedFunctionApi} from '../../../../catalog/json_entries.js';
import type {
  DataBinding,
  DynamicBoolean,
  DynamicNumber,
  DynamicString,
  DynamicValue,
  FunctionCall,
} from '../../../../v1_0/schema/common-types.js';
import {LOADED_BASIC_CATALOG} from '../basic_catalog_document.js';

/** The arguments of the `required` function. */
export type RequiredArgs = {
  /**
   * The value to check.
   */
  value: any;
};

/**
 * Checks that the value is not null, undefined, or empty.
 */
export const RequiredApi: LoadedFunctionApi<'required', 'validationResult', RequiredArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'required');

/** The arguments of the `regex` function. */
export type RegexArgs = {
  value: DynamicString;
  /**
   * The regex pattern to match against.
   */
  pattern: string;
};

/**
 * Checks that the value matches a regular expression string.
 */
export const RegexApi: LoadedFunctionApi<'regex', 'validationResult', RegexArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'regex');

/** The arguments of the `length` function. */
export type LengthArgs = Record<string, any>;

/**
 * Checks string length constraints.
 */
export const LengthApi: LoadedFunctionApi<'length', 'validationResult', LengthArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'length');

/** The arguments of the `numeric` function. */
export type NumericArgs = Record<string, any>;

/**
 * Checks numeric range constraints.
 */
export const NumericApi: LoadedFunctionApi<'numeric', 'validationResult', NumericArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'numeric');

/** The arguments of the `email` function. */
export type EmailArgs = {
  value: DynamicString;
};

/**
 * Checks that the value is a valid email address.
 */
export const EmailApi: LoadedFunctionApi<'email', 'validationResult', EmailArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'email');

/** The arguments of the `formatString` function. */
export type FormatStringArgs = {
  value: DynamicString;
};

/**
 * Performs string interpolation of data model values and other functions in the catalog functions list and returns the resulting string. The value string can contain interpolated expressions in the `${expression}` format. Supported expression types include: JSON Pointer paths to the data model (e.g., `${/absolute/path}` or `${relative/path}`), and renderer-side function calls (e.g., `${now()}`). Function arguments must be named (e.g., `${formatDate(value:${/currentDate}, format:'MM-dd')}`). To include a literal `${` sequence, escape it as `\${`.
 */
export const FormatStringApi: LoadedFunctionApi<'formatString', 'string', FormatStringArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'formatString');

/** The arguments of the `formatNumber` function. */
export type FormatNumberArgs = {
  /**
   * The number to format.
   */
  value: DynamicNumber;
  /**
   * Optional. The number of decimal places to show. Defaults to 0 or 2 depending on locale.
   */
  decimals?: DynamicNumber;
  /**
   * Optional. If true, uses locale-specific grouping separators (e.g. '1,000'). If false, returns raw digits (e.g. '1000'). Defaults to true.
   */
  grouping?: DynamicBoolean;
};

/**
 * Formats a number with the specified grouping and decimal precision.
 */
export const FormatNumberApi: LoadedFunctionApi<'formatNumber', 'string', FormatNumberArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'formatNumber');

/** The arguments of the `formatCurrency` function. */
export type FormatCurrencyArgs = {
  /**
   * The monetary amount.
   */
  value: DynamicNumber;
  /**
   * The ISO 4217 currency code (e.g., 'USD', 'EUR').
   */
  currency: DynamicString;
  /**
   * Optional. The number of decimal places to show. Defaults to 0 or 2 depending on locale.
   */
  decimals?: DynamicNumber;
  /**
   * Optional. If true, uses locale-specific grouping separators (e.g. '1,000'). If false, returns raw digits (e.g. '1000'). Defaults to true.
   */
  grouping?: DynamicBoolean;
};

/**
 * Formats a number as a currency string.
 */
export const FormatCurrencyApi: LoadedFunctionApi<'formatCurrency', 'string', FormatCurrencyArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'formatCurrency');

/** The arguments of the `formatDate` function. */
export type FormatDateArgs = {
  /**
   * The date to format.
   */
  value: DynamicValue;
  /**
   * A Unicode TR35 date pattern string.
   *
   * Token Reference:
   * - Year: 'yy' (26), 'yyyy' (2026)
   * - Month: 'M' (1), 'MM' (01), 'MMM' (Jan), 'MMMM' (January)
   * - Day: 'd' (1), 'dd' (01), 'E' (Tue), 'EEEE' (Tuesday)
   * - Hour (12h): 'h' (1-12), 'hh' (01-12) - requires 'a' for AM/PM
   * - Hour (24h): 'H' (0-23), 'HH' (00-23) - Military Time
   * - Minute: 'mm' (00-59)
   * - Second: 'ss' (00-59)
   * - Period: 'a' (AM/PM)
   *
   * Examples:
   * - 'MMM dd, yyyy' -> 'Jan 16, 2026'
   * - 'HH:mm' -> '14:30' (Military)
   * - 'h:mm a' -> '2:30 PM'
   * - 'EEEE, d MMMM' -> 'Friday, 16 January'
   */
  format: DynamicString;
};

/**
 * Formats a timestamp into a string using a pattern.
 */
export const FormatDateApi: LoadedFunctionApi<'formatDate', 'string', FormatDateArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'formatDate');

/** The arguments of the `pluralize` function. */
export type PluralizeArgs = {
  /**
   * The numeric value used to determine the plural category.
   */
  value: DynamicNumber;
  /**
   * String for the 'zero' category (e.g., 0 items).
   */
  zero?: DynamicString;
  /**
   * String for the 'one' category (e.g., 1 item).
   */
  one?: DynamicString;
  /**
   * String for the 'two' category (used in Arabic, Welsh, etc.).
   */
  two?: DynamicString;
  /**
   * String for the 'few' category (e.g., small groups in Slavic languages).
   */
  few?: DynamicString;
  /**
   * String for the 'many' category (e.g., large groups in various languages).
   */
  many?: DynamicString;
  /**
   * The default/fallback string (used for general plural cases).
   */
  other: DynamicString;
};

/**
 * Returns a localized string based on the Common Locale Data Repository (CLDR) plural category of the count (zero, one, two, few, many, other). Requires an 'other' fallback. For English, just use 'one' and 'other'.
 */
export const PluralizeApi: LoadedFunctionApi<'pluralize', 'string', PluralizeArgs> =
  loadedFunctionApi(LOADED_BASIC_CATALOG, 'pluralize');

/** The arguments of the `openUrl` function. */
export type OpenUrlArgs = {
  /**
   * The URL to open.
   */
  url: string | DataBinding | FunctionCall;
};

/**
 * Opens the specified URL in a browser or handler (requires user activation). This function has no return value.
 */
export const OpenUrlApi: LoadedFunctionApi<'openUrl', 'void', OpenUrlArgs> = loadedFunctionApi(
  LOADED_BASIC_CATALOG,
  'openUrl',
);

/** The arguments of the `and` function. */
export type AndArgs = {
  /**
   * The list of boolean values to evaluate.
   */
  values: DynamicBoolean[];
};

/**
 * Performs a logical AND operation on a list of boolean values.
 */
export const AndApi: LoadedFunctionApi<'and', 'boolean', AndArgs> = loadedFunctionApi(
  LOADED_BASIC_CATALOG,
  'and',
);

/** The arguments of the `or` function. */
export type OrArgs = {
  /**
   * The list of boolean values to evaluate.
   */
  values: DynamicBoolean[];
};

/**
 * Performs a logical OR operation on a list of boolean values.
 */
export const OrApi: LoadedFunctionApi<'or', 'boolean', OrArgs> = loadedFunctionApi(
  LOADED_BASIC_CATALOG,
  'or',
);

/** The arguments of the `not` function. */
export type NotArgs = {
  /**
   * The boolean value to negate.
   */
  value: DynamicBoolean;
};

/**
 * Performs a logical NOT operation on a boolean value.
 */
export const NotApi: LoadedFunctionApi<'not', 'boolean', NotArgs> = loadedFunctionApi(
  LOADED_BASIC_CATALOG,
  'not',
);

/** The functions of the catalog, in the order of its document. */
export const BASIC_FUNCTION_APIS = [
  RequiredApi,
  RegexApi,
  LengthApi,
  NumericApi,
  EmailApi,
  FormatStringApi,
  FormatNumberApi,
  FormatCurrencyApi,
  FormatDateApi,
  PluralizeApi,
  OpenUrlApi,
  AndApi,
  OrApi,
  NotApi,
];

export const V10_SPEC_FUNCTION_APIS = BASIC_FUNCTION_APIS;
