"use strict";
Components.utils.import("resource://gre/modules/Services.jsm");

var mailmerge = {
	
	init: function() {
		
		var prefs = Services.prefs.getBranch("extensions.mailmerge.");
		var stringbundle = document.getElementById("mailmerge-stringbundle");
		
		if(window.opener.cardbookRepository) { document.getElementById("mailmerge-message-source").appendItem(stringbundle.getString("mailmerge.dialog.source.cardbook"), "Cardbook"); }
		document.getElementById("mailmerge-message-source").appendItem(stringbundle.getString("mailmerge.dialog.source.addressbook"), "AddressBook");
		document.getElementById("mailmerge-message-source").appendItem(stringbundle.getString("mailmerge.dialog.source.csv"), "CSV");
		document.getElementById("mailmerge-message-source").selectedIndex = 0;
		
		document.getElementById("mailmerge-message-delivermode").appendItem(stringbundle.getString("mailmerge.dialog.delivermode.saveasdraft"), "SaveAsDraft");
		document.getElementById("mailmerge-message-delivermode").appendItem(stringbundle.getString("mailmerge.dialog.delivermode.sendlater"), "Later");
		document.getElementById("mailmerge-message-delivermode").appendItem(stringbundle.getString("mailmerge.dialog.delivermode.sendnow"), "Now");
		document.getElementById("mailmerge-message-delivermode").selectedIndex = 0;
		
		document.getElementById("mailmerge-cardbook-cardbook").appendItem(stringbundle.getString("mailmerge.dialog.addressbook"), "");
		if(window.opener.cardbookRepository) { mailmerge.cardbook(); }
		document.getElementById("mailmerge-cardbook-cardbook").selectedIndex = 0;
		
		document.getElementById("mailmerge-addressbook-addressbook").appendItem(stringbundle.getString("mailmerge.dialog.addressbook"), "");
		mailmerge.addressbook();
		document.getElementById("mailmerge-addressbook-addressbook").selectedIndex = 0;
		
		document.getElementById("mailmerge-csv-characterset").appendItem(stringbundle.getString("mailmerge.dialog.characterset.utf8"), "UTF-8");
		document.getElementById("mailmerge-csv-characterset").appendItem(stringbundle.getString("mailmerge.dialog.characterset.windows1252"), "Windows-1252");
		document.getElementById("mailmerge-csv-characterset").selectedIndex = 0;
		
		document.getElementById("mailmerge-csv-fielddelimiter").appendItem(",", ",", stringbundle.getString("mailmerge.dialog.fielddelimiter.comma"));
		document.getElementById("mailmerge-csv-fielddelimiter").appendItem(";", ";", stringbundle.getString("mailmerge.dialog.fielddelimiter.semicolon"));
		document.getElementById("mailmerge-csv-fielddelimiter").appendItem(":", ":", stringbundle.getString("mailmerge.dialog.fielddelimiter.colon"));
		document.getElementById("mailmerge-csv-fielddelimiter").appendItem("Tab", "\t", stringbundle.getString("mailmerge.dialog.fielddelimiter.tab"));
		document.getElementById("mailmerge-csv-fielddelimiter").selectedIndex = 0;
		
		document.getElementById("mailmerge-csv-textdelimiter").appendItem("\"", "\"", stringbundle.getString("mailmerge.dialog.textdelimiter.doublequote"));
		document.getElementById("mailmerge-csv-textdelimiter").appendItem("\'", "\'", stringbundle.getString("mailmerge.dialog.textdelimiter.singlequote"));
		document.getElementById("mailmerge-csv-textdelimiter").appendItem("", "", stringbundle.getString("mailmerge.dialog.textdelimiter.none"));
		document.getElementById("mailmerge-csv-textdelimiter").selectedIndex = 0;
		
		document.getElementById("mailmerge-sendlater-recur").appendItem(stringbundle.getString("mailmerge.dialog.recur.none"), "");
		document.getElementById("mailmerge-sendlater-recur").appendItem(stringbundle.getString("mailmerge.dialog.recur.daily"), "daily");
		document.getElementById("mailmerge-sendlater-recur").appendItem(stringbundle.getString("mailmerge.dialog.recur.weekly"), "weekly");
		document.getElementById("mailmerge-sendlater-recur").appendItem(stringbundle.getString("mailmerge.dialog.recur.monthly"), "monthly");
		document.getElementById("mailmerge-sendlater-recur").appendItem(stringbundle.getString("mailmerge.dialog.recur.yearly"), "yearly");
		document.getElementById("mailmerge-sendlater-recur").selectedIndex = 0;
		
		document.getElementById("mailmerge-message-source").value = prefs.getCharPref("source");
		document.getElementById("mailmerge-message-delivermode").value = prefs.getCharPref("delivermode");
		document.getElementById("mailmerge-message-attachments").value = prefs.getCharPref("attachments");
		document.getElementById("mailmerge-csv-characterset").value = prefs.getCharPref("characterset");
		document.getElementById("mailmerge-csv-fielddelimiter").value = prefs.getCharPref("fielddelimiter");
		document.getElementById("mailmerge-csv-textdelimiter").value = prefs.getCharPref("textdelimiter");
		document.getElementById("mailmerge-batch-start").value = prefs.getCharPref("start");
		document.getElementById("mailmerge-batch-stop").value = prefs.getCharPref("stop");
		document.getElementById("mailmerge-batch-pause").value = prefs.getCharPref("pause");
		document.getElementById("mailmerge-sendlater-at").value = prefs.getCharPref("at");
		document.getElementById("mailmerge-sendlater-recur").value = prefs.getCharPref("recur");
		document.getElementById("mailmerge-sendlater-every").value = prefs.getCharPref("every");
		document.getElementById("mailmerge-options-debug").checked = prefs.getBoolPref("debug");
		
		try {
			
			/* Thunderbird 52 */
			document.getElementById("mailmerge-cardbook-cardbook").value = prefs.getComplexValue("cardbook", Components.interfaces.nsISupportsString).data;
			document.getElementById("mailmerge-addressbook-addressbook").value = prefs.getComplexValue("addressbook", Components.interfaces.nsISupportsString).data;
			document.getElementById("mailmerge-csv-file").value = prefs.getComplexValue("file", Components.interfaces.nsISupportsString).data;
			
		} catch(e) {}
		
		try {
			
			/* Thunderbird 57 */
			document.getElementById("mailmerge-cardbook-cardbook").value = prefs.getStringPref("cardbook");
			document.getElementById("mailmerge-addressbook-addressbook").value = prefs.getStringPref("addressbook");
			document.getElementById("mailmerge-csv-file").value = prefs.getStringPref("file");
			
		} catch(e) {}
		
		mailmerge.update();
		
	},
	
	accept: function() {
		
		var prefs = Services.prefs.getBranch("extensions.mailmerge.");
		
		prefs.setCharPref("source", document.getElementById("mailmerge-message-source").value);
		prefs.setCharPref("delivermode", document.getElementById("mailmerge-message-delivermode").value);
		prefs.setCharPref("attachments", document.getElementById("mailmerge-message-attachments").value);
		prefs.setCharPref("characterset", document.getElementById("mailmerge-csv-characterset").value);
		prefs.setCharPref("fielddelimiter", document.getElementById("mailmerge-csv-fielddelimiter").value);
		prefs.setCharPref("textdelimiter", document.getElementById("mailmerge-csv-textdelimiter").value);
		prefs.setCharPref("start", document.getElementById("mailmerge-batch-start").value);
		prefs.setCharPref("stop", document.getElementById("mailmerge-batch-stop").value);
		prefs.setCharPref("pause", document.getElementById("mailmerge-batch-pause").value);
		prefs.setCharPref("at", document.getElementById("mailmerge-sendlater-at").value);
		prefs.setCharPref("recur", document.getElementById("mailmerge-sendlater-recur").value);
		prefs.setCharPref("every", document.getElementById("mailmerge-sendlater-every").value);
		prefs.setBoolPref("debug", document.getElementById("mailmerge-options-debug").checked);
		
		try {
			
			/* Thunderbird 52 */
			var string = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
			
			string.data = document.getElementById("mailmerge-cardbook-cardbook").value;
			prefs.setComplexValue("cardbook", Components.interfaces.nsISupportsString, string);
			
			string.data = document.getElementById("mailmerge-addressbook-addressbook").value;
			prefs.setComplexValue("addressbook", Components.interfaces.nsISupportsString, string);
			
			string.data = document.getElementById("mailmerge-csv-file").value;
			prefs.setComplexValue("file", Components.interfaces.nsISupportsString, string);
			
		} catch(e) {}
		
		try {
			
			/* Thunderbird 57 */
			prefs.setStringPref("cardbook", document.getElementById("mailmerge-cardbook-cardbook").value);
			prefs.setStringPref("addressbook", document.getElementById("mailmerge-addressbook-addressbook").value);
			prefs.setStringPref("file", document.getElementById("mailmerge-csv-file").value);
			
		} catch(e) {}
		
		window.arguments[0].accept = true;
		
	},
	
	help: function() {
		
		window.openDialog("chrome://mailmerge/content/about.xul", "_blank", "chrome,dialog,modal,centerscreen", null);
		
	},
	
	cardbook: function() {
		
		Components.utils.import("chrome://cardbook/content/cardbookRepository.js");
		
		var accounts = cardbookRepository.cardbookAccounts;
		for(var j = 0; j < accounts.length; j++) {
			
			var account = accounts[j];
			if(account[1] && account[5] && account[6] != "SEARCH") {
				
				document.getElementById("mailmerge-cardbook-cardbook").appendItem(account[0], account[4]);
				document.getElementById("mailmerge-cardbook-cardbook").selectedIndex = 0;
				
			}
			
		}
		
	},
	
	addressbook: function() {
		
		var addressbooks = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager).directories;
		while(addressbooks.hasMoreElements()) {
			
			try {
				
				var addressbook = addressbooks.getNext();
				addressbook.QueryInterface(Components.interfaces.nsIAbDirectory);
				
				addressbook.getCardFromProperty("PrimaryEmail", "", false);
				
				document.getElementById("mailmerge-addressbook-addressbook").appendItem(addressbook.dirName, addressbook.uuid);
				document.getElementById("mailmerge-addressbook-addressbook").selectedIndex = 0;
				
			} catch(e) {}
			
		}
		
	},
	
	browse: function() {
		
		var filePicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
		filePicker.init(window, "Mail Merge", Components.interfaces.nsIFilePicker.modeOpen);
		filePicker.appendFilter("CSV", "*.csv");
		filePicker.appendFilter("*", "*.*");
		
		filePicker.open(rv => {
			
			if(rv == Components.interfaces.nsIFilePicker.returnOK) {
				document.getElementById("mailmerge-csv-file").value = filePicker.file.path;
			}
			
		});
		
	},
	
	update: function() {
		
		document.getElementById("mailmerge-cardbook").hidden = !(document.getElementById("mailmerge-message-source").value == "Cardbook");
		document.getElementById("mailmerge-addressbook").hidden = !(document.getElementById("mailmerge-message-source").value == "AddressBook");
		document.getElementById("mailmerge-csv").hidden = !(document.getElementById("mailmerge-message-source").value == "CSV");
		document.getElementById("mailmerge-sendlater").hidden = !(document.getElementById("mailmerge-message-delivermode").value == "SaveAsDraft" && window.opener.Sendlater3Util);
		window.sizeToContent();
		
	}
	
}
