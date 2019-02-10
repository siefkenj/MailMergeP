import React from "react";
import { useStore, useAction } from "easy-peasy";

import LocalizedStrings from "react-localization";
const formatString = LocalizedStrings.prototype.formatString;

function AboutTab() {
    const strings = useStore(state => state.locale.strings);
    const openUrl = useAction(action => action.openUrl);

    // By default, links will open in the iframe. We don't wan't that,
    // so send a message to the server to open the link for us.
    function linkClick(e) {
        e.preventDefault();
        openUrl(e.target.getAttribute("href"));
    }

    return (
        <div className="browser-style about-panel">
            <div className="captioned-separator">{strings.developers}</div>
            <ul>
                <li>Jason Siefken</li>
                <li>Alexander Bergmann</li>
            </ul>
            <div className="captioned-separator">{strings.support}</div>
            <ul>
                <li>
                    <a href="https://github.com/siefkenj/MailMerge"
                        onClick={linkClick}
                    >
                        https://github.com/siefkenj/MailMerge
                    </a>
                </li>
            </ul>
            <div className="captioned-separator">{strings.licenses}</div>
            <ul>
                <li>
                    <a href="https://www.gnu.org/licenses/gpl-3.0.html"
                        onClick={linkClick}
                    >
                        GNU General Public License, Version 3.0
                    </a>
                </li>
            </ul>
            <div className="captioned-separator">{strings.donate}</div>
            <ul>
                <li>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge+P&amp;amount=5&amp;currency_code=EUR"
                        onClick={linkClick}
                    >
                        {formatString(strings.euro, 5)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge+P&amp;amount=10&amp;currency_code=EUR"
                        onClick={linkClick}
                    >
                        {formatString(strings.euro, 10)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge+P&amp;amount=15&amp;currency_code=EUR"
                        onClick={linkClick}
                    >
                        {formatString(strings.euro, 15)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge+P&amp;amount=25&amp;currency_code=EUR"
                        onClick={linkClick}
                    >
                        {formatString(strings.euro, 25)}
                    </a>
                </li>
                <li>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge+P&amp;amount=5&amp;currency_code=USD"
                        onClick={linkClick}
                    >
                        {formatString(strings.dollar, 5)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge+P&amp;amount=10&amp;currency_code=USD"
                        onClick={linkClick}
                    >
                        {formatString(strings.dollar, 10)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge+P&amp;amount=15&amp;currency_code=USD"
                        onClick={linkClick}
                    >
                        {formatString(strings.dollar, 15)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge+P&amp;amount=25&amp;currency_code=USD"
                        onClick={linkClick}
                    >
                        {formatString(strings.dollar, 25)}
                    </a>
                </li>
            </ul>
        </div>
    );
}

export { AboutTab };
