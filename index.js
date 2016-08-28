var self = require("sdk/self");
var data = self.data;
var tabs = require("sdk/tabs");

var cm = require("sdk/context-menu");
var clipboard = require("sdk/clipboard");
var storage = require("sdk/simple-storage").storage;
var panels = require("sdk/panel");
var viewFor = require("sdk/view/core");

//Non-top layer service functions used in various places throughout code
var helpers = {
	//Given a storage variable and a data type, this function returns it if it is already defined
	//If it is not defined and no default value is provided, 
	//it sets a 0/false/empty value of the appropriate type
	//If it is not defined and a default value is provided, it sets the provided value
	initializeStorageVar: function(storageVar, varType, setValue=null) {
		if (typeof(storageVar) === "undefined") {
			switch (varType) {
				case "array":
					storageVar = [];
					break;
				case "boolean":
					storageVar = false;
					break;
				case "number":
					storageVar = 0;
					break;
				case "object":
					storageVar = {};
					break;
				case "null":
					storageVar = null;
					break;
				case "string":
					storageVar = "";
					break;
				default:
					storageVar = null;
			}
			storageVar = (setValue != null) ? setValue : storageVar;
		}
		return storageVar;
	},
	//redefines the preferences variable which holds the current add-on preferences
	refreshPreferences: function() {
		preferences = {
			//useClipboard - whether to use the clipboard contents if text selection is empty/collapsed
			useClipboard: helpers.initializeStorageVar(storage.useClipboard,"boolean"),
			//topContext - whether to put the add-on context menu menu at the top. Defaults to true
			topContext: helpers.initializeStorageVar(storage.topContext,"boolean",true),
			//cleanLines - whether to remove /^[a-zA-Z0-9]{1,2}[\."\)][ \t]+/ from each line
			//in multiline clips like makeRows
			cleanLines: helpers.initializeStorageVar(storage.cleanLines,"boolean",true),
			//commentsLang - which language to use for quetsion comments. Defaults to English
			commentsLang: helpers.initializeStorageVar(storage.commentsLang,"string","en"),
			//globalUse - whether to display the menu globally or only on XML Editor pages
			globalUse: helpers.initializeStorageVar(storage.globalUse,"boolean")
		}

		if (typeof mainMenu !== "undefined") {
			mainMenu.context.remove(currentContext);
			currentContext = preferences.globalUse ? globalContext : localContext;
			mainMenu.context.add(currentContext);
		}
		return;
	},
	//put our dropdown menu item at the top of the menu, if the topContext preference is true
	reorderContextMenu: function(label) {
		let thisWindow = require('sdk/window/utils').getMostRecentBrowserWindow();
		let contextMenu = thisWindow.document.getElementById("contentAreaContextMenu");
		let itemList = contextMenu.querySelectorAll('[label="' + label + '"]');
		let myMenu = itemList[0];
		let myMenuParent = myMenu.parentNode;
		
		//If found, insert the menu at the top of the context menu and add a separator, if it is missing
		if(myMenu !== undefined) {				
			const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
			let separator = thisWindow.document.createElementNS(XUL_NS, "menuseparator");
			
			if (preferences.topContext) {
				if (myMenuParent.firstChild.label != label && myMenuParent.firstChild.tagName.toLowerCase() != "menuseparator") {
					myMenuParent.insertBefore(separator,  myMenuParent.firstChild);
				}		
			
				myMenuParent.insertBefore(myMenu, myMenuParent.firstChild);
			} else {
				if (myMenuParent.lastChild.label != label && myMenuParent.lastChild.tagName.toLowerCase() != "menuseparator") {
					myMenuParent.insertBefore(separator,  myMenuParent.lastChild);
				}
				myMenuParent.appendChild(myMenu);
			}
		}
		
		//Clean up any spare separators
		if (myMenuParent.firstChild.tagName.toLowerCase() == "menuseparator") 
			myMenuParent.removeChild(myMenuParent.firstChild);
		/*if (myMenuParent.lastChild.tagName.toLowerCase() == "menuseparator")
			myMenuParent.removeChild(myMenuParent.lastChild);*/
	},
	//like python's str.strip() only the syntax is helpers.strip(str)
	strip: function(str) {
		return str.replace(/^\s+|\s+$/g,"");	
	},
	//Processes the input (selection text) for the main text modifier functions and optionally
	//replaces it with the clipboard contents, if the selection is empty/collapsed and
	//the useClipboard preference is true
	processInput: function(input) {
		let clipText = clipboard.text;
		input = (input.length == 0 && preferences.useClipboard) ? clipText : input;
		input = input.replace(/[\r|\n|\r\n]/g, '\n');
		return helpers.strip(input);
	},
	//splits text into lines and optionally removes element labels
	//in a way identical to the makeRows Notetab python script
	makeLines: function(input, skipClean=false) {
		let lines = input.split("\n");
		lines = lines.filter(function (n) {
			return n !== '';
		});
		lines.forEach(function(item, i, arr) {
			if (preferences.cleanLines && skipClean == false)
				lines[i] = lines[i].replace(/^[a-zA-Z0-9]{1,2}[\."\)][ \t]+/, "");
			lines[i] = helpers.strip(lines[i]);
		});
		return lines;
	},
	currentTab: null,
	setText: function(nText) {
		if (helpers.currentTab !== null) {
			var selectionSetter = tabs.activeTab.attach({
				contentScriptFile: "./set-selection.js"
			})
			
			selectionSetter.port.emit("updateText",nText);
		}
	}
}


//Initialize Preferences
helpers.refreshPreferences();


//Set up preferences menu
var prefsPanel = panels.Panel({
	width: 300,
	height: 360,
	contentURL: data.url("prefs-panel.html"),
	onShow: function() {
		var view = viewFor.getActiveView(prefsPanel);
		view.setAttribute("noautohide", "true");
		
		prefsPanel.port.emit("load-prefs", preferences);
	},
})

prefsPanel.port.on("close-panel",function(message) {
	prefsPanel.hide();
});

prefsPanel.port.on("set-prefs",function(panelPrefs) {
	for (eachPref in panelPrefs) {
		if (panelPrefs.hasOwnProperty(eachPref)) {
			var eachPrefValue = panelPrefs[eachPref];
			if (eachPref == "commentsLang") {
				if (eachPrefValue == "en" || eachPrefValue == "de") 
					storage[eachPref] = eachPrefValue;
			}
			if (typeof eachPrefValue === "boolean") {
				storage[eachPref] = eachPrefValue;
			}
		}
	}
	helpers.refreshPreferences();
	prefsPanel.port.emit("load-prefs", preferences);
});


//Styles panel
var stylesPanel = panels.Panel({
	width: 700,
	height: 400,
	contentURL: data.url("styles-panel.html")
});

stylesPanel.port.on("style-chosen",function(styleChoice) {
	helpers.setText(styleChoice);	
	//TO DO: Add XML Style tags to clips
	//replace this function with a call to those clips
	stylesPanel.hide();
});


//Define question comment texts in one place
var questionComments = {
	en: {
		radio: "Select one",
		radio2d: "Select one for each row",
		checkbox: "Select all that apply",
		number: "Please enter a whole number",
		autosumPercent: "Please enter a whole number. Your answers should total 100%.",
		text: "Please be as specific as possible"
	},
	de: {
		radio: "Bitte nur eine Antwort auswählen.",
		radio2d: "Wählen Sie jeder Zeile eine Antwort (aus der Skala).",
		checkbox: "Bitte alle passenden Antworten auswählen.",
		number: "Bitte geben Sie eine ganze Zahl.",
		autosumPercent: "Bitte geben Sie ganze Zahlen an. Die Summe muss 100% betragen.",
		text: "Bitte seien Sie so konkret wie möglich."	
	}
}

var clips = {
	//Control Elements
	makeTerm: function(selText) {
		var input = helpers.processInput(selText);		
		return '<term cond="'+input+'"></term>';
	},
	makeQuota: function(selText) {
		var input = helpers.processInput(selText);
		return '<quota sheet="'+input+'" overquota="noqual"/>';
	},
	makeValidate: function(selText) {
		var input = helpers.processInput(selText);
		return '  <validate>\n'+input+'\n  </validate>';
	},
	makeResource: function(selText) {
		var input = helpers.processInput(selText);
		var lines = helpers.makeLines(input);
		
		var startItem = '<res label="">';
		var endItem = '</res>\n';
		var output = "";
		
		for (var i = 0; i<lines.length; i++) {
			if (lines.length > 0) {
				output += startItem+lines[i]+endItem;
			}
		}
		
		output = output.replace(/\s+$/g,"")
		
		return output;
	},
	makeExec: function(selText) {
		var input = helpers.processInput(selText);
		return '<exec>\n'+input+'\n</exec>';
	},
	makeBlock: function(selText) {
		var input = helpers.processInput(selText);
		
		var lines = helpers.makeLines(input,skipClean=true);
		
		lines.forEach(function(item, i, arr) {
			arr[i] = "  "+arr[i];
		});
		
		input = lines.join("\n");
		
		return '<block label="" cond="1">\n'+input+'\n</block>';
	},
	makeBlockChildren: function(selText) {
		var input = helpers.processInput(selText);
		
		var lines = helpers.makeLines(input,skipClean=true);
		
		lines.forEach(function(item, i, arr) {
			arr[i] = "  "+arr[i];
		});
		
		input = lines.join("\n");
		
		return '<block label="" cond="1" randomizeChildren="1">\n'+input+'\n</block>';
	},
	makeLoop: function(selText) {
		var input = helpers.processInput(selText);
		input = input.replace(/<(radio|checkbox|text|textarea|block|number|float|select|html|autofill)(.*label=")([^"]*)"/g, '<$1$2$3_[loopvar: label]"');
		
		var lines = helpers.makeLines(input,skipClean=true);
		
		lines.forEach(function(item, i, arr) {
			arr[i] = "    "+arr[i];
		});
		
		input = lines.join("\n");
		
		var output = 	'<loop label="" vars="" suspend="0">\n' +
						'  <block label="">\n\n' +
						input + "\n\n" +
						'  </block>\n\n' +
						'  <looprow label="" cond="">\n' +
						'    <loopvar name=""></loopvar>\n' +
						'  </looprow>\n' +
						'</loop>';
		return output;
	},
	makeMarker: function(selText) {
		var input = helpers.processInput(selText);
		return '<marker name="'+input+'" cond=""/>';
	},
	makeCondition: function(selText) {
		var input = helpers.processInput(selText);
		return '<condition label="" cond="">'+input+'</condition>';
	},
	
	//Question Generator
	makeQuestion: function(selText = "",qType) {
		var output = "";
		var ratingShuffle = "";
		
		var comments = questionComments[preferences.commentsLang];
		
		var questionParts = {
			radio: {
				name: "radio", 
				attrs: "", 
				comment: [comments.radio, comments.radio2d]
			},
			rating: {
				name: "radio", 
				attrs: ' type="rating"', 
				comment: [comments.radio, comments.radio2d]
			},
			checkbox: {
				name: "checkbox", 
				attrs: ' atleast="1"', 
				comment: comments.checkbox
			},
			select: {
				name: "select", 
				attrs: ' optional="0"', 
				comment: ""
			},
			text: {
				name: "text", 
				attrs: ' size="40" optional="0"', 
				comment: comments.text
			},
			textarea: {
				name: "textarea", 
				attrs: ' optional="0"', 
				comment: comments.text
			},
			number: {
				name: "number", 
				attrs: ' size="3" optional="0" verify="range(0,99999)"', 
				comment: comments.number
			},
			autosum: {
				name: "number", 
				attrs: ' size="3" optional="1" verify="range(0,99999)" uses="autosum.5"', 
				comment: comments.number
			},
			autosumPercent: {
				name: "number", 
				attrs: ' size="3" optional="1" amount="100" verify="range(0,100)" uses="autosum.5" autosum:postText="%"', 
				comment: comments.autosumPercent
			},
		}
		
		var parts = questionParts[qType];
		
		var input = helpers.processInput(selText);
			
		input = input.replace(/^(\w?\d+)\.(\d+)/,"$1_$2");
		
		var label = input.split(/^([a-zA-Z0-9_]+)+(\.|:|\)|\s)/)[1];
		label = helpers.strip(label);
		
		input = input.split(/^([a-zA-Z0-9_]+)+(\.|:|\)|\s)/)[input.split(/^([a-zA-Z0-9_]+)+(\.|:|\)|\s)/).length-1];
		input = helpers.strip(input);
		
		if (!isNaN(parseFloat(label[0])) && isFinite(label[0]))
			label = "Q" + label;
		
		var input_index = input.search(/<(row|col|choice|comment|group|net|exec|validate|style)/)
		
		if (input_index == "-1") input_index = input.length;
		var title = input.slice(0,input_index);
		
		
		input = input.replace(title, "");
		
		title = title.replace(/^\s+|\s+$/g,"");
		
		if (input.search("<comment") == -1) {
			if (qType == "radio" || qType == "rating") {
				if (input.search("<row") > -1 && input.search("<col") > -1)
					var comment = "  <comment>"+parts.comment[1]+"</comment>\n"
				else
					var comment = "  <comment>"+parts.comment[0]+"</comment>\n";
			} else {
				var comment = "  <comment>"+parts.comment+"</comment>\n";
			}
		}
		
		if (qType == "rating" && input.search("<row") > -1 && input.search("<col") > -1) 
			ratingShuffle = ' shuffle="rows"';

		output = '<'+parts.name+' label="' + label + '"'+parts.attrs+ratingShuffle+'>\n  <title>' + title + '</title>\n'
		if (input.search("<comment") == -1 && qType != "select") {
			output += comment;
		}
		
		output += "  ";
		
		output += input;
		
		output = output[output.length-1] != "\n" ? output + "\n" : output;
		
		output += "</"+parts.name+">\n<suspend/>";
		
		return output;
	},
	
	makeSurveyComment: function(selText) {
		var input = helpers.processInput(selText);
		return '<html label="" where="survey">'+input+'</html>';
	},
	
	makeAutofill: function(selText) {
		var input = helpers.processInput(selText);
		
		return 	'<autofill label="" where="execute,survey,report">\n' +
				'  <title>Hidden: Autofill</title>\n' +
				'  ' + input + '\n' +
				'</autofill>'
	},
	
	//Element Generator
	makeElements: function(selText = "", elType, values=false, valuesDir="up") {
		var input = helpers.processInput(selText);
		
		var lines = helpers.makeLines(input);
		
		var startItem = "  ";
		var endItem = "\n";	
		var output = "";
		
		elementParts = {
			rows: {name: "row", label: "r"},
			cols: {name: "col", label: "c"},
			choices: {name: "choice", label: "ch"},
			autofillRows: {name: "row", label:"r"},
			groups: {name: "group", label: "g"},
		}
		
		parts = elementParts[elType];
		
		for (var i = 0; i<lines.length; i++) {
			if (lines.length > 0) {
				lineNum = (values && valuesDir == "down") ? lines.length-i : i + 1;
				valueText = values ? ' value="'+lineNum+'"' : "";
				autofillText = elType == "autofillRows" ? ' autofill=""' : "";
				lines[i] = '<'+parts.name+' label="'+parts.label+lineNum+'"'+autofillText+valueText+'>'+lines[i]+'</'+parts.name+'>';
				output += startItem+lines[i]+endItem;
			}
		}
		
		if (elType == "autofillRows") {
			var afLine = '<row label="none" autofill="thisQuestion.count == 0" builder:none="1"><i>None of These Classifications Apply</i></row>'
			output += startItem+afLine+endItem;
		}
		
		output = output.replace(/\s+$/g,"")
		
		return output;
	},
	makeNoAnswer: function(selText) {
		var input = helpers.processInput(selText);
		var lines = helpers.makeLines(input);
		
		var startItem = ['<noanswer label="n','">'];
		var endItem = '</noanswer>\n';
		var output = "";
		
		for (var i = 0; i<lines.length; i++) {
			if (lines.length > 0) {
				lineNum = i + 1;
				output += startItem[0]+lineNum+startItem[1]+lines[i]+endItem;
			}
		}
		
		output = output.replace(/\s+$/g,"")
		
		return output;
	},
	makeQuestionComment: function(selText) {
		var input = helpers.processInput(selText);
		return '  <comment>'+input+'</comment>';
	},
	
	//Text formatting
	makeTag: function(selText,tagName,newRowContent=false,tagAttrs = []) {
		var input = helpers.processInput(selText);
		
		var tAttributes = "";
		
		tagAttrs.forEach(function(item) {
			tAttributes += ' '+item+'=""';
		});
		
		if (newRowContent)
			return '<'+tagName+tAttributes+'>\n  '+input+'\n</'+tagName+'>'
		else 
			return '<'+tagName+tAttributes+'>'+input+'</'+tagName+'>';
	},
	makeTagLines: function(selText, tagName) {
		var input = helpers.processInput(selText);
		var lines = helpers.makeLines(input);
		
		lines.forEach(function(item, i , arr) {
			arr[i] = '  <'+tagName+'>'+arr[i]+'</'+tagName+'>';
		});
		
		return lines.join("\n");
	},
	addTag: function(selfClosing=true) {
		if (selfClosing)
			return '<'+tagName+'/>'
		else
			return '<'+tagName+'>&amp;nbsp;</'+tagName+'>';
	},
	
	
	
	//---------------------- Standards Clips ---------------------------
	makeUsStates: function(selectedText){
		comment = "  <comment>"+questionComments[preferences.commentsLang].radio+"</comment>\n";
		stateChoices = "  <choice label=\"ch1\">Alabama</choice>\n  <choice label=\"ch2\">Alaska</choice>\n  <choice label=\"ch3\">Arizona</choice>\n  <choice label=\"ch4\">Arkansas</choice>\n  <choice label=\"ch5\">California</choice>\n  <choice label=\"ch6\">Colorado</choice>\n  <choice label=\"ch7\">Connecticut</choice>\n  <choice label=\"ch8\">Delaware</choice>\n  <choice label=\"ch9\">District of Columbia</choice>\n  <choice label=\"ch10\">Florida</choice>\n  <choice label=\"ch11\">Georgia</choice>\n  <choice label=\"ch12\">Hawaii</choice>\n  <choice label=\"ch13\">Idaho</choice>\n  <choice label=\"ch14\">Illinois</choice>\n  <choice label=\"ch15\">Indiana</choice>\n  <choice label=\"ch16\">Iowa</choice>\n  <choice label=\"ch17\">Kansas</choice>\n  <choice label=\"ch18\">Kentucky</choice>\n  <choice label=\"ch19\">Louisiana</choice>\n  <choice label=\"ch20\">Maine</choice>\n  <choice label=\"ch21\">Maryland</choice>\n  <choice label=\"ch22\">Massachusetts</choice>\n  <choice label=\"ch23\">Michigan</choice>\n  <choice label=\"ch24\">Minnesota</choice>\n  <choice label=\"ch25\">Mississippi</choice>\n  <choice label=\"ch26\">Missouri</choice>\n  <choice label=\"ch27\">Montana</choice>\n  <choice label=\"ch28\">Nebraska</choice>\n  <choice label=\"ch29\">Nevada</choice>\n  <choice label=\"ch30\">New Hampshire</choice>\n  <choice label=\"ch31\">New Jersey</choice>\n  <choice label=\"ch32\">New Mexico</choice>\n  <choice label=\"ch33\">New York</choice>\n  <choice label=\"ch34\">North Carolina</choice>\n  <choice label=\"ch35\">North Dakota</choice>\n  <choice label=\"ch36\">Ohio</choice>\n  <choice label=\"ch37\">Oklahoma</choice>\n  <choice label=\"ch38\">Oregon</choice>\n  <choice label=\"ch39\">Pennsylvania</choice>\n  <choice label=\"ch40\">Rhode Island</choice>\n  <choice label=\"ch41\">South Carolina</choice>\n  <choice label=\"ch42\">South Dakota</choice>\n  <choice label=\"ch43\">Tennessee</choice>\n  <choice label=\"ch44\">Texas</choice>\n  <choice label=\"ch45\">Utah</choice>\n  <choice label=\"ch46\">Vermont</choice>\n  <choice label=\"ch47\">Virginia</choice>\n  <choice label=\"ch48\">Washington</choice>\n  <choice label=\"ch49\">West Virginia</choice>\n  <choice label=\"ch50\">Wisconsin</choice>\n  <choice label=\"ch51\">Wyoming</choice>";
		qText = clips.makeQuestion(selectedText,"select");
		qText = qText.replace("</title>\n","</title>\n"+comment+stateChoices);
		return qText;
	},
	
	
	
	
	//------------------------ Styles Clips ------------------------------
	addStyleBlank: function() {
		return '<style name=""><![CDATA[\n' +
				'\n' +
				']]></style>'
	},
}



