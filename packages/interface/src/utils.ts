import jsCharDet from "jschardet";
import { Template, parse, tokenize } from "@huggingface/jinja";
import * as XLSX from "xlsx";
import { objectEntries } from "./helpers/objectHelpers";
import type { Email, Prefs, TemplateErrors } from "./types/modelTypes";
import type { FileContent, SpreadsheetData } from "./types/types";

function zip<T, U>(a: Array<T | undefined>, b: Array<U>) {
    // If `a` has a blank slot (e.g. a == [1,,2]), then
    // `.map` will skip it over. We don't want that, so detect
    // a blank slot and create a dense array.
    // https://stackoverflow.com/questions/36622064/check-the-array-has-empty-element-or-not/36622150
    if (a.includes(undefined)) {
        a = Array.from(a);
    }
    return a.map(function (_, i) {
        return [a[i], b[i]];
    });
}

// Returns true if `bytes` look like a binary spreadsheet (e.g. .xlsx, .ods, .xls)
// rather than a text format like CSV.
function isBinarySpreadsheet(bytes: Uint8Array): boolean {
    const startsWith = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
    // UTF-16 text (e.g. Excel's "Unicode Text" export) contains NUL bytes but is still text
    if (startsWith([0xff, 0xfe]) || startsWith([0xfe, 0xff])) {
        return false;
    }
    // ZIP (.xlsx, .ods, .xlsb, ...) or CFB (.xls, ...) containers
    if (
        startsWith([0x50, 0x4b, 0x03, 0x04]) ||
        startsWith([0xd0, 0xcf, 0x11, 0xe0])
    ) {
        return true;
    }
    // Other binary formats almost always contain NUL bytes near the start; text does not
    return bytes.subarray(0, 1024).includes(0);
}

// Decode text whose encoding is unknown. Valid UTF-8 is assumed to be UTF-8 (this also
// covers plain ASCII). Otherwise use jsCharDet to guess the encoding.
function decodeText(bytes: Uint8Array): string {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        // Not valid UTF-8
    }
    // UTF-16 with a BOM; TextDecoder strips the BOM
    if (bytes[0] === 0xff && bytes[1] === 0xfe) {
        return new TextDecoder("utf-16le").decode(bytes);
    }
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
        return new TextDecoder("utf-16be").decode(bytes);
    }

    // jsCharDet expects a "binary string" with one character per byte
    let rawString = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
        rawString += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const detected = jsCharDet.detect(rawString);
    const targetEncoding =
        (detected.confidence > 0.9 && detected.encoding) || "windows-1252";
    console.log(
        "Detected encoding",
        detected,
        "Using encoding",
        targetEncoding
    );
    try {
        return new TextDecoder(targetEncoding).decode(bytes);
    } catch {
        // TextDecoder doesn't support every encoding that jsCharDet can detect
        console.warn(
            `Encoding ${targetEncoding} not supported; using windows-1252`
        );
        return new TextDecoder("windows-1252").decode(bytes);
    }
}

// parse an array containing raw bytes from a spreadsheet of some
// format. XLSX will auto-detect the format
function parseSpreadsheet(data: FileContent): SpreadsheetData {
    if (data.length === 0) {
        return [[]];
    }

    const bytes = new Uint8Array(data);
    try {
        let parsed: XLSX.WorkBook;
        if (isBinarySpreadsheet(bytes)) {
            parsed = XLSX.read(bytes, { type: "array", cellDates: true });
        } else {
            // Text formats like CSV are decoded ourselves since XLSX does not detect
            // the encoding. `raw` keeps every value exactly as written, so dates are
            // not turned into serial numbers and leading zeros are not dropped.
            parsed = XLSX.read(decodeText(bytes), {
                type: "string",
                raw: true,
            });
        }
        const sheet = parsed.Sheets[parsed.SheetNames[0]];
        const sheetArray = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
        });

        return sheetArray;
    } catch (e) {
        console.warn("Error when parsing spreadsheet; using fallback", e);
    }

    // Let XLSX try to auto-detect everything
    try {
        const parsed = XLSX.read(data, {
            type: "array",
        });
        const sheet = parsed.Sheets[parsed.SheetNames[0]];
        const sheetArray = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
        });

        return sheetArray;
    } catch (e) {
        console.warn("Error when parsing spreading; no fallback available", e);
    }

    return [
        ["!! Error parsing spreadsheet !!"],
        [
            "Try saving your spreadsheet in a different format (e.g. .xlsx or .ods)",
        ],
    ];
}

