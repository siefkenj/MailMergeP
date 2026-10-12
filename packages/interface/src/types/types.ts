import type { ChangeEvent, FocusEvent } from "react";

export type FileContent = number[];

export type ParseRangeReturnType = number[];

export type UpdatePrefEvent =
    | ChangeEvent<HTMLSelectElement>
    | FocusEvent<HTMLInputElement>;

// An array of arrays of cell values, which can be anything to support custom cell data types, but by default is `string | number | boolean | undefined`.
// See /node_modules/handsontable/common.d.ts
export type SpreadsheetData = string[][];

export type Strings = Record<string, string>;
