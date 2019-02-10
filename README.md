## Mail Merge P

Mail Merge P (_Mail Merge with Preview_) 
is a Thunderbird add-on to send bulk emails based off information provided in a spreadsheet. 

You can play around with the main ui-component in the browser: https://siefkenj.github.io/MailMerge/browser-iframe-server.html

You can also download the latest build: https://siefkenj.github.io/MailMerge/mailmergep@example.net-latest.xpi

Mail Merge P is based off of Mail Merge by Alexander Bergmann https://addons.thunderbird.net/en-US/thunderbird/addon/mail-merge/

## Building

Build the entire extension with

    npm install
    npm run build
    npm run build-addon
    npm run package-addon

The extension will then be located at `html-src/build/mailmergep@example.net-latest.xpi`.

## Development

Mail Merge P is divided into two parts: the html interface (located in `html-src`)
and the Thunderbird plugin (located in `thunderbird-src`). Most UI and
backend work is handled by the html components. The Thunderbird component runs the html
component in an iframe and uses message passing to communicate with the iframe.

This split means that the bulk of Mail Merge P can be developed in the browser without
Thunderbird.

### Developing the HTML UI

A browser-based simulation of the Mail Merge P Thunderbird API is provided by `browser-iframe-server.html`.
To develop in the browser run the commands

    npm install
    npm start

Then open `localhost:3000/browser-iframe-server.html` in your browser (with `3000` replaced by the port
of the node server).

The UI is developed using React and Redux with the helper EasyPeasy.

### Developing the Thunderbird Extension

Copy or link the contents of `thunderbird-src` to `mailmergep@example.net` 
in your Thunderbird profile/extensions directory. Then restart Thunderbird and activate the
extension.

You can open the Thunderbird debugging console with Ctrl+Shift+I. Once in the debugging console,
you can manually open dialogs with the `window.open` command. For example,

    dgl = window.open("chrome://mailmergep/content/iframe-wrapper.xul", "test", "chrome")

will open and run `iframe-wrapper.xul`, which is the main UI component of Mail Merge P.
You can then poke around `dgl` for variables and functions
stored in the extension's scope.
