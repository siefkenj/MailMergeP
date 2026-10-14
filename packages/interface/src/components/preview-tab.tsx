import { useState, useEffect } from "react";
import { useStoreActions, useStoreState } from "../hooks/storeHooks";
import { parseRange } from "../utils/parseRange";
import { objectEntries } from "../helpers/objectHelpers";

import LocalizedStrings from "react-localization";
const formatString = LocalizedStrings.prototype.formatString;

function PreviewTab() {
    const strings = useStoreState((state) => state.locale.strings);
    const data = useStoreState((state) => state.data);
    const prefs = useStoreState((state) => state.prefs);
    const [previewItem, setPreviewItem] = useState(0);
    const email = data.emails[previewItem] || {};
    const emailErrors = data.templateErrors[previewItem] || {};
    const numEmails = data.emails.length;
    const numEmailsWithErrors = data.templateErrors.filter(
        (errors) => Object.keys(errors).length > 0
    ).length;

    // An HTML email.body contains full HTML, including the <html> and <body> tags.
    // Parse it so we can grab just the body.
    const emailBody = data.templateIsPlainText
        ? ""
        : new DOMParser().parseFromString(email.body || "", "text/html").body
              .innerHTML;

    const renderEmails = useStoreActions((actions) => actions.renderEmails);
    useEffect(() => {
        renderEmails(
            parseRange(prefs.range || "", 1, data.spreadsheetData.length - 1)
        );
    }, [data.spreadsheetData, prefs.parser, prefs.range, renderEmails]);

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
                    {formatString(strings.previewEmpty, <i>{strings.data}</i>)}
                </div>
            </div>
        );
    }

    return (
        <div className="email-preview-wrapper">
            <div className="email-preview-stats">
                {formatString(
                    strings.previewPreviewing,
                    previewItem + 1,
                    numEmails
                )}
            </div>
            {numEmailsWithErrors > 0 && (
                <div className="warning" id="template-errors-summary">
                    <i className="fas fa-warning fa-fw" />{" "}
                    {formatString(
                        strings.previewErrorsSummary ||
                            "{0} of the emails can't be filled in. Fix the template or the data before sending.",
                        numEmailsWithErrors
                    )}
                </div>
            )}
            <div className="email-preview">
                <button
                    className="browser-style email-preview-nav"
                    onClick={previousPreview}
                    disabled={previewItem === 0}
                >
                    <i className="fas fa-chevron-left" />
                </button>
                <div id="preview-container">
                    {Object.keys(emailErrors).length > 0 && (
                        <div className="warning" id="template-errors">
                            {strings.previewEmailErrors ||
                                "This email can't be filled in:"}
                            <ul>
                                {objectEntries(emailErrors).map(
                                    ([field, error]) => (
                                        <li key={field}>
                                            {field}: {error}
                                        </li>
                                    )
                                )}
                            </ul>
                        </div>
                    )}
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
                        {data.templateIsPlainText ? (
                            <div id="email-content" className="plain-text">
                                {email.body}
                            </div>
                        ) : (
                            <div
                                id="email-content"
                                dangerouslySetInnerHTML={{ __html: emailBody }}
                            />
                        )}
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
