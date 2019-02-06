## Mail Merge P

Mail Merge P (_Mail Merge with Preview_) 
is a Thunderbird add-on to send bulk emails based off information provided in a spreadsheet. 

Mail Merge P is based off of Mail Merge by Alexander Bergmann https://addons.thunderbird.net/en-US/thunderbird/addon/mail-merge/

## Development

Build the html interface in `html-src` with

    npm run install
    npm run build

Copy or link the contents of `html-src/build/` to `thunderbird-src/content/iframe-content`. Then,
copy or link the `thunderbird-src` folder to
a folder `mailmergep@example.net` in your Thunderbird profile/extensions directory.

You can open the Thunderbird debugging console with Ctrl+Shift+I. Once in the debugging console,
you can manually open dialogs with the `window.open` command. For example,

    dgl = window.open("chrome://mailmergep/content/iframe-wrapper.xul", "test", "chrome")

will open and run `iframe-wrapper.xul`, which is the main UI component of Mail Merge P.
You can then poke around `dgl` for variables and functions
stored in the extension's scope.
