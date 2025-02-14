import nunjucks from "nunjucks";
import * as XLSX from "xlsx";
import jsCharDet from "jschardet";

function zip(a, b) {
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
function parseSpreadsheet(data) {
    if (data.length === 0) {
        return [[]];
    }

    try {
        // use xlsx.js to parse the spreadsheet data
        let parsed = XLSX.read(data.slice(), {
            type: "array",
            dateNF: true,
            cellDates: true,
        });
        let sheet = parsed.Sheets[parsed.SheetNames[0]];
        let sheetArray = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        return sheetArray;
    } catch (e) {
        console.warn("Error when parsing spreading; using fallback", e);
    }
    // CSV parsing may fail for different file encodings.
    // Use jsCharDet to attempt to detect the encoding and try to parse the data again.
    try {
        const dataArray = new Uint8Array(data);
        const rawString = String.fromCharCode.apply(null, dataArray);
        const detected = jsCharDet.detect(rawString);
        const targetEncoding =
            (detected.confidence > 0.9 && detected.encoding) || "utf-8";
        console.log(
            "Detected encoding",
            detected,
            "Trying encoding",
            targetEncoding
        );

        let parsedStr = new TextDecoder(targetEncoding).decode(dataArray);
        let parsed = XLSX.read(parsedStr, { type: "string" });
        let sheet = parsed.Sheets[parsed.SheetNames[0]];
        let sheetArray = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        return sheetArray;
    } catch (e) {
        console.warn("Error when parsing spreading as unicode", e);
    }

    // CSV parsing may fail when trying to process date cells, so we fall
    // back to not processing the date cells.
    try {
        let parsed = XLSX.read(data, {
            type: "array",
        });
        let sheet = parsed.Sheets[parsed.SheetNames[0]];
        let sheetArray = XLSX.utils.sheet_to_json(sheet, { header: 1 });

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

// Fill every item in template with data from spreadsheet
function fillTemplate(template, spreadsheet, method = "nunjucks") {
    // create an array of substitutions
    let [header, ...rows] = spreadsheet;
    let subsArray = rows
        .filter((row) => {
            // no blank rows
            return !row.every((x) => !x);
        })
        .map((row) => {
            let subs = {};
            for (let [key, val] of zip(header, row)) {
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

function fillTemplateNunjucks(template, subsArray) {
    let ret = [];
    let compiled = {};
    // If auto-escaping is turned on, then emails with `<...>` will become `&lt;...&gt;`
    const env = nunjucks.configure({ autoescape: false });

    // pre-compile the template for efficiency
    for (let [key, val] of Object.entries(template)) {
        try {
            compiled[key] = nunjucks.compile(val, env);
        } catch (e) {
            console.warn("Failed to compile template", { [key]: val }, e);
        }
    }

    // populate template for each row
    for (let subs of subsArray) {
        let subbed = {};
        for (let [key, val] of Object.entries(compiled)) {
            try {
                subbed[key] = val.render(subs);
            } catch (e) {
                console.warn(
                    "Failed to render template '",
                    val.tmplStr,
                    "' with substitutions",
                    subs
                );
                subbed[key] = val.tmplStr;
            }
        }
        ret.push(subbed);
    }

    return ret;
}

function fillTemplateLegacy(template, subsArray) {
    let ret = [];

    // recursively apply substitutions
    function substitute(string, object) {
        //var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}])", "g");
        //var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
        //var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
        //var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
        var objPattern = new RegExp(
            "(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^{}]*)[}][}])",
            "g"
        );

        var arrMatches = objPattern.exec(string);
        if (!arrMatches) {
            return string;
        }

        /* workaround start */
        for (var i = 1; i < arrMatches.length; i++) {
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
    for (let subs of subsArray) {
        let subbed = {};
        for (let [key, val] of Object.entries(template)) {
            try {
                subbed[key] = substitute(val, subs);
            } catch (e) {
                console.warn(
                    "Failed to render template",
                    val,
                    "with substitutions",
                    subs
                );
                subbed[key] = val;
            }
        }
        ret.push(subbed);
    }

    return ret;
}

/**
 * Returns a promise that delays for number of milliseconds
 *
 * @param {number} duration
 * @param {function} abortFunction - called repeatedly to test if the promise should be aborted
 * @returns {Promise}
 */
function delay(duration, abortFunction = () => false) {
    // ms to poll before testing if we should abort
    const POLLING_DURATION = 100;

    return new Promise((resolve, reject) => {
        const startTime = new Date();
        const intervalHandle = window.setInterval(function () {
            if (new Date() - startTime >= duration || abortFunction()) {
                resolve();
                window.clearTimeout(intervalHandle);
            }
        }, POLLING_DURATION);
    });
}

/**
 * Returns an "HH:mm:ss" formatted string
 *
 * @param {number} time
 * @returns {string} - formatted as "HH:mm:ss"
 */
function formatTime(time) {
    function pad(x) {
        return ("" + x).padStart(2, "0");
    }

    let seconds = Math.floor(time / 1000) % 60;
    let minutes = Math.floor(time / (60 * 1000)) % 60;
    let hours = Math.floor(time / (60 * 60 * 1000));

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export { fillTemplate, parseSpreadsheet, delay, formatTime };
