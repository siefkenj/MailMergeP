import { useRef } from "react";
import { HotTable, type HotTableRef } from "@handsontable/react-wrapper";
import type Handsontable from "handsontable/base";
import { registerPlugin } from "handsontable/plugins/registry";
import { AutoColumnSize } from "handsontable/plugins/autoColumnSize";
import { Autofill } from "handsontable/plugins/autofill";
import { CopyPaste } from "handsontable/plugins/copyPaste";
import { DragToScroll } from "handsontable/plugins/dragToScroll";
import { StretchColumns } from "handsontable/plugins/stretchColumns";
import { UndoRedo } from "handsontable/plugins/undoRedo";
import type { BaseRenderer } from "handsontable/renderers";
import { textRenderer } from "handsontable/renderers/textRenderer";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-classic.min.css";
import { ClearableFileInput, type FileInputOnChangeValue } from "./common";
import { useStoreActions, useStoreState } from "../hooks/storeHooks";
import type { SpreadsheetData } from "../types/types";

type CellProperties = Partial<Handsontable.CellProperties>;

// Only register the Handsontable features we use, rather than importing the full
// build, which is several MB larger. These are the plugins the full build enables
// with our settings.
registerPlugin(AutoColumnSize);
registerPlugin(Autofill);
registerPlugin(CopyPaste);
registerPlugin(DragToScroll);
registerPlugin(StretchColumns);
registerPlugin(UndoRedo);

const isLetterRegex = /^[A-Za-z0-9]*$/;

function escapeHtml(text: string) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Handsontable's `sanitizer` option. Pasted HTML tables (e.g. from Excel) are read
 * cell-by-cell using `innerHTML`, so any markup would end up in the cell values.
 * Spreadsheet data is plain text, so reduce pasted HTML to a bare table of cell text.
 * Everything else Handsontable writes as HTML (just our row header labels) is escaped.
 */
function sanitizeHtml(html: string, source?: string): string {
    if (!source?.startsWith("CopyPaste.paste")) {
        return escapeHtml(html);
    }
    const table = new DOMParser()
        .parseFromString(html, "text/html")
        .querySelector("table");
    if (!table) {
        // Handsontable falls back to the plain-text clipboard data
        return "";
    }
    const rows = Array.from(table.rows, (row) => {
        const cells = Array.from(row.cells, (cell) => {
            const span =
                (cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : "") +
                (cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : "");
            for (const br of Array.from(cell.querySelectorAll("br"))) {
                br.replaceWith("\n");
            }
            return `<td${span}>${escapeHtml(cell.textContent || "")}</td>`;
        });
        return `<tr>${cells.join("")}</tr>`;
    });
    return `<table>${rows.join("")}</table>`;
}

function DataTab() {
    const tableRef = useRef<HotTableRef>(null);
    const strings = useStoreState((state) => state.locale.strings);
    const prefs = useStoreState((state) => state.prefs);
    const updatePref = useStoreActions((actions) => actions.prefs.updatePref);
    const data = useStoreState((state) => state.data);
    const updateData = useStoreActions(
        (actions) => actions.data.updateSpreadsheetData
    );
    const updateSpreadsheetHasManuallyUpdated = useStoreActions(
        (actions) => actions.data.updateSpreadsheetHasManuallyUpdated
    );

    async function fileChanged({ name, data }: FileInputOnChangeValue) {
        name = name || "";
        data = data || new ArrayBuffer();
        // because this data will be saved as JSON, we have to convert
        // it to a regular array
        const datAsArray = Array.from(new Uint8Array(data));
        updatePref({ fileName: name, fileContents: datAsArray });
        // If we've loaded a file, we want to forget any manual changes
        // we made to the spreadsheet data
        updateSpreadsheetHasManuallyUpdated(false);
    }

    function spreadsheetChanged(changes: Handsontable.CellChange[] | null) {
        // Don't get stuck in a loop of loading and saving data!
        if (changes === null) {
            return;
        }
        const sheetArray = (tableRef.current?.hotInstance?.getData() ||
            []) as SpreadsheetData;
        updateData(sheetArray);
        // If we changed data manually, we don't want to reload it from
        // the file buffer
        updateSpreadsheetHasManuallyUpdated(true);
    }

    const hasNonLetterInFirstRow = data.spreadsheetData[0].some(
        // If it contains a non-letter and is not whitespace, we want to warn
        (w) =>
            typeof w === "string" && !isLetterRegex.test(w) && w.trim() !== ""
    );

    return (
        <div style={{ width: "100%" }}>
            <p>{strings.dataInfo}</p>
            <div>
                <ClearableFileInput
                    accept=".csv,.xlsx,.ods,.xls"
                    onChange={fileChanged}
                    filename={prefs.fileName || ""}
                    placeholder={strings.openAFile}
                />
            </div>
            <div className="captioned-separator">{strings.data}</div>
            {hasNonLetterInFirstRow && (
                <div className="warning">
                    <i className="fas fa-warning fa-fw" />{" "}
                    {strings.dataHeaderWarning ||
                        'Items in the "Vars" header row must be single words with no special characters.'}
                </div>
            )}
            <div style={{ width: "100%" }}>
                <HotTable
                    licenseKey="non-commercial-and-evaluation"
                    themeName="ht-theme-classic"
                    sanitizer={sanitizeHtml}
                    ref={tableRef}
                    data={data.spreadsheetData}
                    afterChange={spreadsheetChanged}
                    rowHeaders={(index) =>
                        index === 0 ? "Vars:" : index.toString()
                    }
                    fixedRowsTop={1}
                    stretchH={"last"}
                    minSpareRows={3}
                    minSpareCols={1}
                    minCols={5}
                    cells={(row) => {
                        const cellProperties: CellProperties = {};

                        if (row === 0) {
                            cellProperties.renderer = function (
                                ...args: Parameters<BaseRenderer>
                            ) {
                                textRenderer.apply(this, args);
                                args[1].className += " spreadsheet-vars-row";
                            };
                        }
                        return cellProperties;
                    }}
                    height={300}
                    width={"100%"}
                />
            </div>
        </div>
    );
}

export { DataTab };