var mainMenuLabel = "Clips Library";

var controlMenu = cm.Menu({
			label: "Control",
			accesskey: "C",
			image: data.url("i/cmenu.png"),
			items: [
				//Control Elements
				cm.Item({
					label: "Add Term",
					data: "makeTerm",
				}),
				cm.Item({
					label: "Add Quota",
					data: "makeQuota",
				}),
				cm.Item({
					label: "Validate Tag",
					data: "makeValidate",
				}),
				cm.Item({
					label: "Resource Tag",
					data: "makeResource",
				}),
				cm.Item({
					label: "Exec Tag",
					data: "makeExec",
				}),
				cm.Item({
					label: "Block Tag",
					data: "makeBlock",
				}),
				cm.Item({
					label: "Block Tag (randomizeChildren)",
					data: "makeBlockChildren",
				}),
				cm.Item({
					label: "Loop Tag",
					data: "makeLoop",
				}),
				cm.Item({
					label: "Make Marker",
					data: "makeMarker",
				}),
				cm.Item({
					label: "Make Condition",
					data: "makeCondition",
				}),
			]
})

var questionMenu = cm.Menu({
			label: "Question & Elements",
			image: data.url("i/qmenu.png"),
			accesskey: "Q",
			context: cm.SelectionContext(),
			items: [
				//Question Types
				cm.Item({
					label: "Make Radio",
					data: "makeRadio",	
					image: data.url("i/qmenu.png"),
				}),
				cm.Item({
					label: "Make Rating",
					data: "makeRating",			
				}),
				cm.Item({
					label: "Make Checkbox",
					data: "makeCheckbox",			
				}),
				cm.Item({
					label: "Make Select",
					data: "makeSelect",			
				}),
				cm.Item({
					label: "Make Text",
					data: "makeText",			
				}),
				cm.Item({
					label: "Make Textarea",
					data: "makeTextarea",			
				}),
				cm.Item({
					label: "Make Number",
					data: "makeNumber",			
				}),
				cm.Item({
					label: "Make Autosum",
					data: "makeAutosum",			
				}),
				cm.Item({
					label: "Make Autosum (Percent)",
					data: "makeAutosumPercent",	
				}),
				cm.Item({
					label: "Make Survey Comment",
					data: "makeSurveyComment",	
				}),
				cm.Item({
					label: "Make Autofill",
					data: "makeAutofill",	
				}),	
				
				cm.Separator(),
				
				//Question Elements
				cm.Item({
					label: "Make Rows",
					data: "makeRows",	
					image: data.url("i/emenu.png"),
				}),
				cm.Item({
					label: "Make Rows (Rating L-H)",
					data: "makeRowsRatingUp",		
				}),
				cm.Item({
					label: "Make Rows (Rating H-L)",
					data: "makeRowsRatingDown",		
				}),
				cm.Item({
					label: "Make Cols",
					data: "makeCols",		
				}),
				cm.Item({
					label: "Make Cols (Rating L-H)",
					data: "makeColsRatingUp",		
				}),
				cm.Item({
					label: "Make Cols (Rating H-L)",
					data: "makeColsRatingDown",		
				}),
				cm.Item({
					label: "Make Choices",
					data: "makeChoices",		
				}),
				cm.Item({
					label: "Make Choices (Rating L-H)",
					data: "makeChoicesRatingUp",		
				}),
				cm.Item({
					label: "Make Choices (Rating H-L)",
					data: "makeChoicesRatingDown",		
				}),
				cm.Item({
					label: "Make NoAnswer",
					data: "makeNoAnswer",		
				}),
				cm.Item({
					label: "Make Groups",
					data: "makeGroups",		
				}),
				cm.Item({
					label: "Make Question Comment",
					data: "makeQuestionComment",		
				}),
				cm.Item({
					label: "Make Autofill Rows",
					data: "makeAutofillRows",		
				}),
			]
})

