## Mail Merge

Mail Merge is a Thunderbird add-on to send bulk emails based off information provided in a spreadsheet. 

Mail Merge is based off of Mail Merge by Alexander Bergmann https://addons.thunderbird.net/en-US/thunderbird/addon/mail-merge/

## Development

You can open the Thunderbird debugging console with Ctrl+Shift+I. Once in the debugging console,
you can manually open dialogs with the `window.open` command. For example,

    dgl = window.open("chrome://mailmerge/content/dialog.xul", "test", "chrome")

will open and run `dialog.xul`. You can then poke around `dgl` for variables and functions
stored in the extension's scope.
