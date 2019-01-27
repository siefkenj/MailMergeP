import React, { useState, useRef } from "react";
import { useStore, useAction } from "easy-peasy";
import classNames from "classnames";
import rangeParser from "parse-numeric-range";
import { ClearableInput } from "./common.js";

function SettingsTab() {
    const prefs = useStore(state => state.prefs);
    const updatePref = useAction(actions => actions.prefs.updatePref);
    function generatePrefUpdate(pref) {
        return e => {
            if (e.target) {
                updatePref({ [pref]: e.target.value });
            } else {
                updatePref({ [pref]: e });
            }
        };
    }
    // a range is invalid if it is non-empty and rangeParser.parse parses it
    // to an empty array
    const rangeValid =
        prefs.range.trim().length === 0 ||
        rangeParser.parse(prefs.range).length > 0;
    return (
        <div className="browser-style settings-panel">
            <label htmlFor="pref-sendmode" className="settings-label">
                Send mode:
            </label>
            <select
                className="browser-style settings-input"
                id="pref-sendmode"
                value={prefs.sendmode}
                onChange={generatePrefUpdate("sendmode")}
                title="Set how messages will be delivered. Send Later will leave messages in the Drafts folder."
            >
                <option value="draft">Save as Draft</option>
                <option value="now">Send Now</option>
                <option value="later">Send Later</option>
            </select>

            <label htmlFor="pref-delay" className="settings-label">
                Message Delay:
            </label>
            <input
                id="pref-delay"
                type="number"
                value={prefs.delay}
                onChange={generatePrefUpdate("delay")}
                className="browser-style settings-input"
                title="Dealy, in seconds, between sending messages."
            />

            <label htmlFor="pref-range" className="settings-label">
                Send Message Range:
            </label>
            <ClearableInput
                value={prefs.range}
                id="pref-range"
                className={classNames({
                    invalid: !rangeValid,
                    "settings-input": true
                })}
                onChange={generatePrefUpdate("range")}
                placeholder="3,4,9-14"
                title="Send only specific messages as specified by this range."
            />

            <label htmlFor="pref-parser" className="settings-label">
                Parser:
            </label>
            <select
                className="browser-style settings-input"
                id="pref-parser"
                value={prefs.parser}
                onChange={generatePrefUpdate("parser")}
                title="Select the parser that will be used to substitute variables into the email template."
            >
                <option value="nunjucks">Nunjucks</option>
                <option value="legacy">Legacy</option>
            </select>
        </div>
    );
}

export { SettingsTab };
