import { Action, Thunk } from "easy-peasy";
import type { Strings, SpreadsheetData, ParseRangeReturnType } from "./types";

type SpreadsheetHasManuallyUpdated = boolean;

export interface Model {
    locale: Locale;
    prefs: Prefs;
    data: Data;
    tabs: Tabs;
    initialise: Thunk<Model, undefined, never, Model>;
    cancel: Thunk<Model>;
    parseSpreadsheet: Thunk<Model, undefined, never, Model>;
    renderEmails: Thunk<
        Model,
        ParseRangeReturnType,
        unknown,
        Model
    >;
    sendEmails: Thunk<Model, undefined, never, Model>;
    sendEmail: Thunk<
        Model,
        { email: Email; sendmode: Prefs["sendmode"] }
    >;
    sendDialog: SendDialog;
    openUrl: Thunk<Model, string>;
}

interface Locale {
    strings: Strings;
    updateStrings: Action<Locale, Strings>;
}

export interface Prefs {
    delay: number;
    sendmode: "now" | "later";
    range: string;
    parser: "nunjucks" | "legacy";
    fileName: string;
    fileContents: number[];
    fetchPrefs: Thunk<Prefs>;
    updatePref: Thunk<Prefs, Partial<Prefs>>;
    updatePrefNosync: Action<Prefs, Partial<Prefs>>;
}

interface Data {
    spreadsheetData: SpreadsheetData;
    updateSpreadsheetData: Action<Data, SpreadsheetData>;
    spreadsheetHasManuallyUpdated: SpreadsheetHasManuallyUpdated;
    updateSpreadsheetHasManuallyUpdated: Action<
        Data,
        SpreadsheetHasManuallyUpdated
    >;
    template: Email;
    updateTemplate: Action<Data, Email>;
    fetchTemplate: Thunk<Data>;
    emails: Email[];
    updateEmails: Action<Data, Email[]>;
}

interface Tabs {
    currTab: number;
    setTab: Action<Tabs, number>;
    prevTab: Action<Tabs>;
    nextTab: Action<Tabs>;
}

interface SendDialog {
    open: boolean;
    abort: boolean;
    progress: number;
    current: number;
    time: string;
    total: number;
    status: string;
    update: Action<SendDialog, Partial<SendDialog>>;
    cancel: Thunk<SendDialog>;
}

// Type based on defaultTemplate in packages/thunderbird-iframe-service/src/thunderbird-iframe-service.js
export type Email = {
    from?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    replyTo?: string;
    attachment?: string;
    subject?: string;
    body?: string;
};
