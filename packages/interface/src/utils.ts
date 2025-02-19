import jsCharDet from "jschardet";
import nunjucks from "nunjucks";
import * as XLSX from "xlsx";
import { objectEntries } from "./helpers/objectHelpers";
import type { Email } from "./types/modelTypes";
import type {
    FileContent,
    NunjucksTemplate,
    SpreadsheetData,
} from "./types/types";

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

// parse an array containing raw bytes from a spreadsheet of some
// format. XLSX will auto-detect the format
function parseSpreadsheet(data: FileContent): SpreadsheetData {
    if (data.length === 0) {
        return [[]];
    }

    try {
        // use xlsx.js to parse the spreadsheet data
        const parsed = XLSX.read(data.slice(), {
            type: "array",
            // According to the docs dateNF can be set to a string value to specify date format.
            // See https://docs.sheetjs.com/docs/api/parse-options#parsing-options and https://github.com/SheetJS/sheetjs/issues/718
            // Changing to date format string caused issues with parsing non-english charaters for some reason. Keeping it as is to not change runtime behaviour.
            // @ts-expect-error: see comment above.
            dateNF: true,
            cellDates: true,
        });
        const sheet = parsed.Sheets[parsed.SheetNames[0]];
        const sheetArray = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
        });

        return sheetArray;
    } catch (e) {
        console.warn("Error when parsing spreading; using fallback", e);
    }
    // CSV parsing may fail for different file encodings.
    // Use jsCharDet to attempt to detect the encoding and try to parse the data again.
    try {
        const dataArray = new Uint8Array(data);
        const rawString = String.fromCharCode.apply(
            null,
            Array.from(dataArray)
        );
        const detected = jsCharDet.detect(rawString);
        const targetEncoding =
            (detected.confidence > 0.9 && detected.encoding) || "utf-8";
        console.log(
            "Detected encoding",
            detected,
            "Trying encoding",
            targetEncoding
        );

        const parsedStr = new TextDecoder(targetEncoding).decode(dataArray);
        const parsed = XLSX.read(parsedStr, { type: "string" });
        const sheet = parsed.Sheets[parsed.SheetNames[0]];
        const sheetArray = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
        });

        return sheetArray;
    } catch (e) {
        console.warn("Error when parsing spreading as unicode", e);
    }

    // CSV parsing may fail when trying to process date cells, so we fall
    // back to not processing the date cells.
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

// Fill every item in template with data from spreadsheet
function fillTemplate(
    template: Email,
    spreadsheet: SpreadsheetData,
    method = "nunjucks"
) {
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
        case "nunjucks":
        default:
            return fillTemplateNunjucks(template, subsArray);
    }
}

function fillTemplateNunjucks(template: Email, subsArray: Subs[]) {
    const ret: Email[] = [];
    const compiled: Partial<Record<keyof Email, NunjucksTemplate>> = {};
    // If auto-escaping is turned on, then emails with `<...>` will become `&lt;...&gt;`
    const env = nunjucks.configure({ autoescape: false });

    // pre-compile the template for efficiency
    objectEntries(template).forEach(([key, val]) => {
        try {
            if (val) {
                compiled[key] = nunjucks.compile(val, env);
            }
        } catch (e) {
            console.warn("Failed to compile template", { [key]: val }, e);
        }
    });

    // populate template for each row
    for (const subs of subsArray) {
        const subbed: Email = {};
        objectEntries(compiled).forEach(([key, val]) => {
            try {
                if (val) {
                    subbed[key] = val.render(subs);
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (_e) {
                if (val) {
                    console.warn(
                        "Failed to render template '",
                        val.tmplStr,
                        "' with substitutions",
                        subs
                    );
                }
                if (val && typeof val.tmplStr === "string") {
                    subbed[key] = val.tmplStr || "";
                }
            }
        });
        ret.push(subbed);
    }

    return ret;
}

function fillTemplateLegacy(template: Email, subsArray: Subs[]) {
    const ret = [];

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

    return ret;
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

export { delay, fillTemplate, formatTime, parseSpreadsheet };
