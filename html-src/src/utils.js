import nunjucks from "nunjucks";
import XLSX from "xlsx";

function zip(a, b) {
    return a.map(function(_, i) {
        return [a[i], b[i]];
    });
}

// parse an array containing raw bytes from a spreadsheet of some
// format. XLSX will auto-detect the format
function parseSpreadsheet(data) {
    if (data.length === 0) {
        return [[]];
    }

    // use xlsx.js to parse the spreadsheet data
    let parsed = XLSX.read(data, { type: "array" });
    let sheet = parsed.Sheets[parsed.SheetNames[0]];
    let sheetArray = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    return sheetArray;
}

// Fill every item in template with data from spreadsheet
function fillTemplate(template, spreadsheet, method = "nunjucks") {
    // create an array of substitutions
    let [header, ...rows] = spreadsheet;
    let subsArray = rows
        .filter(row => {
            // no blank rows
            return !row.every(x => !x);
        })
        .map(row => {
            let subs = {};
            for (let [key, val] of zip(header, row)) {
                // skip over non-string (likely null) headers
                if (typeof key !== "string") {
                    continue;
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

    // pre-compile the template for efficiency
    for (let [key, val] of Object.entries(template)) {
        try {
            compiled[key] = nunjucks.compile(val);
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

export { fillTemplate, parseSpreadsheet };
