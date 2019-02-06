"use strict";
Components.utils.import("resource://gre/modules/Services.jsm");

function init(event) {
    console.log(gMsgCompose);
    event.stopPropagation();

    if (!utils.checkForMissingEmailParts(window)) {
        return;
    }

    // The UI must access gMsgCompose so that it can
    // get the to/cc/bcc/etc. information to build a 
    // template.
    window.mailmergeGlobals = { gMsgCompose: window.gMsgCompose };
    window.open(
        "chrome://mailmergep/content/iframe-wrapper.xul",
        "_blank",
        "chrome,dialog,modal,centerscreen"
    );
}
