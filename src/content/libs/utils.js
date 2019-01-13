"use strict";

var mailmergeUtils = {
	
	mergePrefs: function(mailmerge) {
		
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
	
	parseCsvLegacy: function(string, fielddelimiter, textdelimiter) {
		
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
		
	}
	
}