type Subs = Record<string, string>;

type FilledTemplates = {
    emails: Email[];
    // The errors for each email, if any of its fields couldn't be filled in. Those fields
    // are left as they are in the template.
    errors: TemplateErrors[];
};

// Fill every item in template with data from spreadsheet
function fillTemplate(
    template: Email,
    spreadsheet: SpreadsheetData,
    method: Prefs["parser"] = "jinja"
): FilledTemplates {
    // create an array of substitutions
    const [header, ...rows] = spreadsheet;
    const subsArray = rows
        .filter((row) => {
            // no blank rows
            return !row.every((x) => !x);
        })
        .map((row) => {
            const subs: Subs = {};
            for (let [key, val] of zip<string, string | Date>(header, row)) {
                // skip over non-string (likely null) headers
                if (typeof key !== "string") {
                    continue;
                }
                if (typeof val === "number") {
                    val = String(val);
                }
                if (val instanceof Date) {
                    val = val.toLocaleDateString();
                }
                // assume non-string values are just ""
                if (typeof val !== "string") {
                    val = "";
                }

                key = key.trim();
                val = val.trim();
                if (!key) {
                    continue;
                }
                subs[key] = val;
            }
            return subs;
        });

    switch (method) {
        case "legacy":
            return fillTemplateLegacy(template, subsArray);
        case "jinja":
        default:
            return fillTemplateJinja(template, subsArray);
    }
}

/**
 * A Jinja template parsed with Jinja's default whitespace handling (the same as
 * nunjucks, which MailMergeP used before). `@huggingface/jinja`'s `Template` enables
 * the `trim_blocks` and `lstrip_blocks` options and drops a trailing newline, which
 * would change the line breaks in emails.
 *
 * This relies on `tokenize` always stripping one trailing newline (as Jinja does by
 * default), so the library is pinned to an exact version and the whitespace handling
 * is covered by tests. (The `super("")` call parses an empty template, which is cheap.)
 * `tokenize` also removes the Transformers-specific `{% generation %}` tags, which
 * aren't otherwise meaningful in an email.
 */
class MailMergeTemplate extends Template {
    constructor(source: string) {
        super("");
        this.parsed = parse(tokenize(source + "\n", {}));
    }
}

const reservedNames = new Map<string, boolean>();

/**
 * Whether `name` is defined by `@huggingface/jinja` itself (e.g. `range`, `none`, `true`).
 * Rendering fails if a variable with one of these names is passed in, so such spreadsheet
 * columns can't be used in templates.
 */
function isReservedName(name: string) {
    let reserved = reservedNames.get(name);
    if (reserved === undefined) {
        try {
            new Template("").render({ [name]: "" });
            reserved = false;
        } catch {
            reserved = true;
        }
        reservedNames.set(name, reserved);
    }
    return reserved;
}

// The names of all variables, functions and filters used in a parsed template
function identifiersIn(node: unknown, found = new Set<string>()) {
    if (Array.isArray(node)) {
        node.forEach((child) => identifiersIn(child, found));
    } else if (node && typeof node === "object") {
        const { type, value } = node as { type?: unknown; value?: unknown };
        if (type === "Identifier" && typeof value === "string") {
            found.add(value);
        }
        Object.values(node).forEach((child) => identifiersIn(child, found));
    }
    return found;
}

