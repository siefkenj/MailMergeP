"use strict";
Components.utils.import("resource://gre/modules/Services.jsm");

window.addEventListener("load", function(event) { mailmerge.load(event); }, true);
window.addEventListener("unload", function(event) { mailmerge.unload(event); }, true);

window.addEventListener("compose-send-message", function(event) { mailmerge.check(event); }, true);

var mailmerge = {
	
	load: function(event) {
		
		window.isValidAddress = function(aAddress) {
			
			return (aAddress.includes("@") || (aAddress.includes("{{") && aAddress.includes("}}")));
			
		}
		
	},
	
	unload: function(event) {
		
	},
	
	init: function(event) {
		
		event.stopPropagation();
		
		/* addressinvalid start */
		try {
			
			Recipients2CompFields(gMsgCompose.compFields);
			if(gMsgCompose.compFields.to == "") {
				
				try {
					
					/* Thunderbird */
					var bundle = document.getElementById("bundle_composeMsgs");
					Services.prompt.alert(window, bundle.getString("addressInvalidTitle"), bundle.getString("noRecipients"));
					return;
					
				} catch(e) {}
				
				try {
					
					/* SeaMonkey */
					var bundle = document.getElementById("bundle_composeMsgs");
					Services.prompt.alert(window, "Mail Merge", bundle.getString("12511"));
					return;
					
				} catch(e) {}
				
			}
			
		} catch(e) {}
		/* addressinvalid end */
		
		/* subjectempty start */
		try {
			
			var subject = GetMsgSubjectElement().value;
			if(subject == "") {
				
				var bundle = document.getElementById("bundle_composeMsgs");
				var flags = (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) + (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1);
				
				if(Services.prompt.confirmEx(
					window,
					bundle.getString("subjectEmptyTitle"),
					bundle.getString("subjectEmptyMessage"),
					flags,
					bundle.getString("sendWithEmptySubjectButton"),
					bundle.getString("cancelSendingButton"),
					null, null, {value:0}) == 1)
				{
					return;
				}
				
			}
			
		} catch(e) {}
		/* subjectempty end */
		
		/* attachmentreminder start */
		try {
			
			if(gManualAttachmentReminder || (getPref("mail.compose.attachment_reminder_aggressive") && document.getElementById("attachmentNotificationBox").getNotificationWithValue("attachmentReminder"))) {
				
				var bundle = document.getElementById("bundle_composeMsgs");
				var flags = (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) + (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1);
				
				if(Services.prompt.confirmEx(
					window,
					bundle.getString("attachmentReminderTitle"),
					bundle.getString("attachmentReminderMsg"),
					flags,
					bundle.getString("attachmentReminderFalseAlarm"),
					bundle.getString("attachmentReminderYesIForgot"),
					null, null, {value:0}) == 1)
				{
					return;
				}
				
			}
			
		} catch(e) {}
		/* attachmentreminder end */
		
		/* spellcheck start */
		try {
			
			if(getPref("mail.SpellCheckBeforeSend")) {
				
				SetMsgBodyFrameFocus();
				
				window.cancelSendMessage = false;
				window.openDialog("chrome://editor/content/EdSpellCheck.xul", "_blank", "dialog,close,titlebar,modal,resizable", true, true, false);
				if(window.cancelSendMessage) { return; }
				
			}
			
		} catch(e) {}
		/* spellcheck end */
		
		/* dialog start */
		var params = { accept: false }
		window.openDialog("chrome://mailmerge/content/dialog.xul", "_blank", "chrome,dialog,modal,centerscreen", params);
		if(params.accept) {
			
			mailmerge.editor = gMsgCompose.editor.outputToString("text/html", 4);
			
			if(window.Enigmail) {
				
				var identity = getCurrentIdentity();
				var autoencryptdrafts = identity.getBoolAttribute("autoEncryptDrafts");
				
				identity.setBoolAttribute("autoEncryptDrafts", false);
				SaveAsTemplate();
				identity.setBoolAttribute("autoEncryptDrafts", autoencryptdrafts);
				
			}
			else {
				
				SaveAsTemplate();
				
			}
			
			window.setTimeout(function() { mailmerge.compose(); }, 1000);
			
		}
		/* dialog end */
		
	},
	
	compose: function() {
		
		try {
			
			/* Thunderbird */
			if(gSendOperationInProgress || gSaveOperationInProgress) { window.setTimeout(function() { mailmerge.compose(); }, 1000); return; }
			
		} catch(e) {}
		
		try {
			
			/* SeaMonkey */
			if(gSendOrSaveOperationInProgress) { window.setTimeout(function() { mailmerge.compose(); }, 1000); return; }
			
		} catch(e) {}
		
		(window.expandRecipients && window.expandRecipients() || gMsgCompose.expandMailingLists());
		
		window.openDialog("chrome://mailmerge/content/compose.xul", "_blank", "chrome,dialog,modal,centerscreen", null);
		window.close();
		
	},
	
	check: function(event) {
		
		var msgtype = document.getElementById("msgcomposeWindow").getAttribute("msgtype");
		if(msgtype != Components.interfaces.nsIMsgCompDeliverMode.Now && msgtype != Components.interfaces.nsIMsgCompDeliverMode.Later) { return; }
		
		var prefs = Services.prefs.getBranch("extensions.mailmerge.");
		if(prefs.getBoolPref("recipientsreminder")) {
			
			var recipients = gMsgCompose.compFields.splitRecipients(gMsgCompose.compFields.to, false, {});
			if(recipients.length > prefs.getIntPref("recipients")) {
				
				var bundle = document.getElementById("mailmerge-stringbundle");
				var flags = (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) + (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1) + (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_2);
				var check = { value : false };
				
				switch(Services.prompt.confirmEx(
					window,
					bundle.getString("mailmerge.overlay.recipients.title"),
					bundle.getString("mailmerge.overlay.recipients.message"),
					flags,
					bundle.getString("mailmerge.overlay.recipients.send"),
					bundle.getString("mailmerge.overlay.recipients.cancel"),
					"Mail Merge",
					bundle.getString("mailmerge.overlay.recipients.dontaskagain"),
					check))
				{
					
					case 0:
						
						prefs.setBoolPref("recipientsreminder", !check.value);
						break;
						
					case 1:
						
						event.preventDefault();
						event.stopPropagation();
						prefs.setBoolPref("recipientsreminder", !check.value);
						return;
						
					case 2:
						
						event.preventDefault();
						event.stopPropagation();
						prefs.setBoolPref("recipientsreminder", !check.value);
						window.setTimeout(function() { mailmerge.init(document.createEvent("XULCommandEvent")); }, 50);
						return;
						
					default:;
					
				}
				
			}
			
		}
		
		var prefs = Services.prefs.getBranch("extensions.mailmerge.");
		if(prefs.getBoolPref("variablesreminder")) {
			
			//var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}])", "g");
			//var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
			//var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
			//var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
			var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^{}]*)[}][}])", "g");
			
			var arrMatches = (objPattern.exec(gMsgCompose.compFields.to) || objPattern.exec(gMsgCompose.compFields.cc) || objPattern.exec(gMsgCompose.compFields.bcc) || objPattern.exec(gMsgCompose.compFields.replyTo) || objPattern.exec(gMsgCompose.compFields.subject) || objPattern.exec(gMsgCompose.editor.outputToString("text/html", 4)));
			if(arrMatches) {
				
				var bundle = document.getElementById("mailmerge-stringbundle");
				var flags = (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) + (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1) + (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_2);
				var check = { value : false };
				
				switch(Services.prompt.confirmEx(
					window,
					bundle.getString("mailmerge.overlay.variables.title"),
					bundle.getString("mailmerge.overlay.variables.message"),
					flags,
					bundle.getString("mailmerge.overlay.variables.send"),
					bundle.getString("mailmerge.overlay.variables.cancel"),
					"Mail Merge",
					bundle.getString("mailmerge.overlay.variables.dontaskagain"),
					check))
				{
					
					case 0:
						
						prefs.setBoolPref("variablesreminder", !check.value);
						break;
						
					case 1:
						
						event.preventDefault();
						event.stopPropagation();
						prefs.setBoolPref("variablesreminder", !check.value);
						return;
						
					case 2:
						
						event.preventDefault();
						event.stopPropagation();
						prefs.setBoolPref("variablesreminder", !check.value);
						window.setTimeout(function() { mailmerge.init(document.createEvent("XULCommandEvent")); }, 50);
						return;
						
					default:;
					
				}
				
			}
			
		}
		
	}
	
}
