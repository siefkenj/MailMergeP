// import LocalizedStrings from "react-localization";
// const formatString = LocalizedStrings.prototype.formatString;

import { useStoreActions, useStoreState } from "../hooks/storeHooks";

function AboutTab() {
    const strings = useStoreState((state) => state.locale.strings);
    const openUrl = useStoreActions((action) => action.openUrl);

    // By default, links will open in the iframe. We don't wan't that,
    // so send a message to the server to open the link for us.
    function linkClick(e: React.MouseEvent<HTMLAnchorElement>) {
        e.preventDefault();
        openUrl(e.currentTarget?.getAttribute("href") || "");
    }

    return (
        <div className="browser-style about-panel">
            <div className="captioned-separator">{strings.developers}</div>
            <ul>
                <li>Jason Siefken</li>
            </ul>
            <div className="captioned-separator">{strings.support}</div>
            <ul>
                <li>
                    <a
                        href="https://github.com/siefkenj/MailMergeP"
                        onClick={linkClick}
                    >
                        https://github.com/siefkenj/MailMergeP
                    </a>
                </li>
            </ul>
            <div className="captioned-separator">{strings.licenses}</div>
            <ul>
                <li>
                    <a
                        href="https://www.gnu.org/licenses/gpl-3.0.html"
                        onClick={linkClick}
                    >
                        GNU General Public License, Version 3.0
                    </a>
                </li>
            </ul>
        </div>
    );
}

export { AboutTab };