var textMenu = cm.Menu({
			label: "Text Formatting & Attributes",
			accesskey: "T",
			image: data.url("i/tmenu.png"),
			items: [
				cm.Item({
					label: "<b>",
					data: "makeTag_b",
					image: data.url("i/tmenu.png"),
				}),
				cm.Item({
					label: "<u>",
					data: "makeTag_u",
				}),
				cm.Item({
					label: "<u><b>",
					data: "makeTag_ub",
				}),
				cm.Item({
					label: "<i>",
					data: "makeTag_i",
				}),
				cm.Item({
					label: "<ul>",
					data: "makeTag_ul",
				}),
				cm.Item({
					label: "<ol>",
					data: "makeTag_ol",
				}),
				cm.Item({
					label: "<li>",
					data: "makeTag_li",
				}),
				cm.Item({
					label: "<li>s",
					data: "makeTagLines_li",
				}),
				cm.Item({
					label: "<br>",
					data: "addTag_br",
				}),
				cm.Item({
					label: "<br><br>",
					data: "addTag_brbr",
				}),
				cm.Item({
					label: "<sup>",
					data: "makeTag_sup",
				}),
				cm.Item({
					label: "<sub>",
					data: "makeTag_sub",
				}),
				cm.Item({
					label: "<note>",
					data: "makeTag_note",
				}),
				cm.Item({
					label: '<span class="">',
					data: "makeTag_spanClass",
				}),
				cm.Item({
					label: '<span style="">',
					data: "makeTag_spanStyle",
				}),
				cm.Separator(),
			]
})

