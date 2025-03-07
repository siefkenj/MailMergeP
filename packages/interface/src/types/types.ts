import type { Template } from "nunjucks";
import type { ChangeEvent, FocusEvent } from "react";

export type FileContent = number[];

// Type Template in @types/nunjucks package does not include all possible properties that nunjucks can add to the Template object
// See 'var Template' in node_modules/nunjucks/browser/nunjucks.js to add additional properties.
export interface NunjucksTemplate extends Template {
    tmplStr?: Record<PropertyKey, unknown> | string;
}

export type ParseRangeReturnType = number[];

export type UpdatePrefEvent =
    | ChangeEvent<HTMLSelectElement>
    | FocusEvent<HTMLInputElement>;

// An array of arrays of cell values, which can be anything to support custom cell data types, but by default is `string | number | boolean | undefined`.
// See /node_modules/handsontable/common.d.ts
export type SpreadsheetData = string[][];

export type Strings = Record<string, string>;
