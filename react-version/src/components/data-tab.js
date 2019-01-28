import React, { useRef, useEffect } from "react";
import { useStore, useAction } from "easy-peasy";
import { HotTable } from "@handsontable/react";
import Handsontable from "handsontable";
import "handsontable/dist/handsontable.full.css";
import { ClearableFileInput } from "./common.js";

function DataTab() {
    const tableRef = useRef();
    const prefs = useStore(state => state.prefs);
    const updatePref = useAction(actions => actions.prefs.updatePref);
    const data = useStore(state => state.data);
    const updateData = useAction(actions => actions.data.updateSpreadsheetData);
    const updateSpreadsheetHasManuallyUpdated = useAction(actions => actions.data.updateSpreadsheetHasManuallyUpdated);

    const parseSpreadsheet = useAction(actions => actions.parseSpreadsheet);


    useEffect(() => {
        parseSpreadsheet();
    }, [prefs.fileName]);


    async function fileChanged({ name, data }) {
        name = name || "";
        data = data || [];
        // because this data will be saved as JSON, we have to convert
        // it to a regular array
        let datAsArray = Array.from(data);
        updatePref({ fileName: name, fileContents: datAsArray });
        // If we've loaded a file, we want to forget any manual changes
        // we made to the spreadsheet data
        updateSpreadsheetHasManuallyUpdated(false)
    }

    function spreadsheetChanged(changes, source) {
        // Don't get stuck in a loop of loading and saving data!
        if (source === "loadData") {
            return;
        }
        const sheetArray = tableRef.current.hotInstance.getData();
        updateData(sheetArray);
        // If we changed data manually, we don't want to reload it from
        // the file buffer
        updateSpreadsheetHasManuallyUpdated(true);
    }

    return (
        <div style={{ width: "100%" }}>
            <p>
                Open a spreadsheet file (.csv, .xlsx, .ods, etc.) or
                copy-and-paste data into the spreadsheet below.
            </p>
            <div>
                <ClearableFileInput
                    accept=".csv,.xlsx,.ods"
                    onChange={fileChanged}
                    filename={prefs.fileName}
                />
            </div>
            <div className="captioned-separator">Data</div>
            <div style={{ width: "100%" }}>
                <HotTable
                    ref={tableRef}
                    data={data.spreadsheetData}
                    afterChange={spreadsheetChanged}
                    settings={{
                        rowHeaders: index => (index === 0 ? "Vars:" : index),
                        fixedRowsTop: 1,
                        stretchH: "last",
                        minSpareRows: 3,
                        minSpareCols: 1,
                        minCols: 5,
                        cells: (row, col) => {
                            let cellProperties = {};
                            if (row === 0) {
                                cellProperties.renderer = function(
                                    instance,
                                    td,
                                    row,
                                    col,
                                    prop,
                                    value,
                                    cellProperties
                                ) {
                                    Handsontable.renderers.TextRenderer.apply(
                                        this,
                                        arguments
                                    );
                                    td.className += " spreadsheet-vars-row";
                                };
                            }
                            return cellProperties;
                        }
                    }}
                    height="300"
                    width="100%"
                />
            </div>
        </div>
    );
}

export { DataTab };
