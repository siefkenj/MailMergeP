import React from "react";
import { useStoreState, useStoreActions } from "easy-peasy";
import classNames from "classnames";
import { ClearableInput } from "./common";
import { parseRange } from "../utils";

function SettingsTab() {
    const prefs = useStoreState((state) => state.prefs);
    const strings = useStoreState((state) => state.locale.strings);
    const updatePref = useStoreActions((actions) => actions.prefs.updatePref);
    function generatePrefUpdate(pref) {
        return (e) => {
            if (e.target) {
                updatePref({ [pref]: e.target.value });
            } else {
                updatePref({ [pref]: e });
            }
        };
    }
    // a range is invalid if it is non-empty and parseRange parses it
    // to an empty array
    const rangeValid =
        prefs.range.trim().length === 0 || parseRange(prefs.range).length > 0;

    return (
        <div className="browser-style settings-panel">
            <label htmlFor="pref-sendmode" className="settings-label">
                {strings.sendMode}
            </label>
            <select
                className="browser-style settings-input"
                id="pref-sendmode"
                value={prefs.sendmode}
                onChange={generatePrefUpdate("sendmode")}
                title={strings.sendModeDesc}
            >
                {/*
                // XXX Cannot be used until https://bugzilla.mozilla.org/show_bug.cgi?id=1747456 is fixed
                <option value="draft">{strings.sendModeDraft}</option>
                */}
                <option value="now">{strings.sendModeNow}</option>
                <option value="later">{strings.sendModeLater}</option>
            </select>

            <label htmlFor="pref-delay" className="settings-label">
                {strings.messageDelay}
            </label>
            <input
                id="pref-delay"
                type="number"
                value={prefs.delay}
                onChange={generatePrefUpdate("delay")}
                className="browser-style settings-input"
                title={strings.messageDelayDesc}
            />

            <label htmlFor="pref-range" className="settings-label">
                {strings.sendMessageRange}
            </label>
            <ClearableInput
                value={prefs.range}
                id="pref-range"
                className={classNames({
                    invalid: !rangeValid,
                    "settings-input": true,
                })}
                onChange={generatePrefUpdate("range")}
                placeholder="3,4,9-14"
                title={strings.sendMessageRangeDesc}
            />

            <label htmlFor="pref-parser" className="settings-label">
                {strings.parser}
            </label>
            <select
                className="browser-style settings-input"
                id="pref-parser"
                value={prefs.parser}
                onChange={generatePrefUpdate("parser")}
                title={strings.parserDesc}
            >
                <option value="nunjucks">Nunjucks</option>
                <option value="legacy">{strings.parserLegacy}</option>
            </select>
        </div>
    );
}

export { SettingsTab };
