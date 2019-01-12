"use strict";
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/jsmime.jsm");
Components.utils.import("resource:///modules/mailServices.js");

var gMsgCompose = window.opener.gMsgCompose;
gMsgCompose.compFields.body = window.opener.mailmerge.editor;

var gProgressListener = {
	
	onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
		
		//mailmerge.debug("gProgressListener: onStateChange" + "\n" + aWebProgress + "\n" + aRequest + "\n" + aStateFlags + "\n" + aStatus);
		
	},
	
	onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {
		
		//mailmerge.debug("gProgressListener: onProgressChange" + "\n" + aWebProgress + "\n" + aRequest + "\n" + aCurSelfProgress + "\n" + aMaxSelfProgress + "\n" + aCurTotalProgress + "\n" + aMaxTotalProgress);
		
	},
	
	onLocationChange: function(aWebProgress, aRequest, aLocation) {
		
		//mailmerge.debug("gProgressListener: onLocationChange" + "\n" + aWebProgress + "\n" + aRequest + "\n" + aLocation);
		
	},
	
	onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage) {
		
		//mailmerge.debug("gProgressListener: onStatusChange" + "\n" + aWebProgress + "\n" + aRequest + "\n" + aStatus + "\n" + aMessage);
		
		document.getElementById("mailmerge-status").value = aMessage;
		var string = window.opener.document.getElementById("bundle_composeMsgs").getString("copyMessageComplete");
		if(string == aMessage) { mailmerge.connections--; }
		
	},
	
	onSecurityChange: function(aWebProgress, aRequest, aState) {
		
		//mailmerge.debug("gProgressListener: onSecurityChange" + "\n" + aWebProgress + "\n" + aRequest + "\n" + aState);
		
	}
	
}

