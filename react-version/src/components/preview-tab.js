import React, { useState, useRef, useEffect } from "react";
import { useStore, useAction } from "easy-peasy";
import classNames from "classnames";
import { ClearableInput } from "./common.js";

function PreviewTab() {
    const data = useStore(state => state.data);
    const prefs = useStore(state => state.prefs);
    const [previewItem, setPreviewItem] = useState(0);
    const email = data.emails[previewItem] || {};
    const numEmails = data.emails.length;

    const renderEmails = useAction(actions => actions.renderEmails);
    useEffect(() => {
        renderEmails();
    }, [data.spreadsheetData, prefs.parser]);

    function nextPreview() {
        setPreviewItem(previewItem + 1);
    }
    function previousPreview() {
        setPreviewItem(previewItem - 1);
    }

    if (numEmails === 0) {
        return (
            <div className="email-preview-wrapper">
                <div className="email-preview-stats">
                    No emails to preview. Try loading data in the <i>Data</i>{" "}
                    tab.
                </div>
            </div>
        );
    }

    return (
        <div className="email-preview-wrapper">
            <div className="email-preview-stats">
                Previewing {previewItem + 1} of {numEmails}
            </div>
            <div className="email-preview">
                <button
                    className="browser-style email-preview-nav"
                    onClick={previousPreview}
                    disabled={previewItem === 0}
                >
                    <i className="fas fa-chevron-left" />
                </button>
                <div id="preview-container">
                    <div id="email-head">
                        <table>
                            <tbody>
                                <tr>
                                    <td className="to-header">To:</td>
                                    <td className="to-content" id="to">
                                        {email.to}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="to-header">CC:</td>
                                    <td className="to-content" id="to-cc">
                                        {email.cc}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="to-header">BCC:</td>
                                    <td className="to-content" id="to-bcc">
                                        {email.bcc}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div id="email-body">
                        <div id="email-subject">{email.subject}</div>
                        <div
                            id="email-content"
                            dangerouslySetInnerHTML={{ __html: email.body }}
                        />
                    </div>
                </div>
                <button
                    className="browser-style email-preview-nav"
                    onClick={nextPreview}
                    disabled={previewItem === numEmails - 1}
                >
                    <i className="fas fa-chevron-right" />
                </button>
            </div>
        </div>
    );
}

export { PreviewTab };
