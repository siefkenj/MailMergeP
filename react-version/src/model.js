import { effect } from "easy-peasy";
import { messageParent } from "./service.js";
import { fillTemplate, parseSpreadsheet } from "./utils.js";

export default {
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
    }),
    parseSpreadsheet: effect(async (dispatch, payload, { getState }) => {
        // presuming raw data has been loaded into .prefs,
        // prase with XLSX.js
        const state = getState();
        const { fileContents } = state.prefs;

        let sheetArray = parseSpreadsheet(fileContents);
        await dispatch.data.updateSpreadsheetData(sheetArray);
    }),
    renderEmails: effect(async (dispatch, payload, { getState }) => {
        await dispatch.data.fetchTemplate();
        const { data } = getState();

        let emails = fillTemplate(data.template, data.spreadsheetData);
        dispatch.data.updateEmails(emails);
    })
};
