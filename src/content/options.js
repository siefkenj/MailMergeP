"use strict";
Components.utils.import("resource://gre/modules/Services.jsm");

var mailmerge = {
	
	init: function() {
		
		var prefs = Services.prefs.getBranch("extensions.mailmerge.");
		
		document.getElementById("mailmerge-options-recipientsreminder").checked = prefs.getBoolPref("recipientsreminder");
		document.getElementById("mailmerge-options-variablesreminder").checked = prefs.getBoolPref("variablesreminder");
		
	},
	
	accept: function() {
		
		var prefs = Services.prefs.getBranch("extensions.mailmerge.");
		
		prefs.setBoolPref("recipientsreminder", document.getElementById("mailmerge-options-recipientsreminder").checked);
		prefs.setBoolPref("variablesreminder", document.getElementById("mailmerge-options-variablesreminder").checked);
		
	},
	
	help: function() {
		
		window.openDialog("chrome://mailmerge/content/about.xul", "_blank", "chrome,dialog,modal,centerscreen", null);
		
	}
	
}
