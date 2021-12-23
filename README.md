[![Build Status](https://travis-ci.com/siefkenj/MailMerge.svg?branch=master)](https://travis-ci.com/siefkenj/MailMerge)

## Mail Merge P

Mail Merge P (_Mail Merge with Preview_) 
is a Thunderbird add-on to send bulk emails based off information provided in a spreadsheet. 

Mail Merge P uses the [nunjucks](https://mozilla.github.io/nunjucks/) templating engine to 
fill email templates based on data provided by a spreadsheet.

## Usage

Prepare a spreadsheet with a single header row.
Any templating variable you wish to be filled, wrap in `{{..}}`. For example, if your 
spreadsheet has headers `name` and `email`, you can use `{{name}}` and `{{email}}` in 
the body/subject/to/cc/bcc fields of your email. Mail Merge P will then substitute data from
the spreadsheet into these fields.

You can use the full power of the _nunjucks_ templating engine, but be aware that all data
from a spreadsheet is interpreted as a string.

## Install

You can play around with the main ui-component in the browser: https://siefkenj.github.io/MailMerge/browser-iframe-server.html

You can also download the latest build: https://siefkenj.github.io/MailMerge/mailmergep@example.net-latest.xpi

Mail Merge P is based off of Mail Merge by Alexander Bergmann https://addons.thunderbird.net/en-US/thunderbird/addon/mail-merge/

## Building

Build the entire extension with

    npm install
    npm run build
    npm run build-addon
    npm run package-addon

The extension will be located in the current directory and called `mailmergep@example.net-latest.xpi`.

## Development

Mail Merge P is divided into two parts: the html interface (located in `html-src`)
and the Thunderbird plugin (located in `thunderbird-src`). Most UI and
backend work is handled by the html components. The Thunderbird component runs the html
component in an iframe and uses message passing to communicate with the iframe.

This split means that the bulk of Mail Merge P can be developed in the browser without
Thunderbird.

To run thunderbird and force a reload of all extension content, do

```
thunderbird -purgecaches
```

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

To access the APIs available to the browser extension, you must go to the extensions
tab and click the gear icon and enable "Debug Mode". Then you can open a console
in the context of mailmergep and the `browser.*` apis will be available. To manipulate
a particular tab, you can use `browser.tabs.query({})` to get a list of all tabs and
use the `id` of the tab you want.