var mailmerge = {
	
	init: function() {
		
		/* prefs start */
		mailmerge.prefs();
		/* prefs end */
		
		/* dialog start */
		var dialog = "";
		dialog += "source: " + mailmerge.prefs.source + "\n";
		dialog += "delivermode: " + mailmerge.prefs.delivermode + "\n";
		dialog += "attachments: " + mailmerge.prefs.attachments + "\n";
		dialog += "cardbook: " + mailmerge.prefs.cardbook + "\n";
		dialog += "addressbook: " + mailmerge.prefs.addressbook + "\n";
		dialog += "file: " + mailmerge.prefs.file + "\n";
		dialog += "characterset: " + mailmerge.prefs.characterset + "\n";
		dialog += "fielddelimiter: " + mailmerge.prefs.fielddelimiter + "\n";
		dialog += "textdelimiter: " + mailmerge.prefs.textdelimiter + "\n";
		dialog += "start: " + mailmerge.prefs.start + "\n";
		dialog += "stop: " + mailmerge.prefs.stop + "\n";
		dialog += "pause: " + mailmerge.prefs.pause + "\n";
		dialog += "at: " + mailmerge.prefs.at + "\n";
		dialog += "recur: " + mailmerge.prefs.recur + "\n";
		dialog += "every: " + mailmerge.prefs.every + "\n";
		dialog += "connections: " + mailmerge.prefs.connections + "\n";
		dialog += "debug: " + mailmerge.prefs.debug + "\n";
		mailmerge.debug("Mail Merge: Dialog" + "\n" + dialog);
		/* dialog end */
		
		/* debug start */
		mailmerge.debug("Mail Merge: From" + "\n" + gMsgCompose.compFields.from);
		mailmerge.debug("Mail Merge: To" + "\n" + gMsgCompose.compFields.to);
		mailmerge.debug("Mail Merge: Cc" + "\n" + gMsgCompose.compFields.cc);
		mailmerge.debug("Mail Merge: Bcc" + "\n" + gMsgCompose.compFields.bcc);
		mailmerge.debug("Mail Merge: Reply" + "\n" + gMsgCompose.compFields.replyTo);
		mailmerge.debug("Mail Merge: Subject" + "\n" + gMsgCompose.compFields.subject);
		mailmerge.debug("Mail Merge: Body" + "\n" + gMsgCompose.compFields.body);
		/* debug end */
		
		/* source start */
		switch(mailmerge.prefs.source) {
			
			case "Cardbook":
				
				mailmerge.cardbook();
				break;
				
			case "AddressBook":
				
				mailmerge.addressbook();
				break;
				
			case "CSV":
				
				mailmerge.csv();
				break;
				
			default:;
			
		}
		/* source end */
		
		/* batch start */
		mailmerge.start = (mailmerge.prefs.start == "") ? 1 : Math.max(1, Math.min(mailmerge.to.length - 1, parseInt(mailmerge.prefs.start)));
		mailmerge.stop = (mailmerge.prefs.stop == "") ? mailmerge.to.length - 1 : Math.max(1, Math.min(mailmerge.to.length - 1, parseInt(mailmerge.prefs.stop)));
		mailmerge.index = mailmerge.start - 1;
		/* batch end */
		
		/* connections start */
		mailmerge.connections = 0;
		/* connections end */
		
		/* time start */
		var time = new Date();
		mailmerge.time(time, time);
		window.setInterval(function() { mailmerge.time(time, new Date()); }, 1000);
		/* time end */
		
		window.setTimeout(function() { mailmerge.compose(); }, 50);
		
	},
	
	prefs: function() {
		
		var prefs = Services.prefs.getBranch("extensions.mailmerge.");
		
		mailmerge.prefs.source = prefs.getCharPref("source");
		mailmerge.prefs.delivermode = prefs.getCharPref("delivermode");
		mailmerge.prefs.attachments = prefs.getCharPref("attachments");
		mailmerge.prefs.characterset = prefs.getCharPref("characterset");
		mailmerge.prefs.fielddelimiter = prefs.getCharPref("fielddelimiter");
		mailmerge.prefs.textdelimiter = prefs.getCharPref("textdelimiter");
		mailmerge.prefs.start = prefs.getCharPref("start");
		mailmerge.prefs.stop = prefs.getCharPref("stop");
		mailmerge.prefs.pause = prefs.getCharPref("pause");
		mailmerge.prefs.at = prefs.getCharPref("at");
		mailmerge.prefs.recur = prefs.getCharPref("recur");
		mailmerge.prefs.every = prefs.getCharPref("every");
		mailmerge.prefs.connections = prefs.getIntPref("connections");
		mailmerge.prefs.debug = prefs.getBoolPref("debug");
		
		try {
			
			/* Thunderbird 52 */
			mailmerge.prefs.cardbook = prefs.getComplexValue("cardbook", Components.interfaces.nsISupportsString).data;
			mailmerge.prefs.addressbook = prefs.getComplexValue("addressbook", Components.interfaces.nsISupportsString).data;
			mailmerge.prefs.file = prefs.getComplexValue("file", Components.interfaces.nsISupportsString).data;
			
		} catch(e) {}
		
		try {
			
			/* Thunderbird 57 */
			mailmerge.prefs.cardbook = prefs.getStringPref("cardbook");
			mailmerge.prefs.addressbook = prefs.getStringPref("addressbook");
			mailmerge.prefs.file = prefs.getStringPref("file");
			
		} catch(e) {}
		
	},
	
	time: function(start, stop) {
		
		var time = Math.round((stop - start) / 1000);
		
		var hours = Math.floor(time / 3600);
		if(hours < 10) { hours = "0" + hours; }
		
		var minutes = Math.floor(time % 3600 / 60);
		if(minutes < 10) { minutes = "0" + minutes; }
		
		var seconds = Math.floor(time % 3600 % 60);
		if(seconds < 10) { seconds = "0" + seconds; }
		
		document.getElementById("mailmerge-time").value = hours + ":" + minutes + ":" + seconds;
		
	},
	
	update: function() {
		
		var current = mailmerge.index - mailmerge.start + 1;
		document.getElementById("mailmerge-current").value = current;
		
		var total = mailmerge.stop - mailmerge.start + 1;
		document.getElementById("mailmerge-total").value = total;
		
		var progress = Math.round(current / total * 100);
		document.getElementById("mailmerge-progress").value = progress + " " + "%";
		document.getElementById("mailmerge-progressmeter").value = progress;
		
		var status = "";
		document.getElementById("mailmerge-status").value = status;
		
	},
	
	cardbook: function() {
		
		mailmerge.to = [""];
		mailmerge.object = [""];
		
		/* to start */
		var to = gMsgCompose.compFields.to;
		to = jsmime.headerparser.decodeRFC2047Words(to);
		to = gMsgCompose.compFields.splitRecipients(to, false, {});
		/* to end */
		
		/* array start */
		for(var i = 0; i < to.length; i++) {
			
			if(to[i].includes("{{") && to[i].includes("}}")) {
				
				/* cardbook start */
				try {
					
					Components.utils.import("chrome://cardbook/content/cardbookRepository.js");
					
					var accounts = cardbookRepository.cardbookAccounts;
					for(var j = 0; j < accounts.length; j++) {
						
						var account = accounts[j];
						if(account[1] && account[5] && account[6] != "SEARCH") {
							
							if(mailmerge.prefs.cardbook && mailmerge.prefs.cardbook != account[4]) { continue; }
							
							var cards = (cardbookRepository.cardbookDisplayCards[account[4]].cards || cardbookRepository.cardbookDisplayCards[account[4]]);
							for(var k = 0; k < cards.length; k++) {
								
								var recipient = to[i];
								recipient = recipient.replace(new RegExp(' <>', 'g'), '');
								recipient = mailmerge.substitute(recipient, cards[k]);
								
								if(recipient.includes("@")) {
									
									mailmerge.to.push(recipient);
									mailmerge.object.push(cards[k]);
									
								}
								
							}
							
						}
						
					}
					
				} catch(e) {
					
					window.setTimeout(function() { mailmerge.error(e); }, 1000);
					return;
					
				}
				/* cardbook end */
				
			}
			
			if(to[i].includes("@")) {
				
				var objPattern = new RegExp("\\s*(?:(.*) <(.*)>|(.*))\\s*", "g");
				var arrMatches = objPattern.exec(to[i]);
				arrMatches = (arrMatches[2] || arrMatches[3]);
				
				/* cardbook start */
				try {
					
					Components.utils.import("chrome://cardbook/content/cardbookRepository.js");
					
					var accounts = cardbookRepository.cardbookAccounts;
					for(var j = 0; j < accounts.length; j++) {
						
						var account = accounts[j];
						if(account[1] && account[5] && account[6] != "SEARCH") {
							
							if(mailmerge.prefs.cardbook && mailmerge.prefs.cardbook != account[4]) { continue; }
							
							var cards = (cardbookRepository.cardbookDisplayCards[account[4]].cards || cardbookRepository.cardbookDisplayCards[account[4]]);
							var card = cards.filter(function(element) { for(var i = 0; i < element.email.length; i++) { if(element.email[i][0][0].toLowerCase() == arrMatches.toLowerCase()) { return true; } } })[0];
							if(card) { break; }
							
						}
						
					}
					
				} catch(e) {
					
					window.setTimeout(function() { mailmerge.error(e); }, 1000);
					return;
					
				}
				/* cardbook end */
				
				mailmerge.to.push(to[i]);
				mailmerge.object.push(card);
				
			}
			
		}
		/* array end */
		
	},
	
	addressbook: function() {
		
		mailmerge.to = [""];
		mailmerge.object = [""];
		
		/* to start */
		var to = gMsgCompose.compFields.to;
		to = jsmime.headerparser.decodeRFC2047Words(to);
		to = gMsgCompose.compFields.splitRecipients(to, false, {});
		/* to end */
		
		/* array start */
		for(var i = 0; i < to.length; i++) {
			
			if(to[i].includes("{{") && to[i].includes("}}")) {
				
				/* addressbook start */
				try {
					
					var addressbooks = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager).directories;
					while(addressbooks.hasMoreElements()) {
						
						try {
							
							var addressbook = addressbooks.getNext();
							addressbook.QueryInterface(Components.interfaces.nsIAbDirectory);
							
							if(mailmerge.prefs.addressbook && mailmerge.prefs.addressbook != addressbook.uuid) { continue; }
							
							var cards = addressbook.childCards;
							while(cards.hasMoreElements()) {
								
								var card = cards.getNext();
								card.QueryInterface(Components.interfaces.nsIAbCard);
								
								if(card.isMailList) { continue; }
								
								var recipient = to[i];
								recipient = recipient.replace(new RegExp(' <>', 'g'), '');
								recipient = mailmerge.substitute(recipient, card);
								
								if(recipient.includes("@")) {
									
									mailmerge.to.push(recipient);
									mailmerge.object.push(card);
									
								}
								
							}
							
						} catch(e) {}
						
					}
					
				} catch(e) {
					
					window.setTimeout(function() { mailmerge.error(e); }, 1000);
					return;
					
				}
				/* addressbook end */
				
			}
			
			if(to[i].includes("@")) {
				
				var objPattern = new RegExp("\\s*(?:(.*) <(.*)>|(.*))\\s*", "g");
				var arrMatches = objPattern.exec(to[i]);
				arrMatches = (arrMatches[2] || arrMatches[3]);
				
				/* addressbook start */
				try {
					
					var addressbooks = Components.classes["@mozilla.org/abmanager;1"].getService(Components.interfaces.nsIAbManager).directories;
					while(addressbooks.hasMoreElements()) {
						
						try {
							
							var addressbook = addressbooks.getNext();
							addressbook.QueryInterface(Components.interfaces.nsIAbDirectory);
							
							if(mailmerge.prefs.addressbook && mailmerge.prefs.addressbook != addressbook.uuid) { continue; }
							
							var card = addressbook.getCardFromProperty("PrimaryEmail", arrMatches, false);
							if(card) { break; }
							
						} catch(e) {}
						
					}
					
				} catch(e) {
					
					window.setTimeout(function() { mailmerge.error(e); }, 1000);
					return;
					
				}
				/* addressbook end */
				
				mailmerge.to.push(to[i]);
				mailmerge.object.push(card);
				
			}
			
		}
		/* array end */
		
	},
	
	csv: function() {
		
		mailmerge.to = [""];
		mailmerge.object = [""];
		
		/* file start */
		try {
			
			/* compatibility start */
			mailmerge.prefs.file = mailmerge.prefs.file.replace(new RegExp('"', 'g'), '');
			mailmerge.prefs.file = mailmerge.prefs.file.replace(new RegExp('\\s+$', 'g'), '');
			mailmerge.prefs.file = mailmerge.prefs.file.replace(new RegExp('^\\s+', 'g'), '');
			mailmerge.prefs.file = mailmerge.prefs.file.replace(new RegExp('^file\:\/\/', 'g'), '');
			/* compatibility end */
			
			var localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
			localFile.initWithPath(mailmerge.prefs.file);
			
			var fileInputStream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
			fileInputStream.init(localFile, -1, 0, 0);
			
			var converterInputStream = Components.classes["@mozilla.org/intl/converter-input-stream;1"].createInstance(Components.interfaces.nsIConverterInputStream);
			converterInputStream.init(fileInputStream, mailmerge.prefs.characterset, 0, 0);
			
			var file = "", string = {};
			while(converterInputStream.readString(4096, string) != 0) {
				file += string.value;
			}
			
			converterInputStream.close();
			
		} catch(e) {
			
			window.setTimeout(function() { mailmerge.error(e); }, 1000);
			return;
			
		}
		/* file end */
		
		mailmerge.debug("Mail Merge: File" + "\n" + file);
		file = mailmerge.file(file, mailmerge.prefs.fielddelimiter, mailmerge.prefs.textdelimiter);
		
		/* array start */
		for(var row = 1; row < file.length; row++) {
			
			/* object start */
			var object = {};
			for(var column = 0; column < file[0].length; column++) {
				
				if(file[0][column] == "") { continue; }
				object[file[0][column]] = (file[row][column] || "");
				
			}
			/* object end */
			
			/* to start */
			var to = gMsgCompose.compFields.to;
			to = jsmime.headerparser.decodeRFC2047Words(to);
			to = mailmerge.substitute(to, object);
			/* to end */
			
			if(to.includes("@")) {
				
				mailmerge.to.push(to);
				mailmerge.object.push(object);
				
			}
			
		}
		/* array end */
		
	},
	
	file: function(string, fielddelimiter, textdelimiter) {
		
		/*
			Thanks to Ben Nadel
			http://www.bennadel.com/
		*/
		
		/*
			/(^|,|\r\n|\r|\n)(?:["]([^"]*(?:["]["][^"]*)*)["]|([^,"\r\n]*))/g
			/(^|,|\r\n|\r|\n)(?:[']([^']*(?:[']['][^']*)*)[']|([^,'\r\n]*))/g
			
			/(^|;|\r\n|\r|\n)(?:["]([^"]*(?:["]["][^"]*)*)["]|([^;"\r\n]*))/g
			/(^|;|\r\n|\r|\n)(?:[']([^']*(?:[']['][^']*)*)[']|([^;'\r\n]*))/g
			
			/(^|:|\r\n|\r|\n)(?:["]([^"]*(?:["]["][^"]*)*)["]|([^:"\r\n]*))/g
			/(^|:|\r\n|\r|\n)(?:[']([^']*(?:[']['][^']*)*)[']|([^:'\r\n]*))/g
		*/
		
		/* compatibility start */
		if(string == "") { return [[]]; }
		/* compatibility end */
		
		var objPattern = new RegExp("(\r\n|\r|\n|" + fielddelimiter + "|^)(?:[" + textdelimiter + "]([^" + textdelimiter + "]*(?:[" + textdelimiter + "][" + textdelimiter + "][^" + textdelimiter + "]*)*)[" + textdelimiter + "]|([^" + fielddelimiter + textdelimiter + "\r\n]*))", "g");
		
		var arrData = [], arrMatches = [];
		while(arrMatches = objPattern.exec(string)) {
			
			var strMatchedValue = "";
			
			if(arrMatches[1] == fielddelimiter && arrMatches.index == 0) {
				arrData.push([]);
				arrData[arrData.length - 1].push(strMatchedValue);
			}
			
			if(arrMatches[1] != fielddelimiter) {
				arrData.push([]);
			}
			
			if(arrMatches[2]) {
				strMatchedValue = arrMatches[2].replace(new RegExp(textdelimiter + textdelimiter, "g"), textdelimiter);
			}
			
			if(arrMatches[3]) {
				strMatchedValue = arrMatches[3];
			}
			
			arrData[arrData.length - 1].push(strMatchedValue);
			
		}
		
		/* compatibility start */
		for(var row = 0; row < arrData[0].length; row++) {
			
			arrData[0][row] = arrData[0][row].replace(new RegExp('[{]', 'g'), '');
			arrData[0][row] = arrData[0][row].replace(new RegExp('[|]', 'g'), '');
			arrData[0][row] = arrData[0][row].replace(new RegExp('[}]', 'g'), '');
			
		}
		/* compatibility end */
		
		return arrData;
		
	},
	
	compose: function() {
		
		if(mailmerge.connections == mailmerge.prefs.connections) { window.setTimeout(function() { mailmerge.compose(); }, 50); return; }
		
		/* update start */
		mailmerge.update();
		/* update end */
		
		/* index start */
		mailmerge.index++;
		if(mailmerge.index > mailmerge.stop) { window.setTimeout(function() { window.close(); }, 1000); return; }
		/* index end */
		
		/* object start */
		var object = mailmerge.object[mailmerge.index];
		/* object end */
		
		/* from start */
		try {
			
			var from = gMsgCompose.compFields.from;
			from = jsmime.headerparser.decodeRFC2047Words(from);
			from = from.replace(new RegExp('<"', 'g'), '<');
			from = from.replace(new RegExp('">', 'g'), '>');
			from = mailmerge.substitute(from, object);
			from = MailServices.headerParser.makeFromDisplayAddress(from);
			from = MailServices.headerParser.makeMimeHeader(from, from.length);
			
		} catch(e) {}
		/* from end */
		
		/* to start */
		try {
			
			var to = mailmerge.to[mailmerge.index];
			to = jsmime.headerparser.decodeRFC2047Words(to);
			to = to.replace(new RegExp('<"', 'g'), '<');
			to = to.replace(new RegExp('">', 'g'), '>');
			to = mailmerge.substitute(to, object);
			to = MailServices.headerParser.makeFromDisplayAddress(to);
			to = MailServices.headerParser.makeMimeHeader(to, to.length);
			
		} catch(e) {}
		/* to end */
		
		/* cc start */
		try {
			
			var cc = gMsgCompose.compFields.cc;
			cc = jsmime.headerparser.decodeRFC2047Words(cc);
			cc = cc.replace(new RegExp('<"', 'g'), '<');
			cc = cc.replace(new RegExp('">', 'g'), '>');
			cc = mailmerge.substitute(cc, object);
			cc = MailServices.headerParser.makeFromDisplayAddress(cc);
			cc = MailServices.headerParser.makeMimeHeader(cc, cc.length);
			
		} catch(e) {}
		/* cc end */
		
		/* bcc start */
		try {
			
			var bcc = gMsgCompose.compFields.bcc;
			bcc = jsmime.headerparser.decodeRFC2047Words(bcc);
			bcc = bcc.replace(new RegExp('<"', 'g'), '<');
			bcc = bcc.replace(new RegExp('">', 'g'), '>');
			bcc = mailmerge.substitute(bcc, object);
			bcc = MailServices.headerParser.makeFromDisplayAddress(bcc);
			bcc = MailServices.headerParser.makeMimeHeader(bcc, bcc.length);
			
		} catch(e) {}
		/* bcc end */
		
		/* reply start */
		try {
			
			var reply = gMsgCompose.compFields.replyTo;
			reply = jsmime.headerparser.decodeRFC2047Words(reply);
			reply = reply.replace(new RegExp('<"', 'g'), '<');
			reply = reply.replace(new RegExp('">', 'g'), '>');
			reply = mailmerge.substitute(reply, object);
			reply = MailServices.headerParser.makeFromDisplayAddress(reply);
			reply = MailServices.headerParser.makeMimeHeader(reply, reply.length);
			
		} catch(e) {}
		/* reply end */
		
		/* subject start */
		var subject = gMsgCompose.compFields.subject;
		subject = mailmerge.substitute(subject, object);
		/* subject end */
		
		/* body start */
		var body = gMsgCompose.compFields.body;
		body = body.replace(new RegExp('%7B', 'g'), '{');
		body = body.replace(new RegExp('%7C', 'g'), '|');
		body = body.replace(new RegExp('%7D', 'g'), '}');
		body = mailmerge.substitute(body, object);
		/* body end */
		
		/* attachments start */
		var attachments = mailmerge.prefs.attachments;
		attachments = mailmerge.substitute(attachments, object);
		/* attachments end */
		
		/* at start */
		var at = mailmerge.prefs.at;
		at = mailmerge.substitute(at, object);
		/* at end */
		
		/* customheaders start */
		var customheaders = [];
		try {
			
			/* Thunderbird */
			var header = Services.prefs.getCharPref("mail.compose.other.header").split(",");
			for(var i = 0; i < header.length; i++) {
				
				if(gMsgCompose.compFields.hasHeader(header[i])) {
					customheaders.push({ name: header[i], value: mailmerge.substitute(gMsgCompose.compFields.getHeader(header[i]), object) });
				}
				
			}
			
		} catch(e) {}
		/* customheaders end */
		
		/* pause start */
		var pause = mailmerge.prefs.pause;
		pause = mailmerge.substitute(pause, object);
		pause = pause.split("-").sort();
		pause[0] = (parseInt(pause[0]) || "");
		pause[1] = (parseInt(pause[1]) || "");
		pause = (pause[0] == "") ? 50 : Math.floor(Math.random() * ((pause[1] || pause[0]) - pause[0] + 1) + pause[0]) * 1000;
		/* pause end */
		
		window.setTimeout(function() { mailmerge.send(from, to, cc, bcc, reply, subject, body, attachments, at, customheaders); }, pause);
		
	},
	
	send: function(from, to, cc, bcc, reply, subject, body, attachments, at, customheaders) {
		
		/* update start */
		mailmerge.update();
		/* update end */
		
		/* progress start */
		var progress = Components.classes["@mozilla.org/messenger/progress;1"].createInstance(Components.interfaces.nsIMsgProgress);
		progress.registerListener(gProgressListener);
		/* progress end */
		
		/* compfields start */
		var compFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);
		/* compfields end */
		
		/* composeparams start */
		var composeParams = Components.classes["@mozilla.org/messengercompose/composeparams;1"].createInstance(Components.interfaces.nsIMsgComposeParams);
		composeParams.type = Components.interfaces.nsIMsgCompType.New;
		composeParams.format = (gMsgCompose.composeHTML) ? Components.interfaces.nsIMsgCompFormat.HTML : Components.interfaces.nsIMsgCompFormat.PlainText;
		composeParams.identity = gMsgCompose.identity;
		composeParams.composeFields = compFields;
		/* composeparams end */
		
		/* compose start */
		var compose = Components.classes["@mozilla.org/messengercompose/compose;1"].createInstance(Components.interfaces.nsIMsgCompose);
		compose.initialize(composeParams);
		/* compose end */
		
		/* compfields start */
		compFields.from = from;
		compFields.to = to;
		compFields.cc = cc;
		compFields.bcc = bcc;
		compFields.replyTo = reply;
		compFields.subject = subject;
		/* compfields end */
		
		/* compfields start */
		compFields.attachVCard = gMsgCompose.compFields.attachVCard;
		compFields.characterSet = gMsgCompose.compFields.characterSet;
		compFields.DSN = gMsgCompose.compFields.DSN;
		compFields.organization = gMsgCompose.compFields.organization;
		compFields.priority = gMsgCompose.compFields.priority;
		compFields.returnReceipt = gMsgCompose.compFields.returnReceipt;
		compFields.securityInfo = gMsgCompose.compFields.securityInfo;
		/* compfields end */
		
		/* customheaders start */
		try {
			
			/* Thunderbird */
			for(var i = 0; i < customheaders.length; i++) {
				
				compFields.setHeader(customheaders[i].name, customheaders[i].value);
				
			}
			
		} catch(e) {}
		/* customheaders end */
		
		/* sendlater start */
		if(mailmerge.prefs.delivermode == "SaveAsDraft" && window.opener.Sendlater3Util && at) {
			
			try {
				
				Components.utils.import("resource://sendlater3/dateparse.jsm");
				
				var recur = mailmerge.prefs.recur;
				if(recur == "monthly") {
					recur += " " + sendlater3DateParse(at).getDate();
				}
				if(recur == "yearly") {
					recur += " " + sendlater3DateParse(at).getMonth() + " " + sendlater3DateParse(at).getDate();
				}
				
				var every = mailmerge.prefs.every;
				if(every) {
					every = " " + "/" + " " + parseInt(every);
				}
				
				try {
					
					/* Thunderbird */
					compFields.setHeader("X-Send-Later-At", window.opener.Sendlater3Util.FormatDateTime(sendlater3DateParse(at), true));
					compFields.setHeader("X-Send-Later-Uuid", window.opener.Sendlater3Util.getInstanceUuid());
					compFields.setHeader("X-Send-Later-Recur", recur + every);
					
				} catch(e) {}
				
				try {
					
					/* SeaMonkey */
					compFields.otherRandomHeaders += "X-Send-Later-At: " + window.opener.Sendlater3Util.FormatDateTime(sendlater3DateParse(at), true) + "\r\n";
					compFields.otherRandomHeaders += "X-Send-Later-Uuid: " + window.opener.Sendlater3Util.getInstanceUuid() + "\r\n";
					compFields.otherRandomHeaders += "X-Send-Later-Recur: " + recur + every + "\r\n";
					
				} catch(e) {}
				
			} catch(e) {
				
				window.setTimeout(function() { mailmerge.error(e); }, 1000);
				return;
				
			}
			
		}
		/* sendlater end */
		
		/* attachments start */
		var bucket = window.opener.document.getElementById("attachmentBucket");
		for(var i = 0; i < bucket.itemCount; i++) {
			
			try {
				
				compFields.addAttachment(bucket.getItemAtIndex(i).attachment);
				
			} catch(e) {
				
				window.setTimeout(function() { mailmerge.error(e); }, 1000);
				return;
				
			}
			
		}
		/* attachments end */
		
		/* attachments start */
		var objPattern = new RegExp('("[^"]+"|[^",]+)', 'g');
		var arrMatches = [];
		while(arrMatches = objPattern.exec(attachments)) {
			
			try {
				
				var file = arrMatches[0];
				
				/* compatibility start */
				file = file.replace(new RegExp('"', 'g'), '');
				file = file.replace(new RegExp('\\s+$', 'g'), '');
				file = file.replace(new RegExp('^\\s+', 'g'), '');
				file = file.replace(new RegExp('^file\:\/\/', 'g'), '');
				/* compatibility end */
				
				var localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsIFile);
				localFile.initWithPath(file);
				
				if(!localFile.exists() || !localFile.isFile()) { continue; }
				
				var attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
				attachment.url = "file://" + file;
				
				compFields.addAttachment(attachment);
				
			} catch(e) {}
			
		}
		/* attachments end */
		
		/* delivermode start */
		var delivermode;
		switch(mailmerge.prefs.delivermode) {
			
			case "SaveAsDraft":
				
				delivermode = Components.interfaces.nsIMsgCompDeliverMode.SaveAsDraft;
				break;
				
			case "Later":
				
				delivermode = Components.interfaces.nsIMsgCompDeliverMode.Later;
				break;
				
			case "Now":
				
				delivermode = Components.interfaces.nsIMsgCompDeliverMode.Now;
				break;
				
			default:;
			
		}
		/* delivermode end */
		
		/* format start */
		var format = window.opener.DetermineHTMLAction(window.opener.DetermineConvertibility());
		switch(format) {
			
			case Components.interfaces.nsIMsgCompSendFormat.Both:
				
				compFields.forcePlainText = false;
				compFields.useMultipartAlternative = true;
				break;
				
			case Components.interfaces.nsIMsgCompSendFormat.HTML:
				
				compFields.forcePlainText = false;
				compFields.useMultipartAlternative = false;
				break;
				
			case Components.interfaces.nsIMsgCompSendFormat.PlainText:
				
				compFields.forcePlainText = true;
				compFields.useMultipartAlternative = false;
				break;
				
			default:;
			
		}
		/* format end */
		
		/* editor start */
		try {
			
			compose.initEditor(gMsgCompose.editor, window.opener.content);
			
			compose.editor.QueryInterface(Components.interfaces.nsIHTMLEditor);
			compose.editor.rebuildDocumentFromSource(body);
			
		} catch(e) {
			
			window.setTimeout(function() { mailmerge.error(e); }, 1000);
			return;
			
		}
		/* editor end */
		
		try {
			
			mailmerge.connections++;
			compose.SendMsg(delivermode, window.opener.getCurrentIdentity(), window.opener.getCurrentAccountKey(), null, progress);
			
		} catch(e) {
			
			window.setTimeout(function() { mailmerge.error(e); }, 1000);
			return;
			
		}
		
		/* editor start */
		try {
			
			gMsgCompose.editor.QueryInterface(Components.interfaces.nsIHTMLEditor);
			gMsgCompose.editor.rebuildDocumentFromSource(gMsgCompose.compFields.body);
			
		} catch(e) {
			
			window.setTimeout(function() { mailmerge.error(e); }, 1000);
			return;
			
		}
		/* editor end */
		
		window.setTimeout(function() { mailmerge.compose(); }, 50);
		
	},
	
	substitute: function(string, object) {
		
		//var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}])", "g");
		//var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
		//var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
		//var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}])", "g");
		var objPattern = new RegExp("(?:[{][{]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[|]([^|{}]*)[}][}]|[{][{]([^{}]*)[}][}])", "g");
		
		var arrMatches = objPattern.exec(string);
		if(!arrMatches) { return string; }
		
		/* workaround start */
		for(var i = 1; i < arrMatches.length; i++) {
			
			if(!arrMatches[i]) { continue; }
			arrMatches[i] = arrMatches[i].replace(new RegExp('\n(  )*', 'g'), ' ');
			
		}
		/* workaround end */
		
		if(mailmerge.prefs.source == "Cardbook" && object) {
			
			var card = object;
			
			if(arrMatches[1]) {
				
				/* {{name}} */
				string = string.replace(arrMatches[0], mailmerge.split(card, arrMatches[1]));
				return mailmerge.substitute(string, card);
				
			}
			
			if(arrMatches[2]) {
				
				/* {{name|if|then}} */
				string = (mailmerge.split(card, arrMatches[2]) == arrMatches[3]) ? string.replace(arrMatches[0], arrMatches[4]) : string.replace(arrMatches[0], "");
				return mailmerge.substitute(string, card);
				
			}
			
			if(arrMatches[5]) {
				
				/* {{name|if|then|else}} */
				string = (mailmerge.split(card, arrMatches[5]) == arrMatches[6]) ? string.replace(arrMatches[0], arrMatches[7]) : string.replace(arrMatches[0], arrMatches[8]);
				return mailmerge.substitute(string, card);
				
			}
			
			if(arrMatches[9]) {
				
				if(arrMatches[10] == "*") {
					
					/* {{name|*|if|then|else}} */
					string = (mailmerge.split(card, arrMatches[9]).match(arrMatches[11])) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == "^") {
					
					/* {{name|^|if|then|else}} */
					string = (mailmerge.split(card, arrMatches[9]).match("^" + arrMatches[11])) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == "$") {
					
					/* {{name|$|if|then|else}} */
					string = (mailmerge.split(card, arrMatches[9]).match(arrMatches[11] + "$")) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
			}
			
			if(arrMatches[9]) {
				
				if(arrMatches[10] == "==") {
					
					/* {{name|==|if|then|else}} */
					string = (parseFloat(mailmerge.split(card, arrMatches[9]).replace(",",".")) == parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == ">" || arrMatches[10] == "&gt;") {
					
					/* {{name|>|if|then|else}} */
					string = (parseFloat(mailmerge.split(card, arrMatches[9]).replace(",",".")) > parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == ">=" || arrMatches[10] == "&gt;=") {
					
					/* {{name|>=|if|then|else}} */
					string = (parseFloat(mailmerge.split(card, arrMatches[9]).replace(",",".")) >= parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == "<" || arrMatches[10] == "&lt;") {
					
					/* {{name|<|if|then|else}} */
					string = (parseFloat(mailmerge.split(card, arrMatches[9]).replace(",",".")) < parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == "<=" || arrMatches[10] == "&lt;=") {
					
					/* {{name|<=|if|then|else}} */
					string = (parseFloat(mailmerge.split(card, arrMatches[9]).replace(",",".")) <= parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
			}
			
		}
		
		if(mailmerge.prefs.source == "AddressBook" && object) {
			
			var card = object;
			
			if(arrMatches[1]) {
				
				/* {{name}} */
				string = string.replace(arrMatches[0], card.getProperty(arrMatches[1], ""));
				return mailmerge.substitute(string, card);
				
			}
			
			if(arrMatches[2]) {
				
				/* {{name|if|then}} */
				string = (card.getProperty(arrMatches[2], "") == arrMatches[3]) ? string.replace(arrMatches[0], arrMatches[4]) : string.replace(arrMatches[0], "");
				return mailmerge.substitute(string, card);
				
			}
			
			if(arrMatches[5]) {
				
				/* {{name|if|then|else}} */
				string = (card.getProperty(arrMatches[5], "") == arrMatches[6]) ? string.replace(arrMatches[0], arrMatches[7]) : string.replace(arrMatches[0], arrMatches[8]);
				return mailmerge.substitute(string, card);
				
			}
			
			if(arrMatches[9]) {
				
				if(arrMatches[10] == "*") {
					
					/* {{name|*|if|then|else}} */
					string = (card.getProperty(arrMatches[9], "").match(arrMatches[11])) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == "^") {
					
					/* {{name|^|if|then|else}} */
					string = (card.getProperty(arrMatches[9], "").match("^" + arrMatches[11])) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == "$") {
					
					/* {{name|$|if|then|else}} */
					string = (card.getProperty(arrMatches[9], "").match(arrMatches[11] + "$")) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
			}
			
			if(arrMatches[9]) {
				
				if(arrMatches[10] == "==") {
					
					/* {{name|==|if|then|else}} */
					string = (parseFloat(card.getProperty(arrMatches[9], "").replace(",",".")) == parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == ">" || arrMatches[10] == "&gt;") {
					
					/* {{name|>|if|then|else}} */
					string = (parseFloat(card.getProperty(arrMatches[9], "").replace(",",".")) > parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == ">=" || arrMatches[10] == "&gt;=") {
					
					/* {{name|>=|if|then|else}} */
					string = (parseFloat(card.getProperty(arrMatches[9], "").replace(",",".")) >= parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == "<" || arrMatches[10] == "&lt;") {
					
					/* {{name|<|if|then|else}} */
					string = (parseFloat(card.getProperty(arrMatches[9], "").replace(",",".")) < parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
				if(arrMatches[10] == "<=" || arrMatches[10] == "&lt;=") {
					
					/* {{name|<=|if|then|else}} */
					string = (parseFloat(card.getProperty(arrMatches[9], "").replace(",",".")) <= parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, card);
					
				}
				
			}
			
		}
		
		if(mailmerge.prefs.source == "CSV" && object) {
			
			var file = object;
			
			if(arrMatches[1]) {
				
				/* {{name}} */
				string = string.replace(arrMatches[0], (file[arrMatches[1]] || ""));
				return mailmerge.substitute(string, file);
				
			}
			
			if(arrMatches[2]) {
				
				/* {{name|if|then}} */
				string = ((file[arrMatches[2]] || "") == arrMatches[3]) ? string.replace(arrMatches[0], arrMatches[4]) : string.replace(arrMatches[0], "");
				return mailmerge.substitute(string, file);
				
			}
			
			if(arrMatches[5]) {
				
				/* {{name|if|then|else}} */
				string = ((file[arrMatches[5]] || "") == arrMatches[6]) ? string.replace(arrMatches[0], arrMatches[7]) : string.replace(arrMatches[0], arrMatches[8]);
				return mailmerge.substitute(string, file);
				
			}
			
			if(arrMatches[9]) {
				
				if(arrMatches[10] == "*") {
					
					/* {{name|*|if|then|else}} */
					string = ((file[arrMatches[9]] || "").match(arrMatches[11])) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, file);
					
				}
				
				if(arrMatches[10] == "^") {
					
					/* {{name|^|if|then|else}} */
					string = ((file[arrMatches[9]] || "").match("^" + arrMatches[11])) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, file);
					
				}
				
				if(arrMatches[10] == "$") {
					
					/* {{name|$|if|then|else}} */
					string = ((file[arrMatches[9]] || "").match(arrMatches[11] + "$")) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, file);
					
				}
				
			}
			
			if(arrMatches[9]) {
				
				if(arrMatches[10] == "==") {
					
					/* {{name|==|if|then|else}} */
					string = (parseFloat((file[arrMatches[9]] || "").replace(",",".")) == parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, file);
					
				}
				
				if(arrMatches[10] == ">" || arrMatches[10] == "&gt;") {
					
					/* {{name|>|if|then|else}} */
					string = (parseFloat((file[arrMatches[9]] || "").replace(",",".")) > parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, file);
					
				}
				
				if(arrMatches[10] == ">=" || arrMatches[10] == "&gt;=") {
					
					/* {{name|>=|if|then|else}} */
					string = (parseFloat((file[arrMatches[9]] || "").replace(",",".")) >= parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, file);
					
				}
				
				if(arrMatches[10] == "<" || arrMatches[10] == "&lt;") {
					
					/* {{name|<|if|then|else}} */
					string = (parseFloat((file[arrMatches[9]] || "").replace(",",".")) < parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, file);
					
				}
				
				if(arrMatches[10] == "<=" || arrMatches[10] == "&lt;=") {
					
					/* {{name|<=|if|then|else}} */
					string = (parseFloat((file[arrMatches[9]] || "").replace(",",".")) <= parseFloat(arrMatches[11].replace(",","."))) ? string.replace(arrMatches[0], arrMatches[12]) : string.replace(arrMatches[0], arrMatches[13]);
					return mailmerge.substitute(string, file);
					
				}
				
			}
			
		}
		
		string = string.replace(arrMatches[0], "");
		return mailmerge.substitute(string, object);
		
	},
	
	split: function(card, string) {
		
		string = string.split("#");
		string[0] = (string[0] || "");
		string[1] = (string[1] || "");
		string[2] = (string[2] || 0);
		
		switch(string[0]) {
			
			case "adr":
			case "email":
			case "impp":
			case "tel":
			case "url":
				
				var object = (card[string[0]] || "");
				object = object.filter(function(element) { return (string[1]) ? (element[1].some(function(element) { return (element.replace(/TYPE=/i,'').toUpperCase() == string[1].replace(/TYPE=/i,'').toUpperCase()); })) : true; });
				return (object[string[2]]) ? object[string[2]][0] : "";
				
			case "adrpostoffice":
				
				var object = (card["adr"] || "");
				object = object.filter(function(element) { return (string[1]) ? (element[1].some(function(element) { return (element.replace(/TYPE=/i,'').toUpperCase() == string[1].replace(/TYPE=/i,'').toUpperCase()); })) : true; });
				return (object[string[2]]) ? object[string[2]][0][0] : "";
				
			case "adrextended":
				
				var object = (card["adr"] || "");
				object = object.filter(function(element) { return (string[1]) ? (element[1].some(function(element) { return (element.replace(/TYPE=/i,'').toUpperCase() == string[1].replace(/TYPE=/i,'').toUpperCase()); })) : true; });
				return (object[string[2]]) ? object[string[2]][0][1] : "";
				
			case "adrstreet":
				
				var object = (card["adr"] || "");
				object = object.filter(function(element) { return (string[1]) ? (element[1].some(function(element) { return (element.replace(/TYPE=/i,'').toUpperCase() == string[1].replace(/TYPE=/i,'').toUpperCase()); })) : true; });
				return (object[string[2]]) ? object[string[2]][0][2] : "";
				
			case "adrlocality":
				
				var object = (card["adr"] || "");
				object = object.filter(function(element) { return (string[1]) ? (element[1].some(function(element) { return (element.replace(/TYPE=/i,'').toUpperCase() == string[1].replace(/TYPE=/i,'').toUpperCase()); })) : true; });
				return (object[string[2]]) ? object[string[2]][0][3] : "";
				
			case "adrregion":
				
				var object = (card["adr"] || "");
				object = object.filter(function(element) { return (string[1]) ? (element[1].some(function(element) { return (element.replace(/TYPE=/i,'').toUpperCase() == string[1].replace(/TYPE=/i,'').toUpperCase()); })) : true; });
				return (object[string[2]]) ? object[string[2]][0][4] : "";
				
			case "adrpostalcode":
				
				var object = (card["adr"] || "");
				object = object.filter(function(element) { return (string[1]) ? (element[1].some(function(element) { return (element.replace(/TYPE=/i,'').toUpperCase() == string[1].replace(/TYPE=/i,'').toUpperCase()); })) : true; });
				return (object[string[2]]) ? object[string[2]][0][5] : "";
				
			case "adrcountry":
				
				var object = (card["adr"] || "");
				object = object.filter(function(element) { return (string[1]) ? (element[1].some(function(element) { return (element.replace(/TYPE=/i,'').toUpperCase() == string[1].replace(/TYPE=/i,'').toUpperCase()); })) : true; });
				return (object[string[2]]) ? object[string[2]][0][6] : "";
				
			case "others":
				
				var object = (card[string[0]] || "");
				object = object.filter(function(element) { return (string[1]) ? (element.split(":")[0].toUpperCase() == string[1].toUpperCase()) : true; });
				return (object[string[2]]) ? object[string[2]].split(":")[1] : "";
				
			case "photo":
			case "logo":
			case "sound":
				
				var object = (card[string[0]] || "");
				return (card[string[0]].localURI || "");
				
			default:
				return (card[string[0]] || "");
			
		}
		
	},
	
	error: function(string) {
		
		Services.prompt.alert(window, "Mail Merge: Error", string);
		Services.console.logStringMessage("Mail Merge: Error" + "\n" + string);
		window.close();
		
	},
	
	debug: function(string) {
		
		if(!mailmerge.prefs.debug) { return; }
		Services.console.logStringMessage(string);
		
	}
	
}
