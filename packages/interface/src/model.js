/*
 * A model for a Redux store (using easy-peasy) for all mailmerge code.
 * All persistent state is stored via this model.
 */

import { action, thunk } from "easy-peasy";
import { messageParent } from "./service";
import {
    fillTemplate,
    parseSpreadsheet,
    delay as delayPromise,
    formatTime
} from "./utils";

export default {
    locale: {
        strings: {},
        updateStrings: action((state, payload) => {
            return { ...state, strings: { ...payload } };
        })
    },
    prefs: {
        delay: 0,
        sendmode: "now",
        range: "",
        parser: "nunjucks",
        fileName: "",
        fileContents: [],
        updatePref: thunk(async (actions, payload, { getState }) => {
            const newPrefs = { ...getState(), ...payload };

            // first send an update to the host window, then update the state.
            await messageParent({
                type: "SET_PREFERENCES",
                prefs: newPrefs
            });

            actions.updatePrefNosync(newPrefs);
        }),
        updatePrefNosync: action((state, payload) => {
            return { ...state, ...payload };
        }),
        fetchPrefs: thunk(async actions => {
            // send a signal to get the preferences
            const data = await messageParent({ type: "GET_PREFERENCES" });
            actions.updatePrefNosync(data.prefs);
        })
    },
    data: {
        spreadsheetData: [[]],
        updateSpreadsheetData: action((state, payload) => {
            return { ...state, spreadsheetData: payload };
        }),
        spreadsheetHasManuallyUpdated: false,
        updateSpreadsheetHasManuallyUpdated: action((state, payload) => {
            return { ...state, spreadsheetHasManuallyUpdated: payload };
        }),
        template: {},
        updateTemplate: action((state, payload) => {
            return { ...state, template: { ...payload } };
        }),
        fetchTemplate: thunk(async actions => {
            // grab the template from the parent window
            const data = await messageParent({ type: "GET_TEMPLATE" });
            // save the template
            actions.updateTemplate(data.template);
        }),
        emails: [],
        updateEmails: action((state, payload) => {
            return { ...state, emails: payload };
        })
    },
    tabs: {
        currTab: 0,
        setTab: action((state, payload) => {
            return { ...state, currTab: payload };
        }),
        prevTab: action((state, payload) => ({
            ...state,
            currTab: Math.max(state.currTab - 1, 0)
        })),
        nextTab: action((state, payload) => ({
            ...state,
            currTab: state.currTab + 1
        }))
    },
    // effects
    initialise: thunk(async (actions, payload, { dispatch }) => {
        await dispatch.prefs.fetchPrefs();
        const { strings } = await messageParent({
            type: "GET_LOCALIZED_STRINGS"
        });
        dispatch.locale.updateStrings(strings);
    }),
    cancel: thunk(async () => {
        await messageParent({ type: "CANCEL" });
    }),
    parseSpreadsheet: thunk(
        async (actions, payload, { dispatch, getState }) => {
            // presuming raw data has been loaded into .prefs,
            // parse with XLSX.js
            const state = getState();
            const { fileContents } = state.prefs;

            // if we have manually updated spreadsheet data, don't override
            // the spreadsheet contents with the file's contents
            if (!state.data.spreadsheetHasManuallyUpdated) {
                let sheetArray = parseSpreadsheet(fileContents);
                await dispatch.data.updateSpreadsheetData(sheetArray);
            }
        }
    ),
    renderEmails: thunk(async (actions, payload, { dispatch, getState }) => {
        await dispatch.data.fetchTemplate();
        const { data, prefs } = getState();

        let spreadsheetData = [data.spreadsheetData[0]];
        // if a non-empty range was specified in the payload, filter out only those
        // rows from the spreadsheet. Note, the range starts at "1".
        if (!payload || payload.length === 0) {
            spreadsheetData = data.spreadsheetData;
        } else {
            for (let i of payload) {
                if (data.spreadsheetData[i]) {
                    spreadsheetData.push(data.spreadsheetData[i]);
                }
            }
        }
        let emails = fillTemplate(data.template, spreadsheetData, prefs.parser);
        dispatch.data.updateEmails(emails);
    }),
    sendEmails: thunk(async (actions, payload, { getState }) => {
        const {
            data,
            prefs: { delay, sendmode },
            locale: { strings }
        } = getState();

        // Start a timer that updates the time throughout the whole process
        const startTime = new Date();
        const intervalHandle = window.setInterval(
            () =>
                actions.sendDialog.update({
                    time: formatTime(new Date() - startTime)
                }),
            500
        );

        let current = 0;
        // Set the initial dialog properties
        actions.sendDialog.update({
            open: true,
            abort: false,
            progress: 0,
            current,
            total: data.emails.length,
            time: 0
        });

        try {
            function shouldAbort() {
                const {
                    sendDialog: { abort }
                } = getState();
                return abort;
            }
            for (const email of data.emails) {
                // Check for the abort state before we send an email
                if (shouldAbort()) {
                    break;
                }
                current += 1;
                actions.sendDialog.update({
                    current,
                    progress: current / (data.emails.length + 1),
                    status: strings.sending
                });
                await actions.sendEmail({ email, sendmode });
                actions.sendDialog.update({
                    status: strings.waiting
                });

                // Compute how long to wait before sending the next email
                const waitTime =
                    1000 * delay * current - (new Date() - startTime);
                await delayPromise(waitTime, shouldAbort);
            }
        } catch (e) {
            console.error(e);
        }

        // cleanup
        clearTimeout(intervalHandle);
        actions.sendDialog.update({
            open: false
        });
    }),
    sendEmail: thunk(async (actions, payload) => {
        await messageParent({ type: "SEND_EMAIL", ...payload });
    }),
    // Everything associated with an email being sent
    sendDialog: {
        open: false,
        abort: false,
        progress: 0,
        current: 1,
        time: 0,
        update: action((state, payload) => ({
            ...state,
            ...payload
        })),
        cancel: thunk(actions => {
            actions.update({ abort: true });
        })
    },

    openUrl: thunk(async (actions, payload) => {
        await messageParent({ type: "OPEN_URL", url: payload });
    })
};
