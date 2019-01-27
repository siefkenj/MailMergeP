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
    let ret = [];
    let [header, ...rows] = spreadsheet;
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
    for (let row of rows) {
        // skip blank rows
        if (row.every(x => !x)) {
            continue;
        }

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

        let subbed = {};
        for (let [key, val] of Object.entries(compiled)) {
            try {
                subbed[key] = val.render(subs);
            } catch (e) {
                console.warn(
                    "Failed to render template",
                    val.tmplStr,
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