function fillTemplateJinja(
    template: Email,
    subsArray: Subs[]
): FilledTemplates {
    const columns = new Set(subsArray.flatMap((subs) => Object.keys(subs)));
    const reservedColumns = [...columns].filter(isReservedName);

    // Parse each field once. A field with an error is left as it is in the template.
    const parsed: Partial<Record<keyof Email, MailMergeTemplate>> = {};
    const fieldErrors: TemplateErrors = {};
    objectEntries(template).forEach(([key, val]) => {
        if (!val) {
            return;
        }
        try {
            parsed[key] = new MailMergeTemplate(val);
        } catch (e) {
            fieldErrors[key] = String((e as Error)?.message ?? e);
            return;
        }
        const used = identifiersIn(parsed[key].parsed);
        const usedReserved = reservedColumns.filter((name) => used.has(name));
        if (usedReserved.length > 0) {
            fieldErrors[key] =
                `The column name${usedReserved.length > 1 ? "s" : ""} ${usedReserved
                    .map((name) => `"${name}"`)
                    .join(
                        ", "
                    )} can't be used in templates. Rename the column.`;
        }
    });

    const emails: Email[] = [];
    const errors: TemplateErrors[] = [];
    for (const subs of subsArray) {
        const variables = Object.fromEntries(
            Object.entries(subs).filter(([key]) => !isReservedName(key))
        );
        const email: Email = {};
        const emailErrors: TemplateErrors = {};
        objectEntries(template).forEach(([key, val]) => {
            if (!val) {
                return;
            }
            const fieldTemplate = parsed[key];
            if (fieldErrors[key] || !fieldTemplate) {
                emailErrors[key] = fieldErrors[key];
                email[key] = val;
                return;
            }
            try {
                email[key] = fieldTemplate.render(variables);
            } catch (e) {
                emailErrors[key] = String((e as Error)?.message ?? e);
                email[key] = val;
            }
        });
        emails.push(email);
        errors.push(emailErrors);
    }
    return { emails, errors };
}

