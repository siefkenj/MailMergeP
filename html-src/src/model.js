/*
 * A model for a Redux store (using easy-peasy) for all mailmerge code.
 * All persistent state is stored via this model.
 */

import { effect } from "easy-peasy";
import { messageParent } from "./service.js";
import { fillTemplate, parseSpreadsheet } from "./utils.js";

export default {
    locale: {
        strings: {},
        updateStrings: (state, payload) => {
            return { ...state, strings: {...payload} };
        }
    },
    prefs: {
        delay: 0,
        sendmode: "now",
        range: "",
        parser: "nunjucks",
        fileName: "",
        fileContents: [],
        updatePref: effect(async (dispatch, payload, { getState }) => {
            // first send an update to the host window, then update the state.
            const state = getState();
            state.prefs = { ...state.prefs, ...payload };

            await messageParent({
                type: "SET_PREFERENCES",
                prefs: state.prefs
            });

            dispatch.prefs.updatePrefNosync(state.prefs);
        }),
        updatePrefNosync: (state, payload) => {
            return { ...state, ...payload };
        },
        fetchPrefs: effect(async dispatch => {
            // send a signal to get the preferences
            const data = await messageParent({ type: "GET_PREFERENCES" });
            dispatch.prefs.updatePrefNosync(data.prefs);
        })
    },
    data: {
        spreadsheetData: [[]],
        updateSpreadsheetData: (state, payload) => {
            return { ...state, spreadsheetData: payload };
        },
        spreadsheetHasManuallyUpdated: false,
        updateSpreadsheetHasManuallyUpdated: (state, payload) => {
            return { ...state, spreadsheetHasManuallyUpdated: payload };
        },
        template: {},
        updateTemplate: (state, payload) => {
            return { ...state, template: { ...payload } };
        },
        fetchTemplate: effect(async dispatch => {
            // grab the template from the parent window
            const data = await messageParent({ type: "GET_TEMPLATE" });
            // save the template
            dispatch.data.updateTemplate(data.template);
        }),
        emails: [],
        updateEmails: (state, payload) => {
            return { ...state, emails: payload };
        }
    },
    tabs: {
        currTab: 0,
        setTab: (state, payload) => {
            return { ...state, currTab: payload };
        },
        prevTab: (state, payload) => ({
            ...state,
            currTab: Math.max(state.currTab - 1, 0)
        }),
        nextTab: (state, payload) => ({ ...state, currTab: state.currTab + 1 })
    },
    // effects
    initialise: effect(async dispatch => {
        await dispatch.prefs.fetchPrefs();
        const { strings } = await messageParent({ type: "GET_LOCALIZED_STRINGS" });
        dispatch.locale.updateStrings(strings);
    }),
    cancel: effect(async dispatch => {
        await messageParent({ type: "CANCEL" });
    }),
    parseSpreadsheet: effect(async (dispatch, payload, { getState }) => {
        // presuming raw data has been loaded into .prefs,
        // prase with XLSX.js
        const state = getState();
        const { fileContents } = state.prefs;

        // if we have manually updated spreadsheet data, don't override
        // the spreadsheet contents with the file's contents
        if (!state.data.spreadsheetHasManuallyUpdated) {
            let sheetArray = parseSpreadsheet(fileContents);
            await dispatch.data.updateSpreadsheetData(sheetArray);
        }
    }),
    renderEmails: effect(async (dispatch, payload, { getState }) => {
        await dispatch.data.fetchTemplate();
        const { data, prefs } = getState();

        let spreadsheetData = [data.spreadsheetData[0]]
        // if a non-empty range was specified in the payload, filter out only those
        // rows from the spreadsheet. Note, the range starts at "1".
        if (!payload || payload.length === 0) {
            spreadsheetData = data.spreadsheetData;
        } else {
            for (let i of payload) {
                if (data.spreadsheetData[i]) {
                    spreadsheetData.push(data.spreadsheetData[i])
                }
            }
        }
        let emails = fillTemplate(data.template, spreadsheetData, prefs.parser);
        dispatch.data.updateEmails(emails);
    }),
    sendEmails: effect(async (dispatch, payload, { getState }) => {
        const { data } = getState();

        await messageParent({ type: "SEND_EMAILS", emails: data.emails });
    }),
    openUrl: effect(async (dispatch, payload) => {
        await messageParent({ type: "OPEN_URL", url: payload });
    })
};
