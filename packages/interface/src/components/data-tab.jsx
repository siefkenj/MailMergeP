import React, { useRef, useEffect } from "react";
import { useStoreState, useStoreActions } from "easy-peasy";
import { HotTable } from "@handsontable/react-wrapper";
import Handsontable from "handsontable";
import "handsontable/dist/handsontable.full.css";
import { ClearableFileInput } from "./common";

const isLetterRegex = /^[A-Za-z0-9]*$/;

function DataTab() {
    const tableRef = useRef();
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

    async function fileChanged({ name, data }) {
        name = name || "";
        data = data || [];
        // because this data will be saved as JSON, we have to convert
        // it to a regular array
        let datAsArray = Array.from(data);
        updatePref({ fileName: name, fileContents: datAsArray });
        // If we've loaded a file, we want to forget any manual changes
        // we made to the spreadsheet data
        updateSpreadsheetHasManuallyUpdated(false);
    }

    function spreadsheetChanged(changes) {
        // Don't get stuck in a loop of loading and saving data!
        if (changes === null) {
            return;
        }
        const sheetArray = tableRef.current.hotInstance.getData();
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
                    filename={prefs.fileName}
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
                    ref={tableRef}
                    data={data.spreadsheetData}
                    afterChange={spreadsheetChanged}
                    rowHeaders={(index) => (index === 0 ? "Vars:" : index)}
                    fixedRowsTop={1}
                    stretchH={"last"}
                    minSpareRows={3}
                    minSpareCols={1}
                    minCols={5}
                    cells= {(row, col) => {
                        let cellProperties = {};
                        if (row === 0) {
                            cellProperties.renderer = function (
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
                    }}
                    height={300}
                    width={"100%"}
                />
            </div>
        </div>
    );
}

export { DataTab };
