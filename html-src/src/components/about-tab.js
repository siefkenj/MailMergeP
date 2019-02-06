import React from "react";
import { useStore } from "easy-peasy";

import LocalizedStrings from "react-localization";
const formatString = LocalizedStrings.prototype.formatString;

function AboutTab() {
    const strings = useStore(state => state.locale.strings);
    return (
        <div className="browser-style about-panel">
            <div className="captioned-separator">{strings.developers}</div>
            <ul>
                <li>Alexander Bergmann</li>
                <li>Jason Siefken</li>
            </ul>
            <div className="captioned-separator">{strings.support}</div>
            <ul>
                <li>
                    <a href="https://addons.thunderbird.net/addon/mail-merge/">
                        https://addons.thunderbird.net/addon/mail-merge/
                    </a>
                </li>
                <li>
                    <a href="mailto:myaddons@gmx.de">myaddons@gmx.de</a>
                </li>
            </ul>
            <div className="captioned-separator">{strings.licenses}</div>
            <ul>
                <li>
                    <a href="https://www.gnu.org/licenses/gpl-3.0.html">
                        GNU General Public License, Version 3.0
                    </a>
                </li>
            </ul>
            <div className="captioned-separator">{strings.donate}</div>
            <ul>
                <li>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge&amp;amount=5&amp;currency_code=EUR">
                        {formatString(strings.euro, 5)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge&amp;amount=10&amp;currency_code=EUR">
                        {formatString(strings.euro, 10)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge&amp;amount=15&amp;currency_code=EUR">
                        {formatString(strings.euro, 15)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge&amp;amount=25&amp;currency_code=EUR">
                        {formatString(strings.euro, 25)}
                    </a>
                </li>
                <li>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge&amp;amount=5&amp;currency_code=USD">
                        {formatString(strings.dollar, 5)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge&amp;amount=10&amp;currency_code=USD">
                        {formatString(strings.dollar, 10)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge&amp;amount=15&amp;currency_code=USD">
                        {formatString(strings.dollar, 15)}
                    </a>
                    <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_donations&amp;business=myaddons@gmx.de&amp;lc=US&amp;item_name=Mail+Merge&amp;amount=25&amp;currency_code=USD">
                        {formatString(strings.dollar, 25)}
                    </a>
                </li>
            </ul>
        </div>
    );
}

export { AboutTab };