var standardsMenu = cm.Menu({
			label: "Standards Clips",
			accesskey: "S",
			image: data.url("i/smenu.png"),
			context: cm.SelectionContext(),
			items: [
				cm.Item({
					label: "Make US States",
					data: "makeUsStates",
				}),
			]
})

var xmlMenu = cm.Menu({
			label: "XML Styles",
			accesskey: "X",
			image: data.url("i/xmenu.png"),
			items: [
				cm.Item({
					label: "Add Style (blank)",
					data: "addStyleBlank",
				}),
				cm.Item({
					label: "New Style (mode=instead)",
					data: "newStyleInstead",
				})
			]
})

var prefsItem = cm.Item({
			label: "Preferences",
			accesskey: "P",
			image: data.url("i/pref.png"),
			data: "prefs",			
})


var globalContext = cm.URLContext([/.*(decipherinc|focusvision)\.com.*:xmledit/,"*"]);
var localContext = cm.URLContext([/.*(decipherinc|focusvision)\.com.*:xmledit/]);

var mainMenu = cm.Menu({
	label: mainMenuLabel,
	image: data.url("i/icon_16.png"),
	accesskey: "L",
	contentScriptFile:	'./get-selection.js',
	items: [
		controlMenu,
		questionMenu,
		textMenu,
		standardsMenu,
		xmlMenu,
		cm.Separator(),
		prefsItem,
	],
	onMessage: function(message) {
		if (message.type == "context" && preferences.topContext) {
			helpers.reorderContextMenu(mainMenuLabel);
		} else if (message.type == "click") {
			var selectedText = message.text;
			var clickedItem = message.data;
			var noReplace = false;
			helpers.currentTab = tabs.activeTab;
			switch (clickedItem) {
				//Control Elements
				case "makeTerm":
					newText = clips.makeTerm(selectedText);
					break;
				
				case "makeQuota":
					newText = clips.makeQuota(selectedText);
					break;
				
				case "makeValidate":
					newText = clips.makeValidate(selectedText);
					break;
				
				case "makeResource":
					newText = clips.makeResource(selectedText);
					break;
				
				case "makeExec":
					newText = clips.makeExec(selectedText);
					break;
				
				case "makeBlock":
					newText = clips.makeBlock(selectedText);
					break;
				
				case "makeBlockChildren":
					newText = clips.makeBlockChildren(selectedText);
					break;
				
				case "makeLoop":
					newText = clips.makeLoop(selectedText);
					break;
				
				case "makeMarker":
					newText = clips.makeMarker(selectedText);
					break;
				
				case "makeCondition":
					newText = clips.makeCondition(selectedText);
					break;


					
				//Question Types
				case "makeRadio":
					newText = clips.makeQuestion(selectedText,"radio");
					break;
				
				case "makeRating":
					newText = clips.makeQuestion(selectedText,"rating");
					break;
					
				case "makeCheckbox":
					newText = clips.makeQuestion(selectedText,"checkbox");
					break;
					
				case "makeSelect":
					newText = clips.makeQuestion(selectedText,"select");
					break;
					
				case "makeText":
					newText = clips.makeQuestion(selectedText,"text");
					break;
					
				case "makeTextarea":
					newText = clips.makeQuestion(selectedText,"textarea");
					break;
					
				case "makeNumber":
					newText = clips.makeQuestion(selectedText,"number");
					break;
					
				case "makeAutosum":
					newText = clips.makeQuestion(selectedText,"autosum");
					break;
					
				case "makeAutosumPercent":
					newText = clips.makeQuestion(selectedText,"autosumPercent");
					break;
					
				case "makeSurveyComment":
					newText = clips.makeSurveyComment(selectedText);
					break;
					
				case "makeAutofill":
					newText = clips.makeAutofill(selectedText);
					break;
					
				//Question Elements
				case "makeRows":
					newText = clips.makeElements(selectedText,elType="rows");
					break;
					
				case "makeRowsRatingUp":
					newText = clips.makeElements(selectedText,elType="rows",values=true,valuesDir="up");
					break;
					
				case "makeRowsRatingDown":
					newText = clips.makeElements(selectedText,elType="rows",values=true,valuesDir="down");
					break;
					
				case "makeCols":
					newText = clips.makeElements(selectedText,elType="cols");
					break;
					
				case "makeColsRatingUp":
					newText = clips.makeElements(selectedText,elType="cols",values=true,valuesDir="up");
					break;
					
				case "makeColsRatingDown":
					newText = clips.makeElements(selectedText,elType="cols",values=true,valuesDir="down");
					break;
					
				case "makeChoices":
					newText = clips.makeElements(selectedText,elType="choices");
					break;
					
				case "makeChoicesRatingUp":
					newText = clips.makeElements(selectedText,elType="choices",values=true,valuesDir="up");
					break;
					
				case "makeChoicesRatingDown":
					newText = clips.makeElements(selectedText,elType="choices",values=true,valuesDir="down");
					break;
				
				case "makeNoAnswer":
					newText = clips.makeNoAnswer(selectedText);
					break;
				
				case "makeGroups":
					newText = clips.makeElements(selectedText,elType="groups");
					break;
				
				case "makeQuestionComment":
					newText = clips.makeQuestionComment(selectedText);
					break;
				
				case "makeAutofillRows":
					newText = clips.makeElements(selectedText,elType="autofillRows");
					break;				
				
				case "makeTag_b":
					newText = clips.makeTag(selectedText,tagName="b");
					break;				
				
				case "makeTag_u":
					newText = clips.makeTag(selectedText,tagName="u");
					break;				
				
				case "makeTag_ub":
					newText = clips.makeTag(selectedText,tagName="b");
					newText = clips.makeTag(newText,tagName="u");
					break;				
				
				case "makeTag_i":
					newText = clips.makeTag(selectedText,tagName="i");
					break;				
				
				case "makeTag_ul":
					newText = clips.makeTag(selectedText,tagName="ul",newLineContent=true);
					break;				
				
				case "makeTag_ol":
					newText = clips.makeTag(selectedText,tagName="ol",newLineContent=true);
					break;				
				
				case "makeTag_li":
					newText = clips.makeTag(selectedText,tagName="li");
					break;				
				
				case "makeTagLines_li":
					newText = clips.makeTagLines(selectedText,tagName="li");
					break;				
				
				case "addTag_br":
					newText = clips.addTag(tagName="br");
					break;				
				
				case "addTag_brbr":
					newText = clips.addTag(tagName="br");
					newText += clips.addTag(tagName="br");
					break;				
				
				case "makeTag_sup":
					newText = clips.makeTag(selectedText,tagName="sup");
					break;
				
				case "makeTag_sub":
					newText = clips.makeTag(selectedText,tagName="sub");
					break;
				
				case "makeTag_note":
					newText = clips.makeTag(selectedText,tagName="note");
					break;
				
				case "makeTag_spanClass":
					newText = clips.makeTag(selectedText,tagName="span",false,tagAttrs = ["class"]);
					break;
				
				case "makeTag_spanStyle":
					newText = clips.makeTag(selectedText,tagName="span",false,tagAttrs = ["style"]);
					break;
				
				
				//Standards Clips
				case "makeUsStates":
					newText = clips.makeUsStates(selectedText);
					break;
					
				
				//Styles Clips
				case "addStyleBlank":
					newText = clips.addStyleBlank();
					break;
				
				case "newStyleInstead":
					var thisTab = tabs.activeTab;
					stylesPanel.show();
					noReplace = true;
					break;
				
				case "prefs":
					prefsPanel.show();
					noReplace = true;
					break;
				
				
				default:
					newText = selectedText;
					console.log({message, newText});
					console.log("^dis borked");
					break;
			} //End switch
			
			if (!noReplace) {
				helpers.setText(newText);
			}
		}
	}
});

var currentContext = preferences.globalUse ? globalContext : localContext;
mainMenu.context.add(currentContext);