function fillTemplateLegacy(
    template: Email,
    subsArray: Subs[]
): FilledTemplates {
    const ret: Email[] = [];

    // recursively apply substitutions
    function substitute(string: string, object: Record<string, string>) {
        //var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}])", "g");
        //var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
        //var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
        //var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
        const objPattern = new RegExp(
            "(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^{}]*)[}][}])",
            "g"
        );

        const arrMatches = objPattern.exec(string);
        if (!arrMatches) {
            return string;
        }

        /* workaround start */
        for (let i = 1; i < arrMatches.length; i++) {
            if (!arrMatches[i]) {
                continue;
            }
            arrMatches[i] = arrMatches[i].replace(
                new RegExp("\n(  )*", "g"),
                " "
            );
        }
        /* workaround end */

        if (object) {
            if (arrMatches[1]) {
                /* {{name}} */
                string = string.replace(
                    arrMatches[0],
                    object[arrMatches[1]] || ""
                );
                return substitute(string, object);
            }

            if (arrMatches[2]) {
                /* {{name|if|then}} */
                string =
                    (object[arrMatches[2]] || "") === arrMatches[3]
                        ? string.replace(arrMatches[0], arrMatches[4])
                        : string.replace(arrMatches[0], "");
                return substitute(string, object);
            }

            if (arrMatches[5]) {
                /* {{name|if|then|else}} */
                string =
                    (object[arrMatches[5]] || "") === arrMatches[6]
                        ? string.replace(arrMatches[0], arrMatches[7])
                        : string.replace(arrMatches[0], arrMatches[8]);
                return substitute(string, object);
            }

            if (arrMatches[9]) {
                if (arrMatches[10] === "*") {
                    /* {{name|*|if|then|else}} */
                    string = (object[arrMatches[9]] || "").match(arrMatches[11])
                        ? string.replace(arrMatches[0], arrMatches[12])
                        : string.replace(arrMatches[0], arrMatches[13]);
                    return substitute(string, object);
                }

                if (arrMatches[10] === "^") {
                    /* {{name|^|if|then|else}} */
                    string = (object[arrMatches[9]] || "").match(
                        "^" + arrMatches[11]
                    )
                        ? string.replace(arrMatches[0], arrMatches[12])
                        : string.replace(arrMatches[0], arrMatches[13]);
                    return substitute(string, object);
                }

                if (arrMatches[10] === "$") {
                    /* {{name|$|if|then|else}} */
                    string = (object[arrMatches[9]] || "").match(
                        arrMatches[11] + "$"
                    )
                        ? string.replace(arrMatches[0], arrMatches[12])
                        : string.replace(arrMatches[0], arrMatches[13]);
                    return substitute(string, object);
                }
            }

            if (arrMatches[9]) {
                if (arrMatches[10] === "==") {
                    /* {{name|==|if|then|else}} */
                    string =
                        parseFloat(
                            (object[arrMatches[9]] || "").replace(",", ".")
                        ) === parseFloat(arrMatches[11].replace(",", "."))
                            ? string.replace(arrMatches[0], arrMatches[12])
                            : string.replace(arrMatches[0], arrMatches[13]);
                    return substitute(string, object);
                }

                if (arrMatches[10] === ">" || arrMatches[10] === "&gt;") {
                    /* {{name|>|if|then|else}} */
                    string =
                        parseFloat(
                            (object[arrMatches[9]] || "").replace(",", ".")
                        ) > parseFloat(arrMatches[11].replace(",", "."))
                            ? string.replace(arrMatches[0], arrMatches[12])
                            : string.replace(arrMatches[0], arrMatches[13]);
                    return substitute(string, object);
                }

                if (arrMatches[10] === ">=" || arrMatches[10] === "&gt;=") {
                    /* {{name|>=|if|then|else}} */
                    string =
                        parseFloat(
                            (object[arrMatches[9]] || "").replace(",", ".")
                        ) >= parseFloat(arrMatches[11].replace(",", "."))
                            ? string.replace(arrMatches[0], arrMatches[12])
                            : string.replace(arrMatches[0], arrMatches[13]);
                    return substitute(string, object);
                }

                if (arrMatches[10] === "<" || arrMatches[10] === "&lt;") {
                    /* {{name|<|if|then|else}} */
                    string =
                        parseFloat(
                            (object[arrMatches[9]] || "").replace(",", ".")
                        ) < parseFloat(arrMatches[11].replace(",", "."))
                            ? string.replace(arrMatches[0], arrMatches[12])
                            : string.replace(arrMatches[0], arrMatches[13]);
                    return substitute(string, object);
                }

                if (arrMatches[10] === "<=" || arrMatches[10] === "&lt;=") {
                    /* {{name|<=|if|then|else}} */
                    string =
                        parseFloat(
                            (object[arrMatches[9]] || "").replace(",", ".")
                        ) <= parseFloat(arrMatches[11].replace(",", "."))
                            ? string.replace(arrMatches[0], arrMatches[12])
                            : string.replace(arrMatches[0], arrMatches[13]);
                    return substitute(string, object);
                }
            }
        }

        string = string.replace(arrMatches[0], "");
        return substitute(string, object);
    }

    // populate template for each row
    for (const subs of subsArray) {
        const subbed: Email = {};
        objectEntries(template).forEach(([key, val]) => {
            try {
                if (val) {
                    subbed[key] = substitute(val, subs);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_e) {
                console.warn(
                    "Failed to render template",
                    val,
                    "with substitutions",
                    subs
                );
                subbed[key] = val;
            }
        });

        ret.push(subbed);
    }

    // The legacy parser never fails; unknown syntax is left as-is
    return { emails: ret, errors: ret.map(() => ({})) };
}

/**
 * Returns a promise that delays for number of milliseconds
 *
 * @param abortFunction - called repeatedly to test if the promise should be aborted
 */
function delay(duration: number, abortFunction = () => false) {
    // ms to poll before testing if we should abort
    const POLLING_DURATION = 100;

    return new Promise<void>((resolve) => {
        const startTime = Date.now();
        const intervalHandle = window.setInterval(function () {
            if (Date.now() - startTime >= duration || abortFunction()) {
                resolve();
                window.clearTimeout(intervalHandle);
            }
        }, POLLING_DURATION);
    });
}

/**
 * Returns an "HH:mm:ss" formatted string
 */
function formatTime(time: number) {
    function pad(x: number) {
        return ("" + x).padStart(2, "0");
    }

    const seconds = Math.floor(time / 1000) % 60;
    const minutes = Math.floor(time / (60 * 1000)) % 60;
    const hours = Math.floor(time / (60 * 60 * 1000));

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Whether any field of any email couldn't be filled in
function hasTemplateErrors(errors: TemplateErrors[]) {
    return errors.some((emailErrors) => Object.keys(emailErrors).length > 0);
}

/**
 * Update preferences saved by older versions of MailMergeP. They may have `parser: "nunjucks"`,
 * which used the same template syntax as `"jinja"`.
 */
function normalizePrefs<T extends object>(
    prefs: T
): Omit<T, "parser"> & { parser?: Prefs["parser"] } {
    const { parser } = prefs as { parser?: unknown };
    if (parser === undefined || parser === "legacy") {
        return prefs as Omit<T, "parser"> & { parser?: Prefs["parser"] };
    }
    return { ...prefs, parser: "jinja" };
}

export {
    delay,
    fillTemplate,
    formatTime,
    hasTemplateErrors,
    normalizePrefs,
    parseSpreadsheet,
};
