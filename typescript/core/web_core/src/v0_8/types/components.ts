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

import type {StringValue} from './primitives.js';

/** The children of a container: an explicit list of IDs or a template. */
interface ComponentArrayReferenceShape {
  explicitList?: string[];
  template?: {componentId: string; dataBinding: string};
}

/** Represents a user-initiated action. */
export type Action = {
  /** A unique name identifying the action (e.g., 'submitForm'). */
  name: string;
  /** A key-value map of data bindings to be resolved when the action is triggered. */
  context?: {
    key: string;
    /** The dynamic value. Define EXACTLY ONE of the nested properties. */
    value: {
      path?: string;
      literalString?: string;
      literalNumber?: number;
      literalBoolean?: boolean;
    };
  }[];
};

export type Text = {
  text: StringValue;
  usageHint?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body';
};

export type Image = {
  url: StringValue;
  usageHint?: 'icon' | 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature' | 'header';
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  altText?: StringValue;
};

export type Icon = {
  name: StringValue;
};

export type Video = {
  url: StringValue;
};

export type AudioPlayer = {
  url: StringValue;
  /** A label, title, or placeholder text. */
  description?: StringValue;
};

export type Tabs = {
  /** A list of tabs, each with a title and a child component ID. */
  tabItems: {
    title: {path?: string; literalString?: string};
    /** A reference to a component instance by its unique ID. */
    child: string;
  }[];
};

export type Row = {
  children: ComponentArrayReferenceShape;
  distribution?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly';
  alignment?: 'start' | 'center' | 'end' | 'stretch';
};

export type Column = {
  children: ComponentArrayReferenceShape;
  distribution?: 'start' | 'center' | 'end' | 'spaceBetween' | 'spaceAround' | 'spaceEvenly';
  alignment?: 'start' | 'center' | 'end' | 'stretch';
};

export type List = {
  children: ComponentArrayReferenceShape;
  direction?: 'vertical' | 'horizontal';
  alignment?: 'start' | 'center' | 'end' | 'stretch';
};

export type Button = {
  /** The ID of the component to display as the button's content. */
  child: string;
  action: Action;
  /** Indicates if this button should be styled as the primary action. */
  primary?: boolean;
};

export type Modal = {
  /** The ID of the component (e.g., a button) that triggers the modal. */
  entryPointChild: string;
  /** The ID of the component to display as the modal's content. */
  contentChild: string;
};

export type Card = {
  /** The ID of the component to be rendered inside the card. */
  child: string;
};

export type Divider = {
  /** The orientation. */
  axis?: 'horizontal' | 'vertical';
  /** The color of the divider (e.g., hex code or semantic name). */
  color?: string;
  /** The thickness of the divider. */
  thickness?: number;
};

export type TextField = {
  text?: StringValue;
  /** A label, title, or placeholder text. */
  label: StringValue;
  textFieldType?: 'shortText' | 'number' | 'date' | 'longText' | 'obscured';
  /** A regex string to validate the input. */
  validationRegexp?: string;
};

export type Checkbox = {
  label: StringValue;
  value: {path?: string; literalBoolean?: boolean};
};

export type DateTimeInput = {
  value: StringValue;
  enableDate?: boolean;
  enableTime?: boolean;
  /** The string format for the output (e.g., 'YYYY-MM-DD'). */
  outputFormat?: string;
};

export type MultipleChoice = {
  selections: {path?: string; literalArray?: string[]};
  options?: {label: {path?: string; literalString?: string}; value: string}[];
  maxAllowedSelections?: number;
  type?: 'checkbox' | 'chips';
  filterable?: boolean;
};

export type Slider = {
  value: {path?: string; literalNumber?: number};
  minValue?: number;
  maxValue?: number;
  label?: StringValue;
};
