var storage = browser.storage.local;

var helpers = {
	// Initial options
	defaultOptions: {
			useClipboard: false,
			topContext: true,
			cleanLines: true,
			commentsLang: "en",
			globalUse: false,
			theme: "light"
	},
	
	// List of supported themes
	themes: ["ui-theme-light", "ui-theme-dark"],
	
	// Retrieve options from storage, use defaultOptions for any option not in storage
	refreshOptions: function() {
		let tries = 0;
		let gettingOptions = storage.get({options: $.extend({}, helpers.defaultOptions)}).then(response => {
			currentOptions = response.options;
		}, reason => {
				console.log("Failed getting options")
				console.log(reason);
		})
	},
	
	// Like Python's str.strip() only the syntax is helpers.strip(str)
	strip: function(str) {
		return str.replace(/^\s+|\s+$/g,"");	
	},
	
	// Command info volatile storage for commands activated from panels
	// (Panels take away the active tab context needed for text replacement)
	panelCommandInfo: null,
	
	// Processes the input (selection text) for the main text modifier functions and optionally
	// replaces it with the clipboard contents, if the selection is empty/collapsed and
	// the useClipboard preference is true (TO DO: Re-implement clipboard use in web-ext)
	processInput: function(input, fOptions=null) {
		let _options = {skipStrip: false};
		if (typeof fOptions !== null) $.extend(_options, fOptions);
		
		input = input.replace(/[\r|\n|\r\n]/g, '\n');
		if (_options.skipStrip)
			return input;
		else
			return helpers.strip(input);
	},
	
	// Splits text into lines and optionally removes element labels
	// in a way identical to the makeRows Notetab python script
	makeLines: function(input, fOptions=null) {
		let _options = {skipClean: false, skipStrip: false};
		if (typeof fOptions !== null) $.extend(_options, fOptions);
		
		let lines = input.split("\n");
		lines = lines.filter(function (n) {
			return n !== '';
		});
		lines.forEach(function(item, i, arr) {
			if (currentOptions.cleanLines && _options.skipClean == false)
				lines[i] = lines[i].replace(/^[a-zA-Z0-9]{1,2}[\."\)][ \t]+/, "");
			if (_options.skipStrip == false)
				lines[i] = helpers.strip(lines[i]);
		});
		return lines;
	}
};


// Set up extension options object
var currentOptions = $.extend({}, helpers.defaultOptions);

helpers.refreshOptions();

browser.storage.onChanged.addListener(helpers.refreshOptions);



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

// Non-panel clips - Notetab clip ports
var clips = {
	//Control Elements
	makeTerm: function(selText="") {
		var input = helpers.processInput(selText);		
		return '<term cond="'+input+'"></term>';
	},
	makeQuota: function(selText="") {
		var input = helpers.processInput(selText);
		return '<quota sheet="'+input+'" overquota="noqual"/>';
	},
	makeValidate: function(selText="") {
		var input = helpers.processInput(selText);
		return '  <validate>\n'+input+'\n  </validate>';
	},
	makeResource: function(selText="") {
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
	makeExec: function(selText="") {
		var input = helpers.processInput(selText);
		return '<exec>\n'+input+'\n</exec>';
	},
	makeBlock: function(selText="") {
		var input = helpers.processInput(selText);
		
		var lines = helpers.makeLines(input, {skipClean: true});
		
		lines.forEach(function(item, i, arr) {
			arr[i] = "  "+arr[i];
		});
		
		input = lines.join("\n");
		
		return '<block label="" cond="1">\n'+input+'\n</block>';
	},
	makeBlockChildren: function(selText="") {
		var input = helpers.processInput(selText);
		
		var lines = helpers.makeLines(input, {skipClean: true});
		
		lines.forEach(function(item, i, arr) {
			arr[i] = "  "+arr[i];
		});
		
		input = lines.join("\n");
		
		return '<block label="" cond="1" randomizeChildren="1">\n'+input+'\n</block>';
	},
	makeLoop: function(selText="") {
		var input = helpers.processInput(selText);
		input = input.replace(/<(radio|checkbox|text|textarea|block|number|float|select|html|autofill)([.\r\n]*?label=")([^"]*)"/g, '<$1$2$3_[loopvar: label]"');
		
		var lines = helpers.makeLines(input, {skipClean: true});
		
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
	makeMarker: function(selText="") {
		var input = helpers.processInput(selText);
		return '<marker name="'+input+'" cond=""/>';
	},
	makeCondition: function(selText="") {
		var input = helpers.processInput(selText);
		return '<condition label="" cond="">'+input+'</condition>';
	},
	
	//Question Generator
	makeQuestion: function(selText = "",qType) {
		var output = "";
		var ratingShuffle = "";
		
		var comments = questionComments[currentOptions.commentsLang];
		
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
	
	makeSurveyComment: function(selText="") {
		var input = helpers.processInput(selText);
		return '<html label="" where="survey">'+input+'</html>';
	},
	
	makeAutofill: function(selText="") {
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
	makeNoAnswer: function(selText="") {
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
	makeQuestionComment: function(selText="") {
		var input = helpers.processInput(selText);
		return '  <comment>'+input+'</comment>';
	},
	
	//Text formatting
	makeTag: function(selText="",tagName="span",fOptions=null) {
		let _options = {newRowContent:false,tagAttrs: []};
		if (typeof fOptions !== null) $.extend(_options, fOptions);
		var input = helpers.processInput(selText);
		
		var tAttributes = "";
		
		_options.tagAttrs.forEach(function(item) {
			tAttributes += ' '+item+'=""';
		});
		
		if (_options.newRowContent)
			return '<'+tagName+tAttributes+'>\n  '+input+'\n</'+tagName+'>'
		else 
			return '<'+tagName+tAttributes+'>'+input+'</'+tagName+'>';
	},
	makeTagLines: function(selText="", tagName="li") {
		var input = helpers.processInput(selText);
		var lines = helpers.makeLines(input);
		
		lines.forEach(function(item, i , arr) {
			arr[i] = '  <'+tagName+'>'+arr[i]+'</'+tagName+'>';
		});
		
		return lines.join("\n");
	},
	addTag: function(tagName="br",selfClosing=true) {
		if (selfClosing)
			return '<'+tagName+'/>'
		else
			return '<'+tagName+'>&amp;nbsp;</'+tagName+'>';
	},
	
	//Attributes
	addOpen: function(selText="") {
		return ' open="1" openSize="25" randomize="0"';
	},
	addExclusive: function(selText="") {
		return ' exclusive="1" randomize="0"';
	},
	addAggregate: function(selText="") {
		return ' aggregate="0" percentages="0"';
	},
	addRandomize: function(selText="") {
		return ' randomize="0"';
	},
	addOptional: function(selText="") {
		return ' optional="1"';
	},
	addShuffleRows: function(selText="") {
		return ' shuffle="rows"';
	},
	addWhereExecute: function(selText="") {
		return ' where="execute"';
	},
	addGroupingCols: function(selText="") {
		return ' grouping="cols" adim="cols"';
	},
	addMinRanks: function(selText="") {
		return ' minRanks=""';
	},
	addOnLoadCopyRows: function(selText="") {
		return ' onLoad="copy(\'Q#\', rows=True)"';
	},
	makeAttrs: function(selText="", attrName="alt", attrChars="", attrValues="none") {
		var input = helpers.processInput(selText, {skipStrip: true});
		var lines = helpers.makeLines(input, {skipStrip: true});
		
		switch (attrValues) {
			case "up":
				lines.forEach(function(item, i , arr) {
					arr[i] = item.replace(/^(\s*\<[^\/].*?)(>.*)$/g, '$1 ' + attrName + '="' + attrChars + (i+1).toString() + '"$2');
				});
				break;
			case "down":
				lines.forEach(function(item, i , arr) {
					arr[i] = item.replace(/^(\s*\<[^\/].*?)(>.*)$/g, '$1 ' + attrName + '="' + attrChars + (arr.length-i).toString() + '"$2');
				});
				break;
			default:
				lines.forEach(function(item, i , arr) {
					arr[i] = item.replace(/^(\s*\<[^\/].*?)(>.*)$/g, '$1 ' + attrName + '="' + attrChars + '"$2');
				});
				break;
		}
		
		return lines.join("\n");
	},
	
	//Misc
	relabelElements: function(selText="") {
		var input = helpers.processInput(selText);
		var lines = helpers.makeLines(input, {skipStrip: true});
		
		var firstLabelArr = /(label=")(\w+)(?=")/.exec(lines[0]);
		if (firstLabelArr && firstLabelArr.length >= 3)
			var firstLabel = firstLabelArr[2]
		else
			return selText;
		
		var nonAlphaLabel = firstLabel.replace(/[a-zA-Z]*/,"");
		
		var isNumLabel = false;
		
		if (!isNaN(parseFloat(nonAlphaLabel)) && isFinite(nonAlphaLabel)) {
			var startIndex = parseInt(nonAlphaLabel);
			isNumLabel = true;
		} else {
			var startIndex = firstLabel.charCodeAt(0);
			var isUpperLabel = firstLabel[0] === firstLabel[0].toUpperCase() ? true : false;
			var letterOffset = isUpperLabel ? 65 : 97;
		}
		
			
		lines.forEach(function(item, i , arr) {
			if (isNumLabel) {
				var newLabel = firstLabel.replace(/[0-9]+/,(startIndex+i).toString())
			} else {
				var charCode = startIndex+i;
				var letterIndex = charCode-letterOffset;
				if (charCode >= (letterOffset+26))
					var newLabel = String.fromCharCode(letterOffset+parseInt(letterIndex/26)-1) + String.fromCharCode(letterOffset+(letterIndex % 26))
				else
					var newLabel = String.fromCharCode(charCode);
				
			}
			
			arr[i] = item.replace(/(label=")(\w+)(?=")/, '$1' + newLabel);
		});
		
		return lines.join("\n");
	},
	
	swapRowCol: function(selText="") {
		var input = helpers.processInput(selText, {skipStrip: true});
		var lines = helpers.makeLines(input, {skipStrip: true});
		
		var elementsObj = {
			row: {
				tag: "row",
				label: "r",
			},
			col: {
				tag: "col",
				label: "c"
			}
		}
		
		var translationObj = null;
		
		lines.forEach(function(item, i , arr) {
			if (item.indexOf("<row") > -1) {
				translationObj = {
					from: elementsObj.row,
					to: elementsObj.col
				}
			} else if (item.indexOf("<col") > -1 ) {
				translationObj = {
					from: elementsObj.col,
					to: elementsObj.row
				}
			} else {
				translationObj = null;
			}
			
			if (translationObj !== null) {
				console.log(elementsObj, translationObj);
				var tagRE = new RegExp("(<\/?)"+translationObj.from.tag,"g");
				var labelRE = new RegExp('(label=")'+translationObj.from.label,"g");
				arr[i] = arr[i].replace(tagRE, "$1"+translationObj.to.tag);
				arr[i] = arr[i].replace(labelRE, "$1"+translationObj.to.label);				
			}
			
			
		});
		
		return lines.join("\n");
	},
	
	//---------------------- Standards Clips ---------------------------
	makeUsStates: function(selectedText=""){
		var comment = "  <comment>"+questionComments[currentOptions.commentsLang].radio+"</comment>\n";
		var stateChoices = ""
			+ "  <choice label=\"ch1\">Alabama</choice>\n"
			+ "  <choice label=\"ch2\">Alaska</choice>\n"
			+ "  <choice label=\"ch3\">Arizona</choice>\n"
			+ "  <choice label=\"ch4\">Arkansas</choice>\n"
			+ "  <choice label=\"ch5\">California</choice>\n"
			+ "  <choice label=\"ch6\">Colorado</choice>\n"
			+ "  <choice label=\"ch7\">Connecticut</choice>\n"
			+ "  <choice label=\"ch8\">Delaware</choice>\n"
			+ "  <choice label=\"ch9\">District of Columbia</choice>\n"
			+ "  <choice label=\"ch10\">Florida</choice>\n"
			+ "  <choice label=\"ch11\">Georgia</choice>\n"
			+ "  <choice label=\"ch12\">Hawaii</choice>\n"
			+ "  <choice label=\"ch13\">Idaho</choice>\n"
			+ "  <choice label=\"ch14\">Illinois</choice>\n"
			+ "  <choice label=\"ch15\">Indiana</choice>\n"
			+ "  <choice label=\"ch16\">Iowa</choice>\n"
			+ "  <choice label=\"ch17\">Kansas</choice>\n"
			+ "  <choice label=\"ch18\">Kentucky</choice>\n"
			+ "  <choice label=\"ch19\">Louisiana</choice>\n"
			+ "  <choice label=\"ch20\">Maine</choice>\n"
			+ "  <choice label=\"ch21\">Maryland</choice>\n"
			+ "  <choice label=\"ch22\">Massachusetts</choice>\n"
			+ "  <choice label=\"ch23\">Michigan</choice>\n"
			+ "  <choice label=\"ch24\">Minnesota</choice>\n"
			+ "  <choice label=\"ch25\">Mississippi</choice>\n"
			+ "  <choice label=\"ch26\">Missouri</choice>\n"
			+ "  <choice label=\"ch27\">Montana</choice>\n"
			+ "  <choice label=\"ch28\">Nebraska</choice>\n"
			+ "  <choice label=\"ch29\">Nevada</choice>\n"
			+ "  <choice label=\"ch30\">New Hampshire</choice>\n"
			+ "  <choice label=\"ch31\">New Jersey</choice>\n"
			+ "  <choice label=\"ch32\">New Mexico</choice>\n"
			+ "  <choice label=\"ch33\">New York</choice>\n"
			+ "  <choice label=\"ch34\">North Carolina</choice>\n"
			+ "  <choice label=\"ch35\">North Dakota</choice>\n"
			+ "  <choice label=\"ch36\">Ohio</choice>\n"
			+ "  <choice label=\"ch37\">Oklahoma</choice>\n"
			+ "  <choice label=\"ch38\">Oregon</choice>\n"
			+ "  <choice label=\"ch39\">Pennsylvania</choice>\n"
			+ "  <choice label=\"ch40\">Rhode Island</choice>\n"
			+ "  <choice label=\"ch41\">South Carolina</choice>\n"
			+ "  <choice label=\"ch42\">South Dakota</choice>\n"
			+ "  <choice label=\"ch43\">Tennessee</choice>\n"
			+ "  <choice label=\"ch44\">Texas</choice>\n"
			+ "  <choice label=\"ch45\">Utah</choice>\n"
			+ "  <choice label=\"ch46\">Vermont</choice>\n"
			+ "  <choice label=\"ch47\">Virginia</choice>\n"
			+ "  <choice label=\"ch48\">Washington</choice>\n"
			+ "  <choice label=\"ch49\">West Virginia</choice>\n"
			+ "  <choice label=\"ch50\">Wisconsin</choice>\n"
			+ "  <choice label=\"ch51\">Wyoming</choice>";
		qText = clips.makeQuestion(selectedText,"select");
		qText = qText.replace("</title>\n","</title>\n"+comment+stateChoices);
		return qText;
	},
	makeUsStatesRegions: function(selectedText="") {
		var recodeText = "\n\n"
			+"<exec>\n"
			+ "if %s.ival in [30,32,38,6,19,21,29,39,45]:\n"
			+ "	hRegion.val = 0\n" 
			+ "elif %s.ival in [13,14,22,35,49,15,16,23,25,34,27,41]:\n"
			+ "    hRegion.val = 1\n"
			+ "elif %s.any and %s.ival in [0,17,24,42,8,7,9,10,20,33,40,46,48,3,18,36,43]:\n" 
			+ "    hRegion.val = 2\nelif %s.ival in [2,5,12,26,31,28,44,50,1,4,11,37,47]:\n" 
			+ "    hRegion.val = 3\n"
			+ "</exec>\n\n"
			+ "<radio label=\"hRegion\" optional=\"1\" where=\"execute\" sst=\"0\">\n"
			+ "  <title>Hidden Question: Region recode</title>\n"
			+ "  <row label=\"r1\">Northeast (ME, NH, VT, MA, RI, CT, NY, NJ, PA)</row>\n"
			+ "  <row label=\"r2\">Midwest (WI, IL, MI, IN, OH, ND, SD, NE, KS, MN, IA, MO)</row>\n"
			+ "  <row label=\"r3\">South (KY, TN, MS, AL, FL, GA, SC, NC, VA, WV, DC, MD, DE, TX, OK, AR, LA)</row>\n"
			+ "  <row label=\"r4\">West (MT, ID, WY, NV, UT, CO, AZ, NM, WA, OR, CA, AK, HI)</row>\n"
			+ "</radio>\n\n"
			+ "<suspend/>";
		
		var qText = clips.makeUsStates(selectedText);
		var qLabel = /label="([^"]+)"/.exec(qText)[1];
		
		recodeText = recodeText.replace(/%s/g, qLabel);
		return qText + recodeText;
	},
	makeCountries: function(selectedText=""){
		var comment = "  <comment>"+questionComments[currentOptions.commentsLang].radio+"</comment>\n";
		var countryChoices = "" 
			+ "  <choice label=\"ch1\">Afghanistan</choice>\n"
			+ "  <choice label=\"ch2\">Albania</choice>\n"
			+ "  <choice label=\"ch3\">Algeria</choice>\n"
			+ "  <choice label=\"ch4\">Andorra</choice>\n"
			+ "  <choice label=\"ch5\">Angola</choice>\n"
			+ "  <choice label=\"ch6\">Antigua and Barbuda</choice>\n"
			+ "  <choice label=\"ch7\">Argentina</choice>\n"
			+ "  <choice label=\"ch8\">Armenia</choice>\n"
			+ "  <choice label=\"ch9\">Australia</choice>\n"
			+ "  <choice label=\"ch10\">Austria</choice>\n"
			+ "  <choice label=\"ch11\">Azerbaijan</choice>\n"
			+ "  <choice label=\"ch12\">Bahamas</choice>\n"
			+ "  <choice label=\"ch13\">Bahrain</choice>\n"
			+ "  <choice label=\"ch14\">Bangladesh</choice>\n"
			+ "  <choice label=\"ch15\">Barbados</choice>\n"
			+ "  <choice label=\"ch16\">Belarus</choice>\n"
			+ "  <choice label=\"ch17\">Belgium</choice>\n"
			+ "  <choice label=\"ch18\">Belize</choice>\n"
			+ "  <choice label=\"ch19\">Benin</choice>\n"
			+ "  <choice label=\"ch20\">Bhutan</choice>\n"
			+ "  <choice label=\"ch21\">Bolivia</choice>\n"
			+ "  <choice label=\"ch22\">Bosnia Herzegovina</choice>\n"
			+ "  <choice label=\"ch23\">Botswana</choice>\n"
			+ "  <choice label=\"ch24\">Brazil</choice>\n"
			+ "  <choice label=\"ch25\">Brunei</choice>\n"
			+ "  <choice label=\"ch26\">Bulgaria</choice>\n"
			+ "  <choice label=\"ch27\">Burkina</choice>\n"
			+ "  <choice label=\"ch28\">Burundi</choice>\n"
			+ "  <choice label=\"ch29\">Cambodia</choice>\n"
			+ "  <choice label=\"ch30\">Cameroon</choice>\n"
			+ "  <choice label=\"ch31\">Canada</choice>\n"
			+ "  <choice label=\"ch32\">Cape Verde</choice>\n"
			+ "  <choice label=\"ch33\">Central African Repiblic</choice>\n"
			+ "  <choice label=\"ch34\">Chad</choice>\n"
			+ "  <choice label=\"ch35\">Chile</choice>\n"
			+ "  <choice label=\"ch36\">China</choice>\n"
			+ "  <choice label=\"ch37\">Colombia</choice>\n"
			+ "  <choice label=\"ch38\">Comoros</choice>\n"
			+ "  <choice label=\"ch39\">Congo</choice>\n"
			+ "  <choice label=\"ch40\">Congo {Democratic Republic}</choice>\n"
			+ "  <choice label=\"ch41\">Costa Rica</choice>\n"
			+ "  <choice label=\"ch42\">Croatia</choice>\n"
			+ "  <choice label=\"ch43\">Cuba</choice>\n"
			+ "  <choice label=\"ch44\">Cyprus</choice>\n"
			+ "  <choice label=\"ch45\">Czech Republic</choice>\n"
			+ "  <choice label=\"ch46\">Denmark</choice>\n"
			+ "  <choice label=\"ch47\">Djibouti</choice>\n"
			+ "  <choice label=\"ch48\">Dominica</choice>\n"
			+ "  <choice label=\"ch49\">Dominican Republic</choice>\n"
			+ "  <choice label=\"ch50\">East Timor</choice>\n"
			+ "  <choice label=\"ch51\">Ecuador</choice>\n"
			+ "  <choice label=\"ch52\">Egypt</choice>\n"
			+ "  <choice label=\"ch53\">El Salvador</choice>\n"
			+ "  <choice label=\"ch54\">Equatorial Guinea</choice>\n"
			+ "  <choice label=\"ch55\">Eritrea</choice>\n"
			+ "  <choice label=\"ch56\">Estonia</choice>\n"
			+ "  <choice label=\"ch57\">Ethiopia</choice>\n"
			+ "  <choice label=\"ch58\">Fiji</choice>\n"
			+ "  <choice label=\"ch59\">Finland</choice>\n"
			+ "  <choice label=\"ch60\">France</choice>\n"
			+ "  <choice label=\"ch61\">Gabon</choice>\n"
			+ "  <choice label=\"ch62\">Gambia</choice>\n"
			+ "  <choice label=\"ch63\">Georgia</choice>\n"
			+ "  <choice label=\"ch64\">Germany</choice>\n"
			+ "  <choice label=\"ch65\">Ghana</choice>\n"
			+ "  <choice label=\"ch66\">Greece</choice>\n"
			+ "  <choice label=\"ch67\">Grenada</choice>\n"
			+ "  <choice label=\"ch68\">Guatemala</choice>\n"
			+ "  <choice label=\"ch69\">Guinea</choice>\n"
			+ "  <choice label=\"ch70\">Guinea-Bissau</choice>\n"
			+ "  <choice label=\"ch71\">Guyana</choice>\n"
			+ "  <choice label=\"ch72\">Haiti</choice>\n"
			+ "  <choice label=\"ch73\">Honduras</choice>\n"
			+ "  <choice label=\"ch74\">Hungary</choice>\n"
			+ "  <choice label=\"ch75\">Iceland</choice>\n"
			+ "  <choice label=\"ch76\">India</choice>\n"
			+ "  <choice label=\"ch77\">Indonesia</choice>\n"
			+ "  <choice label=\"ch78\">Iran</choice>\n"
			+ "  <choice label=\"ch79\">Iraq</choice>\n"
			+ "  <choice label=\"ch80\">Ireland {Republic}</choice>\n"
			+ "  <choice label=\"ch81\">Israel</choice>\n"
			+ "  <choice label=\"ch82\">Italy</choice>\n"
			+ "  <choice label=\"ch83\">Ivory Coast</choice>\n"
			+ "  <choice label=\"ch84\">Jamaica</choice>\n"
			+ "  <choice label=\"ch85\">Japan</choice>\n"
			+ "  <choice label=\"ch86\">Jordan</choice>\n"
			+ "  <choice label=\"ch87\">Kazakhstan</choice>\n"
			+ "  <choice label=\"ch88\">Kenya</choice>\n"
			+ "  <choice label=\"ch89\">Kiribati</choice>\n"
			+ "  <choice label=\"ch90\">Korea North</choice>\n"
			+ "  <choice label=\"ch91\">Korea South</choice>\n"
			+ "  <choice label=\"ch92\">Kosovo</choice>\n"
			+ "  <choice label=\"ch93\">Kuwait</choice>\n"
			+ "  <choice label=\"ch94\">Kyrgyzstan</choice>\n"
			+ "  <choice label=\"ch95\">Laos</choice>\n"
			+ "  <choice label=\"ch96\">Latvia</choice>\n"
			+ "  <choice label=\"ch97\">Lebanon</choice>\n"
			+ "  <choice label=\"ch98\">Lesotho</choice>\n"
			+ "  <choice label=\"ch99\">Liberia</choice>\n"
			+ "  <choice label=\"ch100\">Libya</choice>\n"
			+ "  <choice label=\"ch101\">Liechtenstein</choice>\n"
			+ "  <choice label=\"ch102\">Lithuania</choice>\n"
			+ "  <choice label=\"ch103\">Luxembourg</choice>\n"
			+ "  <choice label=\"ch104\">Macedonia</choice>\n"
			+ "  <choice label=\"ch105\">Madagascar</choice>\n"
			+ "  <choice label=\"ch106\">Malawi</choice>\n"
			+ "  <choice label=\"ch107\">Malaysia</choice>\n"
			+ "  <choice label=\"ch108\">Maldives</choice>\n"
			+ "  <choice label=\"ch109\">Mali</choice>\n"
			+ "  <choice label=\"ch110\">Malta</choice>\n"
			+ "  <choice label=\"ch111\">Marshall Islands</choice>\n"
			+ "  <choice label=\"ch112\">Mauritania</choice>\n"
			+ "  <choice label=\"ch113\">Mauritius</choice>\n"
			+ "  <choice label=\"ch114\">Mexico</choice>\n"
			+ "  <choice label=\"ch115\">Micronesia</choice>\n"
			+ "  <choice label=\"ch116\">Moldova</choice>\n"
			+ "  <choice label=\"ch117\">Monaco</choice>\n"
			+ "  <choice label=\"ch118\">Mongolia</choice>\n"
			+ "  <choice label=\"ch119\">Montenegro</choice>\n"
			+ "  <choice label=\"ch120\">Morocco</choice>\n"
			+ "  <choice label=\"ch121\">Mozambique</choice>\n"
			+ "  <choice label=\"ch122\">Myanmar, {Burma}</choice>\n"
			+ "  <choice label=\"ch123\">Namibia</choice>\n"
			+ "  <choice label=\"ch124\">Nauru</choice>\n"
			+ "  <choice label=\"ch125\">Nepal</choice>\n"
			+ "  <choice label=\"ch126\">Netherlands</choice>\n"
			+ "  <choice label=\"ch127\">New Zealand</choice>\n"
			+ "  <choice label=\"ch128\">Nicaragua</choice>\n"
			+ "  <choice label=\"ch129\">Niger</choice>\n"
			+ "  <choice label=\"ch130\">Nigeria</choice>\n"
			+ "  <choice label=\"ch131\">Norway</choice>\n"
			+ "  <choice label=\"ch132\">Oman</choice>\n"
			+ "  <choice label=\"ch133\">Pakistan</choice>\n"
			+ "  <choice label=\"ch134\">Palau</choice>\n"
			+ "  <choice label=\"ch135\">Panama</choice>\n"
			+ "  <choice label=\"ch136\">Papua New Guinea</choice>\n"
			+ "  <choice label=\"ch137\">Paraguay</choice>\n"
			+ "  <choice label=\"ch138\">Peru</choice>\n"
			+ "  <choice label=\"ch139\">Philippines</choice>\n"
			+ "  <choice label=\"ch140\">Poland</choice>\n"
			+ "  <choice label=\"ch141\">Portugal</choice>\n"
			+ "  <choice label=\"ch142\">Qatar</choice>\n"
			+ "  <choice label=\"ch143\">Romania</choice>\n"
			+ "  <choice label=\"ch144\">Russia</choice>\n"
			+ "  <choice label=\"ch145\">Rwanda</choice>\n"
			+ "  <choice label=\"ch146\">St Kitts and Nevis</choice>\n"
			+ "  <choice label=\"ch147\">St Lucia</choice>\n"
			+ "  <choice label=\"ch148\">Saint Vincent and the Grenadines</choice>\n"
			+ "  <choice label=\"ch149\">Samoa</choice>\n"
			+ "  <choice label=\"ch150\">San Marino</choice>\n"
			+ "  <choice label=\"ch151\">Sao Tome and Principe</choice>\n"
			+ "  <choice label=\"ch152\">Saudi Arabia</choice>\n"
			+ "  <choice label=\"ch153\">Senegal</choice>\n"
			+ "  <choice label=\"ch154\">Serbia</choice>\n"
			+ "  <choice label=\"ch155\">Seychelles</choice>\n"
			+ "  <choice label=\"ch156\">Sierra Leone</choice>\n"
			+ "  <choice label=\"ch157\">Singapore/Republic of Singapore</choice>\n"
			+ "  <choice label=\"ch158\">Slovakia</choice>\n"
			+ "  <choice label=\"ch159\">Slovenia</choice>\n"
			+ "  <choice label=\"ch160\">Solomon Islands</choice>\n"
			+ "  <choice label=\"ch161\">Somalia</choice>\n"
			+ "  <choice label=\"ch162\">South Africa</choice>\n"
			+ "  <choice label=\"ch163\">Spain</choice>\n"
			+ "  <choice label=\"ch164\">Sri Lanka</choice>\n"
			+ "  <choice label=\"ch165\">Sudan</choice>\n"
			+ "  <choice label=\"ch166\">Suriname</choice>\n"
			+ "  <choice label=\"ch167\">Swaziland</choice>\n"
			+ "  <choice label=\"ch168\">Sweden</choice>\n"
			+ "  <choice label=\"ch169\">Switzerland</choice>\n"
			+ "  <choice label=\"ch170\">Syria</choice>\n"
			+ "  <choice label=\"ch171\">Taiwan</choice>\n"
			+ "  <choice label=\"ch172\">Tajikistan</choice>\n"
			+ "  <choice label=\"ch173\">Tanzania</choice>\n"
			+ "  <choice label=\"ch174\">Thailand</choice>\n"
			+ "  <choice label=\"ch175\">Togo</choice>\n"
			+ "  <choice label=\"ch176\">Tonga</choice>\n"
			+ "  <choice label=\"ch177\">Trinidad and Tobago</choice>\n"
			+ "  <choice label=\"ch178\">Tunisia</choice>\n"
			+ "  <choice label=\"ch179\">Turkey</choice>\n"
			+ "  <choice label=\"ch180\">Turkmenistan</choice>\n"
			+ "  <choice label=\"ch181\">Tuvalu</choice>\n"
			+ "  <choice label=\"ch182\">Uganda</choice>\n"
			+ "  <choice label=\"ch183\">Ukraine</choice>\n"
			+ "  <choice label=\"ch184\">United Arab Emirates</choice>\n"
			+ "  <choice label=\"ch185\">United Kingdom</choice>\n"
			+ "  <choice label=\"ch186\">United States</choice>\n"
			+ "  <choice label=\"ch187\">Uruguay</choice>\n"
			+ "  <choice label=\"ch188\">Uzbekistan</choice>\n"
			+ "  <choice label=\"ch189\">Vanuatu</choice>\n"
			+ "  <choice label=\"ch190\">Vatican City</choice>\n"
			+ "  <choice label=\"ch191\">Venezuela</choice>\n"
			+ "  <choice label=\"ch192\">Vietnam</choice>\n"
			+ "  <choice label=\"ch193\">Yemen</choice>\n"
			+ "  <choice label=\"ch194\">Zambia</choice>\n"
			+ "  <choice label=\"ch195\">Zimbabwe</choice>";
		qText = clips.makeQuestion(selectedText,"select");
		qText = qText.replace("</title>\n","</title>\n"+comment+countryChoices);
		return qText;
	},
	
	makeUnselectable: function(selectedText="",tag="span") {
		return '<'+tag+' style="-moz-user-select: none;-webkit-user-select: none;-ms-user-select: none;" unselectable="on" ondragstart="return false" oncontextmenu="return false">'+selectedText+'</'+tag+'>';
	},
	
	addUnselectable: function(selectedText="") {
		return ' style="-moz-user-select: none;-webkit-user-select: none;-ms-user-select: none;" unselectable="on" ondragstart="return false" oncontextmenu="return false"';
	},

	/*
	popupInfo
		codeType: popup|tooltip
		popupWidth: <int>
		popupHeight: <int>
		popupTitle: <str>
		baseType: text|image
		baseInput: <str>
		contentType: text|image
		contentInput: <str>
	*/
	
	addPopup: function(popupInfo={}) {
		let popupOptions = {width: 400};
		if (popupInfo.popupWidth !== "") popupOptions["width"] = popupInfo.popupWidth;
		if (popupInfo.popupHeight !== "") popupOptions["height"] = popupInfo.popupHeight;
		if (popupInfo.popupTitle !== "") popupOptions["title"] = popupInfo.popupTitle;
		
		let output = '<span class="self-popup" onclick="Survey.uidialog.make($ (this).next(\'.popup-content\'), ' 
					+ JSON.stringify(popupOptions).replace(/"(width|height|title)"/g, "$1").replace(/"/g, "'")
					+ ')">';
		if (popupInfo.baseType === "text") {
			output += popupInfo.baseInput + "</span>";
		} else if (popupInfo.baseType === "image") {
			output += '<img src="/survey/${gv.survey.path}/' + popupInfo.baseInput + '" /></span>';
		}
		
		output += '<div class="popup-content">';
		
		if (popupInfo.contentType === "image") {
			output += '<img src="/survey/${gv.survey.path}/' + popupInfo.contentInput + '" /></div>';
		} else {
			output += popupInfo.contentInput + '</div>';
		}
		
		return output;
	},
	
	addTooltip: function(tooltipInfo={}) {
		let output = '<span class="self-tooltip">';
		if (tooltipInfo.baseType === "text") {
			output += tooltipInfo.baseInput	+ "</span>";
		} else if (tooltipInfo.baseType === "image") {
			output += '<img src="/survey/${gv.survey.path}/' + tooltipInfo.baseInput + '" /></span>';
		}
		
		output += '<span class="tooltip-content">';
		
		if (tooltipInfo.contentType === "image") {
			output += '<img src="/survey/${gv.survey.path}/' + tooltipInfo.contentInput + '" /></span>';
		} else {
			output += tooltipInfo.contentInput + '</span>';
		}
		
		return output;		
	},
	
	addPopupTemplate: function(selText="") {
		return '<span class="self-popup" onclick="Survey.uidialog.make($ (this).next(\'.popup-content\'), {width: 320, height: 240, title: \'\'} );" >(POP-UP TEXT HERE)</span><div class="popup-content">(POP-UP CONTENT HERE)</div>';
	},
	
	addTooltipTemplate: function(selText="") {
		return '<span class="self-tooltip">(MOUSE OVER TEXT HERE)</span><span class="tooltip-content">(MOUSEOVER CONTENT HERE)</span>';
	},
	
	rowOrderVirtual: function(selText="") {
		return '<number label="Q_order" size="2" title="Q order" onLoad="copy(\'Q\', rows=True)">\n'
				+ '<virtual>\n'
				+ 'assignRandomOrder("Q", "rows")\n'
				+ '</virtual>\n'
				+ '</number>\n';
	},
	
	childOrderBlock: function(bLabel="") {
		return '<number label="h' + bLabel + '_order" size="2">\n'
				+ '<virtual>assignRandomOrder("' + bLabel + '", "children")</virtual>\n'
				+ '<row label="r1">Concept 1</row>\n'
				+ '<row label="r2">Concept 2</row>\n'
				+ '<row label="r3">Concept 3</row>\n'
				+ '</number>\n'
				+ '<note>Change row labels to the labels of block\'s children, then delete this note</note>\n';
	},
	
	childOrderLoop: function(loopLabel="") {
		return '<number label="h^' + loopLabel + '_order_" size="2">\n'
				+ '<virtual>assignRandomOrder("' + loopLabel + '_expanded", "children")</virtual>\n'
				+ '<row label="' + loopLabel + '_1_expanded">Concept 1</row>\n'
				+ '<row label="' + loopLabel + '_2_expanded">Concept 2</row>\n'
				+ '<row label="' + loopLabel + '_3_expanded">Concept 3</row>\n'
				+ '</number>\n';
	},
	
	dupeCheckVar: function(vName="") {
		return '\n'
				+ '<exec when="init"> \n'
				+ 'db_' + vName + ' = Database(name="' + vName + '") \n'
				+ '</exec>\n'
				+ '\n'
				+ '<exec cond="' + vName + ' != \'\'"> \n'
				+ 'if db_' + vName + '.has(' + vName + '): \n'
				+ '	setMarker("' + vName + '_Dupe") \n'
				+ '</exec>\n'
				+ '\n'
				+ '<term cond="hasMarker(\'' + vName + '_Dupe\')" sst="0">' + vName + ' Duplicate</term>\n'
				+ '\n'
				+ '<exec cond="' + vName + ' != \'\'" when="finished"> \n'
				+ 'if ' + vName + ' != \'\': \n'
				+ '	db_' + vName + '.add(' + vName + ')\n'
				+ '</exec>\n';
	},
	
	
	
	//------------------------ Styles Clips ------------------------------
	addStyleBlank: function(selText="") {
		return '<style name=""><![CDATA[\n' +
				'\n' +
				']]></style>'
	},
	
	newStyleInstead: function(styleName="") {
		switch (styleName) {
			//Page styles
			case "survey.header":
				return '<style name="survey.header"> <![CDATA[\n'
						+ '<div id="surveyHeader" class="survey-header group">&nbsp;</div>\n'
						+ '<!-- /#surveyHeader -->\n'
						+ ']]></style>\n'
				break;
			case "survey.logo":
				return '<style name="survey.logo"> <![CDATA[\n'
						+ '\@if gv.inSurvey() and gv.survey.root.styles.ss.logoFile\n'
						+ '    <div class="surveyLogo survey-logo survey-logo-$(gv.survey.root.styles.ss.logoPosition) group">\n'
						+ '        <img src="[static]/survey/$(gv.survey.root.styles.ss.logoFile)" class="survey-logo-image" alt="logo" align="$(gv.survey.root.styles.ss.logoPosition)" />\n'
						+ '    </div>\n'
						+ '    <!-- /.logo -->\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;
			case "survey.completion":
				return '<style name="survey.completion"> <![CDATA[\n'
						+ '\@if not gv.survey.root.styles.ss.hideProgressBar\n'
						+ '    <div class="clearfix surveyProgressBar survey-progress survey-progress-align survey-progress-${"top" if gv.survey.root.progressOnTop else "bottom"} group" title="@(progress-bar) - $(percent)% @(complete)">\n'
						+ '      <div class="survey-progress-box bar survey-progress-bar survey-progress-bar-remaining survey-progress-bar-borders"><span class="survey-progress-fill survey-progress-bar-completed" style="width: $(percent)%;"></span></div>\n'
						+ '      <div class="survey-progress-text">$(percent)%</div>\n'
						+ '    </div>\n'
						+ '    <!-- /.surveyProgressBar -->\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;
			case "survey.respview.footer":
				return '<style name="survey.respview.footer"> <![CDATA[\n'
						+ '<div id="surveyFooter" class="survey-footer">\n'
						+ '    <div class="footer survey-footer-text">[dynamic survey.respview.footer.support]</div>\n'
						+ '</div>\n'
						+ '<!-- /#surveyFooter -->\n'
						+ ']]></style>\n'
				break;
			case "survey.respview.footer.support":
				return '<style name="survey.respview.footer.support"> <![CDATA[\n'
						+ '@(support)\n'
						+ ']]></style>\n'
				break;
			
			//Buttons styles
			case "buttons":
				return '<style name="buttons"> <![CDATA[\n'
						+ '<div id="surveyButtons" class="styled group survey-buttons">\n'
						+ '    $(left)\n'
						+ '    $(right)\n'
						+ '</div>\n'
						+ '<!-- #surveyButtons -->\n'
						+ ']]></style>\n'
				break;
			case "button.continue":
				return '<style name="button.continue"> <![CDATA[\n'
						+ '<input type="submit" name="continue" id="btn_continue" class="interface-btn btn continue survey-button" value="@(continue) »" onClick="var i = document.createElement(\'input\');i.setAttribute(\'type\', \'hidden\');i.setAttribute(\'value\', \'1\');i.setAttribute(\'name\', \'__has_javascript\');document.forms.primary.appendChild(i);"/>\n'
						+ ']]></style>\n'
				break;
			case "button.finish":
				return '<style name="button.finish"> <![CDATA[\n'
						+ '<input type="submit" name="finish" id="btn_finish" class="interface-btn btn finish survey-button" value="@(finish)"  onClick="var i = document.createElement(\'input\');i.setAttribute(\'type\', \'hidden\');i.setAttribute(\'value\', \'1\');i.setAttribute(\'name\', \'__has_javascript\');document.forms.primary.appendChild(i);"/>\n'
						+ ']]></style>\n'
				break;
			case "button.cancel":
				return '<style name="button.cancel"> <![CDATA[\n'
						+ '\n'
						+ ']]></style>\n'

				break;
			
			//Question Styles
			case "question.header":
				return '<style name="question.header"> <![CDATA[\n'
						+ '\@if why and gv.debug.qa\n'
						+ '    <div id="question_${this.label}" class="survey-q surveyQuestion disabledElement ${this.getName().lower()} label_${this.label} $(this.styles.ss.questionClassNames) $(hasError)">\n'
						+ '\@else\n'
						+ '    <div id="question_${this.label}" class="survey-q surveyQuestion ${this.getName().lower()} label_${this.label} $(this.styles.ss.questionClassNames) $(hasError)">\n'
						+ '\@endif\n'
						+ '[dynamic survey.question]\n'
						+ '$(error)\n'
						+ '[dynamic survey.question.instructions]\n'
						+ '[dynamic survey.question.answers.start]\n'
						+ ']]></style>\n'
				break;
			case "survey.question":
				return '<style name="survey.question"> <![CDATA[\n'
						+ '<div class="question survey-q-question">\n'
						+ '    <h2 title="@(question)" class="survey-q-question-text">${this.styles.html.showNumber and (str(number) + \'.\') or \'\'} $(title)</h2>\n'
						+ '</div>\n'
						+ '<!-- /.question -->\n'
						+ ']]></style>\n'
				break;
			case "survey.question.instructions":
				return '<style name="survey.question.instructions"> <![CDATA[\n'
						+ '<div class="instructions survey-q-instructions">\n'
						+ '    <h3 title="@(instructions)" class="survey-q-instructions-text">$(comment)</h3>\n'
						+ '</div>\n'
						+ '<!-- /.instructions -->\n'
						+ ']]></style>\n'
				break;
			case "survey.question.answers.start":
				return '<style name="survey.question.answers.start"> <![CDATA[\n'
						+ '<div class="answers survey-q-answers $(answerClassNames)">\n'
						+ '$(fir)\n'
						+ '<$(tag) class="grid ${"grid-group-by-col" if this.grouping.cols and len(this.cols) > 1 else "grid-group-by-row"} $(gridClassNames) survey-q-grid survey-q-grid-borders${" specifiedWidths" if this.styles.ss.colWidth or this.styles.ss.legendColWidth else ""}" data-height="${this.styles.ss.rowHeight if this.styles.ss.rowHeight else ""}" summary="This table contains form elements to answer the survey question">\n'
						+ '\@if not simple\n'
						+ '<tbody>\n'
						+ '\@endif\n'
						+ '\@if not forceDesktop\n'
						+ '[question.borderfix]\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;
			case "survey.question.answers.end":
				return '<style name="survey.question.answers.end"> <![CDATA[\n'
						+ '\@if not simple\n'
						+ '</tbody>\n'
						+ '\@endif\n'
						+ '</$(tag)>\n'
						+ '<!-- /.grid -->\n'
						+ '</div>\n'
						+ '<!-- /.answers -->\n'
						+ ']]></style>\n'
				break;
			case "question.footer":
				return '<style name="question.footer"> <![CDATA[\n'
						+ '[dynamic survey.question.answers.end]\n'
						+ '</div>\n'
						+ '<!-- /.surveyQuestion -->\n'
						+ ']]></style>\n'
				break;
			
			//Legend rows
			case "question.group-column":
				return '<style name="question.group-column"> <![CDATA[\n'
						+ '<$(tag) class="row row-col-legends row-col-legends-top colGroup">\n'
						+ '    $(left)\n'
						+ '    $(elements)\n'
						+ '    $(right)\n'
						+ '</$(tag)>\n'
						+ ']]></style>\n'
				break;
			case "question.top-legend":
				return '<style name="question.top-legend"> <![CDATA[\n'
						+ '\@if this.styles.ss.colLegendHeight\n'
						+ '    <$(tag) class="row row-col-legends row-col-legends-top ${"mobile-top-row-legend " if mobileOnly else ""}q-top-legend top-legend${" GtTenColumns" if ec.colCount > 10 else ""} colCount-$(colCount)" style="height:${this.styles.ss.colLegendHeight};">\n'
						+ '\@else\n'
						+ '    <$(tag) class="row row-col-legends row-col-legends-top ${"mobile-top-row-legend " if mobileOnly else ""}q-top-legend top-legend${" GtTenColumns" if ec.colCount > 10 else ""} colCount-$(colCount)">\n'
						+ '\@endif\n'
						+ '    $(left)\n'
						+ '    $(legends)\n'
						+ '    $(right)\n'
						+ '</$(tag)>\n'
						+ '\@if not simple\n'
						+ '</tbody>\n'
						+ '<tbody>\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;
			case "question.group":
				return '<style name="question.group"> <![CDATA[\n'
						+ '<$(tagRow) class="row row-group row-group-1 rowGroup group1">\n'
						+ '    <$(tagCell) colspan="$(span)" id="$(this.label)_$(group.label)" class="cell nonempty legend row-legend row-legend-left row-legend-group $(levels) ${"desktop" if this.grouping.cols else "mobile"} ${"row-legend-group-space" if row.index!=0 and ec.haveRightLegend and ec.haveLeftLegend else "border-collapse"} survey-q-grid-rowlegend survey-q-grid-group-rowlegend $(group.styles.ss.groupClassNames)">\n'
						+ '        $(text)\n'
						+ '    </$(tagCell)>\n'
						+ '</$(tagRow)>\n'
						+ ']]></style>\n'
				break;
			case "question.col-legend-row":
				return '<style name="question.col-legend-row"> <![CDATA[\n'
						+ '\@if this.styles.ss.colLegendHeight\n'
						+ '    <$(tag) class="row row-col-legends row-col-legends-middle q-col-legend-row colLegendRow${" GtTenColumns" if ec.colCount > 10 else ""} colCount-$(colCount)" style="height:${this.styles.ss.colLegendHeight};">\n'
						+ '\@else\n'
						+ '    <$(tag) class="row row-col-legends row-col-legends-middle q-col-legend-row colLegendRow${" GtTenColumns" if ec.colCount > 10 else ""} colCount-$(colCount)">\n'
						+ '\@endif\n'
						+ '    $(left)\n'
						+ '    $(legends)\n'
						+ '    $(right)\n'
						+ '</$(tag)>\n'
						+ ']]></style>\n'
				break;
			case "question.bottom-legend":
				return '<style name="question.bottom-legend"> <![CDATA[\n'
						+ '\@if not simple\n'
						+ '</tbody>\n'
						+ '<tbody>\n'
						+ '\@endif\n'
						+ '\@if this.styles.ss.colLegendHeight\n'
						+ '    <$(tag) class="row row-col-legends row-col-legends-bottom q-bottom-legend bottom-legend${" GtTenColumns" if ec.colCount > 10 else ""} colCount-$(colCount)" style="height:${this.styles.ss.colLegendHeight};">\n'
						+ '\@else\n'
						+ '    <$(tag) class="row row-col-legends row-col-legends-bottom q-bottom-legend bottom-legend${" GtTenColumns" if ec.colCount > 10 else ""} colCount-$(colCount)">\n'
						+ '\@endif\n'
						+ '    $(left)\n'
						+ '    $(legends)\n'
						+ '    $(right)\n'
						+ '</$(tag)>\n'
						+ ']]></style>\n'
				break;
			
			//Column legend items
			case "question.group-column-cell":
				return '<style name="question.group-column-cell"> <![CDATA[\n'
						+ '<$(tag) colspan="$(span)" id="$(this.label)_$(group.label)" class="cell nonempty legend col-legend col-legend-top col-legend-group $(levels) ${"desktop" if this.grouping.cols else "mobile"} ${"col-legend-space" if this.grouping.cols and ec.haveLeftLegend and ec.haveRightLegend else "border-collapse"} survey-q-grid-collegend survey-q-grid-group-collegend $(group.styles.ss.groupClassNames)">\n'
						+ '    $(text)\n'
						+ '</$(tag)>\n'
						+ ']]></style>\n'
				break;
			case "question.left-blank-legend":
				return '<style name="question.left-blank-legend"> <![CDATA[\n'
						+ '<$(tag) class="cell empty empty-left empty-$(pos) unused ${"desktop" if this.grouping.cols else "mobile"} border-collapse"></$(tag)>\n'
						+ ']]></style>\n'
				break;
			case "question.top-legend-item":
				return '<style name="question.top-legend-item"> <![CDATA[\n'
						+ '\@if this.styles.ss.colWidth\n'
						+ '    <$(tag) id="$(this.label)_$(col.label)" class="cell nonempty legend col-legend col-legend-top col-legend-basic $(levels) ${"desktop" if this.grouping.cols else "mobile"} ${"col-legend-space" if this.grouping.cols and (col.group or col.index!=0) and ec.haveLeftLegend and ec.haveRightLegend else "border-collapse"} survey-q-grid-collegend $(col.styles.ss.colClassNames) ${col.group.styles.ss.groupClassNames if col.group else ""} q-top-legend-item $(colError)" style="min-width:${this.styles.ss.colWidth}">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@else\n'
						+ '    <$(tag) id="$(this.label)_$(col.label)" class="cell nonempty legend col-legend col-legend-top col-legend-basic $(levels) ${"desktop" if this.grouping.cols else "mobile"} ${"col-legend-space" if this.grouping.cols and (col.group or col.index!=0) and ec.haveLeftLegend and ec.haveRightLegend else "border-collapse"} survey-q-grid-collegend $(col.styles.ss.colClassNames) ${col.group.styles.ss.groupClassNames if col.group else ""} q-top-legend-item $(colError)">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;
			case "question.right-blank-legend":
				return '<style name="question.right-blank-legend"> <![CDATA[\n'
						+ '<$(tag) class="cell empty empty-right empty-$(pos) unused ${"desktop" if this.grouping.cols else "mobile"} border-collapse"></$(tag)>\n'
						+ ']]></style>\n'
				break;
			case "question.col-legend-row-item":
				return '<style name="question.col-legend-row-item"> <![CDATA[\n'
						+ '\@if this.styles.ss.colWidth\n'
						+ '    <$(tag) class="cell nonempty legend col-legend col-legend-middle col-legend-basic $(levels) ${"desktop" if this.grouping.cols else "mobile"} border-collapse q-col-legend-row-item survey-q-grid-collegend $(col.styles.ss.colClassNames) ${col.group.styles.ss.groupClassNames if col.group else ""} $(colError)" style="width:${this.styles.ss.colWidth}; min-width:${this.styles.ss.colWidth}">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@else\n'
						+ '    <$(tag) class="cell nonempty legend col-legend col-legend-middle col-legend-basic $(levels) ${"desktop" if this.grouping.cols else "mobile"} border-collapse q-col-legend-row-item survey-q-grid-collegend $(col.styles.ss.colClassNames) ${col.group.styles.ss.groupClassNames if col.group else ""} $(colError)">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;
			case "question.bottom-legend-item":
				return '<style name="question.bottom-legend-item"> <![CDATA[\n'
						+ '\@if this.styles.ss.colWidth\n'
						+ '    <$(tag) id="$(this.label)_$(col.label)" class="cell nonempty legend col-legend col-legend-bottom col-legend-basic $(levels) ${"desktop" if this.grouping.cols else "mobile"} border-collapse survey-q-grid-collegend $(col.styles.ss.colClassNames) ${col.group.styles.ss.groupClassNames if col.group else ""} q-top-legend-item $(colError)" style="width:${this.styles.ss.colWidth}; min-width:${this.styles.ss.colWidth}">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@else\n'
						+ '    <$(tag) id="$(this.label)_$(col.label)" class="cell nonempty legend col-legend col-legend-bottom col-legend-basic $(levels) ${"desktop" if this.grouping.cols else "mobile"} border-collapse survey-q-grid-collegend $(col.styles.ss.colClassNames) ${col.group.styles.ss.groupClassNames if col.group else ""} q-top-legend-item $(colError)">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;

			//Row styles
			case "question.row":
				return '<style name="question.row"> <![CDATA[\n'
						+ '\@if this.styles.ss.rowHeight\n'
						+ '    <$(tag) class="row row-elements $(style) colCount-$(colCount)" style="height:${this.styles.ss.rowHeight};">\n'
						+ '\@else\n'
						+ '    <$(tag) class="row row-elements $(style) colCount-$(colCount)">\n'
						+ '\@endif\n'
						+ '$(left)\n'
						+ '$(elements)\n'
						+ '$(right)\n'
						+ '</$(tag)>\n'
						+ ']]></style>\n'
				break;
			case "question.na.row":
				return '<style name="question.na.row"> <![CDATA[\n'
						+ '<$(tagRow) class="row row-elements row-na $(rowStyle) naRow">\n'
						+ '$(left)\n'
						+ '<$(tagCell) colspan="$(colCount)" $(headers) class="cell nonempty element naCell ${"desktop" if this.grouping.cols else "mobile"} border-collapse $(extraClasses) $(col.styles.ss.colClassNames) $(row.styles.ss.rowClassNames) clickable clickableCell survey-q-grid-cell-clickable" $(extra)>\n'
						+ '    $(naElement)\n'
						+ '</$(tagCell)>\n'
						+ '$(right)\n'
						+ '</$(tagRow)>\n'
						+ ']]></style>\n'
				break;
			case "question.left":
				return '<style name="question.left"> <![CDATA[\n'
						+ '\@if this.styles.ss.legendColWidth\n'
						+ '    <$(tag) scope="row" class="cell nonempty legend row-legend row-legend-left ${"row-legend-both " if ec.haveRightLegend and ec.haveLeftLegend else ""}${"mobile-left-row-legend " if force else ""}$(levels) ${"desktop" if this.grouping.cols else "mobile"} ${"row-legend-both-space" if ec.haveRightLegend and ec.haveLeftLegend and (not row.group or not row.index==0) else "border-collapse"} row-legend-basic survey-q-grid-rowlegend legend-left${" legend-both" if ec.haveRightLegend and ec.haveLeftLegend else ""} $(row.styles.ss.rowClassNames)" style="width:${this.styles.ss.legendColWidth}; min-width:${this.styles.ss.legendColWidth}">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@else\n'
						+ '    <$(tag) scope="row" class="cell nonempty legend row-legend row-legend-left ${"row-legend-both " if ec.haveRightLegend and ec.haveLeftLegend else ""}${"mobile-left-row-legend " if force else ""}$(levels) ${"desktop" if this.grouping.cols else "mobile"} ${"row-legend-both-space" if ec.haveRightLegend and ec.haveLeftLegend and (row.group or not row.index==0) else "border-collapse"} row-legend-basic survey-q-grid-rowlegend legend-left${" legend-both" if ec.haveRightLegend and ec.haveLeftLegend else ""} $(row.styles.ss.rowClassNames)">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;
			case "question.right":
				return '<style name="question.right"> <![CDATA[\n'
						+ '\@if this.styles.ss.legendColWidth\n'
						+ '    <$(tag) scope="row" class="cell nonempty legend row-legend row-legend-right ${"row-legend-both " if ec.haveRightLegend and ec.haveLeftLegend else ""}$(levels) ${"desktop" if this.grouping.cols else "mobile"} border-collapse row-legend-basic survey-q-grid-rowlegend legend-right${" legend-both" if ec.haveRightLegend and ec.haveLeftLegend else ""} $(row.styles.ss.rowClassNames)" style="width:${this.styles.ss.legendColWidth}; min-width:${this.styles.ss.legendColWidth}">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@else\n'
						+ '    <$(tag) scope="row" class="cell nonempty legend row-legend row-legend-right ${"row-legend-both " if ec.haveRightLegend and ec.haveLeftLegend else ""}$(levels) ${"desktop" if this.grouping.cols else "mobile"} border-collapse row-legend-basic survey-q-grid-rowlegend legend-right${" legend-both" if ec.haveRightLegend and ec.haveLeftLegend else ""} $(row.styles.ss.rowClassNames)">\n'
						+ '        $(text)\n'
						+ '    </$(tag)>\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;
			case "question.element":
				return '<style name="question.element"> <![CDATA[\n'
						+ '\@if ec.simpleList\n'
						+ '<div class="element $(rowStyle) $(levels) $(extraClasses) ${col.group.styles.ss.groupClassNames if col.group else (row.group.styles.ss.groupClassNames if row.group else "")} $(col.styles.ss.colClassNames) $(row.styles.ss.rowClassNames) ${"clickableCell" if isClickable else ""}"$(extra)>\n'
						+ '    ${v2_insertStyle(\'el.label.start\')}\n'
						+ '    $(text)\n'
						+ '    ${v2_insertStyle(\'el.label.end\')}\n'
						+ '</div>\n'
						+ '\@else\n'
						+ '<$(tag) $(headers) class="cell nonempty element $(levels) ${"desktop" if this.grouping.cols else "mobile"} border-collapse $(extraClasses) ${col.group.styles.ss.groupClassNames if col.group else (row.group.styles.ss.groupClassNames if row.group else "")} $(col.styles.ss.colClassNames) $(row.styles.ss.rowClassNames) ${"clickableCell" if isClickable else ""}"$(extra)>\n'
						+ '    ${v2_insertStyle(\'el.label.start\')}\n'
						+ '    $(text)\n'
						+ '    ${v2_insertStyle(\'el.label.end\')}\n'
						+ '</$(tag)>\n'
						+ '\@endif\n'
						+ ']]></style>\n'
				break;
			
			//Input/textarea styles
			case "el.radio":
				return '<style name="el.radio"> <![CDATA[\n'
						+ '<input type="radio" name="$(name)" value="$(value)" $(checked) class="input clickable"/>\n'
						+ '<label class="mobile-col-legend clickable">${row.text if len(this.cols) == 1 else label}</label>\n'
						+ ']]></style>\n'
				break;
			case "el.checkbox":
				return '<style name="el.checkbox"> <![CDATA[\n'
						+ '<input type="checkbox" name="$(name)" id="$(name)" value="1" $(checked) class="${flags.CSS} input clickable"/>\n'
						+ '<label for="$(name)" class="mobile-col-legend clickable">${row.text if len(this.cols) == 1 else label}</label>\n'
						+ ']]></style>\n'
				break;
			case "el.text":
				return '<style name="el.text"> <![CDATA[\n'
						+ '\@if row.styles.ss.preText or this.styles.ss.preText\n'
						+ '    ${row.styles.ss.preText or this.styles.ss.preText or ""}&nbsp;\n'
						+ '\@endif\n'
						+ '<input type="text" name="$(name)" id="$(name)" value="$(value)" size="$(size)" class="input text"/>\n'
						+ '\@if row.styles.ss.postText or this.styles.ss.postText\n'
						+ '    &nbsp;${row.styles.ss.postText or this.styles.ss.postText or ""}\n'
						+ '\@endif\n'
						+ '[el.label]\n'
						+ ']]></style>\n'
				break;
			case "el.textarea":
				return '<style name="el.textarea"> <![CDATA[\n'
						+ '\@if row.styles.ss.preText or this.styles.ss.preText\n'
						+ '    ${row.styles.ss.preText or this.styles.ss.preText or ""}&nbsp;\n'
						+ '\@endif\n'
						+ '<textarea name="$(name)" id="$(name)" rows="$(height)" cols="$(width)" wrap="virtual" class="input">$(value)</textarea>\n'
						+ '\@if row.styles.ss.postText or this.styles.ss.postText\n'
						+ '    &nbsp;${row.styles.ss.postText or this.styles.ss.postText or ""}\n'
						+ '\@endif\n'
						+ '[el.label]\n'
						+ ']]></style>\n'
				break;
			case "el.open":
				return '<style name="el.open"> <![CDATA[\n'
						+ '<input type="text" name="$(name)" id="$(name)" value="$(value)" data-cell="$(cell.parent.label)_$(cell.label)" size="$(size)" class="input clickable oe oe-$(align) text"/>\n'
						+ '$(scripts)\n'
						+ ']]></style>\n'
				break;
			case "el.noanswer":
				return '<style name="el.noanswer"> <![CDATA[\n'
						+ '  <span class="cell-body"><span class="cell-section cell-element">\n'
						+ '  <input type="checkbox" id="$(row.checkboxLabel)" name="$(row.checkboxLabel)" value="1" class="input clickable na" $(value|checkbox) />\n'
						+ '  </span><span class="cell-section mobile-col-legend"><label class="clickable">$(label) rawr</label></span></span>\n'
						+ ']]></style>\n'
				break;
			
			//Select styles
			case "el.select.header":
				return '<style name="el.select.header"> <![CDATA[\n'
						+ '<select name="$(name)" id="$(name)" class="input">\n'
						+ ']]></style>\n'
				break;
			case "el.select.default":
				return '<style name="el.select.default"> <![CDATA[\n'
						+ '<option value="-1" $(selected)>@(select)</option>\n'
						+ ']]></style>\n'
				break;
			case "el.select.element":
				return '<style name="el.select.element"> <![CDATA[\n'
						+ '<option value="$(value)" $(selected) class="${choice.styles.ss.choiceClassNames if ec.choice else ""}">$(text)</option>\n'
						+ ']]></style>\n'
				break;
			case "el.select.footer":
				return '<style name="el.select.footer"> <![CDATA[\n'
						+ '</select>\n'
						+ '[el.label]\n'
						+ ']]></style>\n'
				break;
			default:
				return clips.addStyleBlank();
		}
	},
	
	newStyleBeforeAfter: function(styleObj={}) {
		return '<style name="' + styleObj.style + '" mode="' + styleObj.mode + '"><![CDATA[\n' +
				'\n' +
				']]></style>';
	},
	
	newStyleSpecial: function(styleName="") {
		return '<style name="' + styleName + '"><![CDATA[\n' +
				'\n' +
				']]></style>';
	},
	
	addStyleLabel: function(selText="") {
		return '<style name="" label=""> <![CDATA[\n'
				+ '\n'
				+ ']]></style>';
	},
	
	addStyleCopy: function(selText="") {
		return '<style copy="" /> ';
	},
	
	surveyCss: function(selText="") {
		return '<style mode="after" name="respview.client.css"><![CDATA[\n'
				+ '<style type="text/css">\n'
				+ '\n'
				+ '</style>\n'
				+ ']]></style>\n';
	},
	
	surveyJs: function(selText="") {
		return '<style mode="after" name="respview.client.js"> <![CDATA[\n'
				+ '<script>\n'
				+ '\n'
				+ '</script>\n'
				+ ']]></style>\n';
	},
	
	questionCss: function(selText="") {
		return '<style name="page.head"><![CDATA[\n'
				+ '<style type="text/css">\n'
				+ '#question_$(this.label) {\n'
				+ '\n'
				+ '}\n'
				+ '</style>\n'
				+ ']]></style>\n';
	},
	
	questionJs: function(selText="") {
		return '<style name="question.footer" mode="after" wrap="ready" ><![CDATA[\n'
				+ '$q = $ ("#question_$(this.label)");\n'
				+ ']]></style>\n';
	},
	
	questionJsHead: function(selText="") {
		return '<style name="page.head" wrap="ready" ><![CDATA[\n'
				+ '$q = $ ("#question_$(this.label)");\n'
				+ ']]></style>\n';
	},
	
	numberPipe: function(numPipeInfo={}) {
		var multiColStr = numPipeInfo.qType === "multi" ? "[0]" : "";

		return '<style name="question.top-legend-item" arg:colText="Replace with res tag" mode="before" cond="col.index == 0"> <![CDATA[\n'
				+ '\@if ec.simpleList\n'
				+ '    <div id="$(this.label)_$(col.label)" class="legend col-legend col-legend-top col-legend-basic $(levels) ${"col-legend-space" if this.grouping.cols and (col.group or col.index!=0) and ec.haveLeftLegend and ec.haveRightLegend else "border-collapse"} $(col.styles.ss.colClassNames) ${col.group.styles.ss.groupClassNames if col.group else ""} $(colError)">\n'
				+ '        $(colText)\n'
				+ '    </div>\n'
				+ '\@else\n'
				+ '\@if this.styles.ss.colWidth\n'
				+ '    <$(tag) scope="col" id="$(this.label)_$(col.label)" class="cell nonempty legend col-legend col-legend-top col-legend-basic $(levels) ${"desktop" if this.grouping.cols else "mobile"} ${"col-legend-space" if this.grouping.cols and (col.group or col.index!=0) and ec.haveLeftLegend and ec.haveRightLegend else "border-collapse"} $(col.styles.ss.colClassNames) ${col.group.styles.ss.groupClassNames if col.group else ""} $(colError)" style="width:${this.styles.ss.colWidth}; min-width:${this.styles.ss.colWidth}">\n'
				+ '        $(colText)\n'
				+ '    </$(tag)>\n'
				+ '\@else\n'
				+ '    <$(tag) scope="col" id="$(this.label)_$(col.label)" class="cell nonempty legend col-legend col-legend-top col-legend-basic $(levels) ${"desktop" if this.grouping.cols else "mobile"} ${"col-legend-space" if this.grouping.cols and (col.group or col.index!=0) and ec.haveLeftLegend and ec.haveRightLegend else "border-collapse"} $(col.styles.ss.colClassNames) ${col.group.styles.ss.groupClassNames if col.group else ""} $(colError)">\n'
				+ '        $(colText)\n'
				+ '    </$(tag)>\n'
				+ '\@endif\n'
				+ '\@endif\n'
				+ ']]></style>\n'
				+ '<style name="question.element" mode="before" cond="col.index == 0"> <![CDATA[\n'
				+ '\@if ec.simpleList\n'
				+ '<div class="element $(rowStyle) $(levels) $(extraClasses) ${col.group.styles.ss.groupClassNames if col.group else (row.group.styles.ss.groupClassNames if row.group else "")} $(col.styles.ss.colClassNames) $(row.styles.ss.rowClassNames) ${"clickableCell" if isClickable else ""}"$(extra)>\n'
				+ '     ${' + numPipeInfo.qLabel + '.rows[row.index]' + multiColStr + '.ival}\n'
				+ '</div>\n'
				+ '\@else\n'
				+ '<$(tag) $(headers) class="cell nonempty element $(levels) ${"desktop" if this.grouping.cols else "mobile"} border-collapse $(extraClasses) ${col.group.styles.ss.groupClassNames if col.group else (row.group.styles.ss.groupClassNames if row.group else "")} $(col.styles.ss.colClassNames) $(row.styles.ss.rowClassNames) ${"clickableCell" if isClickable else ""}"$(extra)>\n'
				+ '     ${' + numPipeInfo.qLabel + '.rows[row.index]' + multiColStr + '.ival}\n'
				+ '</$(tag)>\n'
				+ '\@endif\n'
				+ ']]></style>\n';
	},
	
	leftBlankLegend: function(selText="") {
		return '  <res label="leftLegend">Left-blank-legend text</res>\n'
				+ '  <style name="question.left-blank-legend"><![CDATA[\n'
				+ '<$(tag) class="pseudo-col-legend nonempty">${res["%s,leftLegend" % this.label]}</$(tag)>\n'
				+ ']]></style>\n';
	},
	
	disableContinue: function(selText="") {
		return '<style name="buttons" mode="after" with="Q5" wrap="ready" arg:timeout="5"><![CDATA[\n'
				+ '$ ("#btn_continue,#btn_finish").prop("disabled", true);\n'
				+ 'setTimeout(function() {\n'
				+ '	$ ("#btn_continue,#btn_finish").prop("disabled", false);\n'
				+ '}, $(timeout)*1000);\n'
				+ ']]></style>\n';
	},
	
	maxDiff: function(selText="") {
		return '<style name="question.top-legend"> <![CDATA[\n'
				+ '\@if ec.simpleList\n'
				+ '    $(legends)\n'
				+ '\@else\n'
				+ '\@if this.styles.ss.colLegendHeight\n'
				+ '    <$(tag) class="row row-col-legends row-col-legends-top ${"mobile-top-row-legend " if mobileOnly else ""}${"GtTenColumns " if ec.colCount > 10 else ""}colCount-$(colCount)" style="height:${this.styles.ss.colLegendHeight};">\n'
				+ '\@else\n'
				+ '    <$(tag) class="row row-col-legends row-col-legends-top ${"mobile-top-row-legend " if mobileOnly else ""}${"GtTenColumns " if ec.colCount > 10 else ""}colCount-$(colCount)">\n'
				+ '\@endif\n'
				+ '    ${legends.split("</th>")[0]}</th>\n'
				+ '    $(left)\n'
				+ '    ${legends.split("</th>")[1]}</th>\n'
				+ '</$(tag)>\n'
				+ '\@if not simple\n'
				+ '</tbody>\n'
				+ '<tbody>\n'
				+ '\@endif\n'
				+ '\@endif\n'
				+ ']]></style>\n'
				+ '<style name="question.row"> <![CDATA[\n'
				+ '\@if ec.simpleList\n'
				+ '$(elements)\n'
				+ '\@else\n'
				+ '\@if this.styles.ss.rowHeight\n'
				+ '    <$(tag) class="row row-elements $(style) colCount-$(colCount)" style="height:${this.styles.ss.rowHeight};">\n'
				+ '\@else\n'
				+ '    <$(tag) class="row row-elements $(style) colCount-$(colCount)">\n'
				+ '\@endif\n'
				+ '${elements.split("</td>")[0]}</td>\n'
				+ '$(left)\n'
				+ '${elements.split("</td>")[1]}</td>\n'
				+ '</$(tag)>\n'
				+ '\@endif\n'
				+ ']]></style>\n';
	},
	
	colFix: function(selText="") {
		return '<style label="colFix" name="question.element"> <![CDATA[\n'
				+ '\@if ec.simpleList\n'
				+ '<div class="element $(rowStyle) $(levels) $(extraClasses) ${col.group.styles.ss.groupClassNames if col.group else (row.group.styles.ss.groupClassNames if row.group else "")} $(col.styles.ss.colClassNames) $(row.styles.ss.rowClassNames) ${"clickableCell" if isClickable else ""} row-${ec.row.label.replace("r","") if ec.row.label else "1"} col-${ec.col.label.replace("c","") if ec.col.label else "1"}" data-row="${ec.row.label.replace("r","") if ec.row.label else "1"}" data-col="${ec.col.label.replace("c","") if ec.col.label else "1"}"$(extra)>\n'
				+ '    ${v2_insertStyle(\'el.label.start\')}\n'
				+ '    $(text)\n'
				+ '    ${v2_insertStyle(\'el.label.end\')}\n'
				+ '</div>\n'
				+ '\@else\n'
				+ '<$(tag) $(headers) class="cell nonempty element $(levels) ${"desktop" if this.grouping.cols else "mobile"} border-collapse $(extraClasses) ${col.group.styles.ss.groupClassNames if col.group else (row.group.styles.ss.groupClassNames if row.group else "")} $(col.styles.ss.colClassNames) $(row.styles.ss.rowClassNames) ${"clickableCell" if isClickable else ""} row-${ec.row.label.replace("r","") if ec.row.label else "1"} col-${ec.col.label.replace("c","") if ec.col.label else "1"}" data-row="${ec.row.label.replace("r","") if ec.row.label else "1"}" data-col="${ec.col.label.replace("c","") if ec.col.label else "1"}"$(extra)>\n'
				+ '    ${v2_insertStyle(\'el.label.start\')}\n'
				+ '    $(text)\n'
				+ '    ${v2_insertStyle(\'el.label.end\')}\n'
				+ '</$(tag)>\n'
				+ '\@endif\n'
				+ ']]></style>\n';
	},
	
	colFixCopy: function(selText="") {
		return '<style copy="colFix" />';
	}
};




var cm__add = browser.contextMenus.create;

var get_i18n = browser.i18n.getMessage;

var cmControl = {
	id: "cm-control",
	title: get_i18n("cm_control"),
	contexts: ["all"],
	children: [
		{id: "makeTerm", title: get_i18n("cm_addTerm")},
		{id: "makeQuota", title: get_i18n("cm_addQuota")},
		{id: "makeValidate", title: get_i18n("cm_validateTag")},
		{id: "makeResource", title: get_i18n("cm_resourceTag")},
		{id: "makeExec", title: get_i18n("cm_execTag")},
		{id: "makeBlock", title: get_i18n("cm_blockTag")},
		{id: "makeBlockChildren", title: get_i18n("cm_blockTag_children")},
		{id: "makeLoop", title: get_i18n("cm_loopTag")},
		{id: "makeMarker", title: get_i18n("cm_makeMarker")},
		{id: "makeCondition", title: get_i18n("cm_makeCondition")}
	]
};

var cmQuestion = {
	id: "cm-question",
	title: get_i18n("cm_quesitonsElements"),
	contexts: ["all"],
	children: [
		//Question Types
		{id: "makeRadio", title: get_i18n("cm_makeRadio")},
		{id: "makeRating", title: get_i18n("cm_makeRating")},
		{id: "makeCheckbox", title: get_i18n("cm_makeCheckbox")},
		{id: "makeSelect", title: get_i18n("cm_makeSelect")},
		{id: "makeText", title: get_i18n("cm_makeText")},
		{id: "makeTextarea", title: get_i18n("cm_makeTextarea")},
		{id: "makeNumber", title: get_i18n("cm_makeNumber")},
		{id: "makeAutosum", title: get_i18n("cm_makeAutosum")},
		{id: "makeAutosumPercent", title: get_i18n("cm_makeAutosumPercent")},
		{id: "makeSurveyComment", title: get_i18n("cm_makeSurveyComment")},
		{id: "makeAutofill", title: get_i18n("cm_makeAutofill")},
		
		{id: "cm-sep-question-end", type: "separator"},
		
		//Question Elements
		{id: "makeRows", title: get_i18n("cm_makeRows")},
		{id: "makeRowsRatingUp", title: get_i18n("cm_makeRowsRatingUp")},
		{id: "makeRowsRatingDown", title: get_i18n("cm_makeRowsRatingDown")},
		{id: "makeCols", title: get_i18n("cm_makeCols")},
		{id: "makeColsRatingUp", title: get_i18n("cm_makeColsRatingUp")},
		{id: "makeColsRatingDown", title: get_i18n("cm_makeColsRatingDown")},
		{id: "makeChoices", title: get_i18n("cm_makeChoices")},
		{id: "makeChoicesRatingUp", title: get_i18n("cm_makeChoicesRatingUp")},
		{id: "makeChoicesRatingDown", title: get_i18n("cm_makeChoicesRatingDown")},
		{id: "makeNoAnswer", title: get_i18n("cm_makeNoAnswer")},
		{id: "makeGroups", title: get_i18n("cm_makeGroups")},
		{id: "makeQuestionComment", title: get_i18n("cm_makeQuestionComment")},
		{id: "makeAutofillRows", title: get_i18n("cm_makeAutofillRows")}
	]
};

var cmText = {
	id: "cm-text",
	title: get_i18n("cm_textMenu"),
	contexts: ["all"],
	children: [
		//Text Formatting
		{id: "makeTag_b", title: get_i18n("cm_makeTag_b")},
		{id: "makeTag_u", title: get_i18n("cm_makeTag_u")},
		{id: "makeTag_ub", title: get_i18n("cm_makeTag_ub")},
		{id: "makeTag_i", title: get_i18n("cm_makeTag_i")},
		{id: "makeTag_ul", title: get_i18n("cm_makeTag_ul")},
		{id: "makeTag_ol", title: get_i18n("cm_makeTag_ol")},
		{id: "makeTag_li", title: get_i18n("cm_makeTag_li")},
		{id: "makeTagLines_li", title: get_i18n("cm_makeTagLines_li")},
		{id: "addTag_br", title: get_i18n("cm_addTag_br")},
		{id: "addTag_brbr", title: get_i18n("cm_addTag_brbr")},
		{id: "makeTag_sup", title: get_i18n("cm_makeTag_sup")},
		{id: "makeTag_sub", title: get_i18n("cm_makeTag_sub")},
		{id: "makeTag_note", title: get_i18n("cm_makeTag_note")},
		{id: "makeTag_spanClass", title: get_i18n("cm_makeTag_spanClass")},
		{id: "makeTag_spanStyle", title: get_i18n("cm_makeTag_spanStyle")},
		
		{id: "cm-sep-textc-end", type: "separator"},

		//Attributes
		{id: "addOpen", title: get_i18n("cm_addOpen")},
		{id: "addExclusive", title: get_i18n("cm_addExclusive")},
		{id: "addAggregate", title: get_i18n("cm_addAggregate")},
		{id: "addRandomize", title: get_i18n("cm_addRandomize")},
		{id: "addOptional", title: get_i18n("cm_addOptional")},
		{id: "addShuffleRows", title: get_i18n("cm_addShuffleRows")},
		{id: "addWhereExecute", title: get_i18n("cm_addWhereExecute")},
		{id: "addGroupingCols", title: get_i18n("cm_addGroupingCols")},
		{id: "addMinRanks", title: get_i18n("cm_addMinRanks")},
		{id: "addOnLoadCopyRows", title: get_i18n("cm_addOnLoadCopyRows")},
		{id: "makeAttrs_alt", title: get_i18n("cm_makeAttrs_alt")},
		{id: "makeAttrs_group", title: get_i18n("cm_makeAttrs_group")},
		{id: "makeAttrs_value", title: get_i18n("cm_makeAttrs_value")},
		{id: "makeAttrs_value_up", title: get_i18n("cm_makeAttrs_value_up")},
		{id: "makeAttrs_value_down", title: get_i18n("cm_makeAttrs_value_down")}
	]
};

var cmMisc = {
	id: "cm-misc",
	title: get_i18n("cm_miscMenu"),
	contexts: ["all"],
	children: [
		{id: "relabelElements", title: get_i18n("cm_relabelElements")},
		{id: "swapRowCol", title: get_i18n("cm_swapRowCol")},
	]
};

var cmStandards = {
	id: "cm-standards",
	title: get_i18n("cm_standardsMenu"),
	contexts: ["all"],
	children: [
		{id: "makeUsStates", title: get_i18n("cm_makeUsStates")},
		{id: "makeUsStatesRegions", title: get_i18n("cm_makeUsStatesRegions")},
		{id: "makeCountries", title: get_i18n("cm_makeCountries")},
		
		{id: "cm-sep-copy-prot", type: "separator"},
		
		{id: "makeUnselectable_span", title: get_i18n("cm_makeUnselectable_span")},
		{id: "makeUnselectable_div", title: get_i18n("cm_makeUnselectable_div")},
		{id: "addUnselectable", title: get_i18n("cm_addUnselectable")},
		
		{id: "cm-sep-popups", type: "separator"},
		
		{id: "panel-popups", title: get_i18n("cm_addPopup")},
		{id: "addPopupTemplate", title: get_i18n("cm_addPopupTemplate")},
		{id: "addTooltipTemplate", title: get_i18n("cm_addTooltipTemplate")},
		
		{id: "cm-sep-std-misc", type: "separator"},
		
		{id: "rowOrderVirtual", title: get_i18n("cm_rowOrderVirtual")},
		{id: "panel-textInput-block", title: get_i18n("cm_childOrderBlock")},
		{id: "panel-textInput-loop", title: get_i18n("cm_childOrderLoop")},
		{id: "panel-textInput-dupe", title: get_i18n("cm_dupeCheckVar")},
	]
};

var cmXML = {
	id: "cm-xml",
	title: get_i18n("cm_xmlMenu"),
	contexts: ["all"],
	children: [
		{id: "addStyleBlank", title: get_i18n("cm_addStyleBlank")},
		{id: "panel-styles", title: get_i18n("cm_newStyleInstead")},
		{id: "addStyleLabel", title: get_i18n("cm_addStyleLabel")},
		{id: "addStyleCopy", title: get_i18n("cm_addStyleCopy")},
		{id: "surveyCss", title: get_i18n("cm_surveyCss")},
		{id: "surveyJs", title: get_i18n("cm_surveyJs")},
		{id: "questionCss", title: get_i18n("cm_questionCss")},
		{id: "questionJs", title: get_i18n("cm_questionJs")},
		{id: "questionJsHead", title: get_i18n("cm_questionJsHead")},
		
		{id: "cm-sep-ready-to-use", type: "separator"},
		
		{id: "leftBlankLegend", title: get_i18n("cm_leftBlankLegend")},
		{id: "panel-numberPipe", title: get_i18n("cm_numberPipe")},
		{id: "disableContinue", title: get_i18n("cm_disableContinue")},
		{id: "maxDiff", title: get_i18n("cm_maxDiff")},
		{id: "colFix", title: get_i18n("cm_colFix")},
		{id: "colFixCopy", title: get_i18n("cm_colFixCopy")}
	]
};

var cmMain = [
	cmControl,
	cmQuestion,
	cmText,
	cmMisc,
	cmStandards,
	cmXML,
	{
		id: "cm-sep-end-clips",
		contexts: ["all"],
		type: "separator"
	},
	{
		id: "cm-prefs",
		title: get_i18n("options"),
		contexts: ["all"]
	}
];

cmMain.forEach(function(cmItem, cmIndex, cmArr) {
	var currentId = cmItem.id;
	var currentCmObj = $.extend({},cmItem);
	if (typeof cmItem.children !== "undefined") delete currentCmObj.children;
	cm__add(currentCmObj);
	if (typeof cmItem.children !== "undefined") {
		cmItem.children.forEach(function(cmChild, childIndex, childrenArr) {
			$.extend(cmChild, {parentId: currentId});
			cm__add(cmChild);
		});
	}
});


var ts_message = browser.tabs.sendMessage;

// TO DO: Move TabText's and panel opener into helpers

// Set the text in the tab specified by _tabId
function setTabText(_tabId, _text) {
	var settingText = ts_message(_tabId, {type: "update-text", newText: _text});
}

// Get the selected text from the tab specified by _tabId,
// process it using the _cmId command
// and then set the text using setTabText
function replaceTabText(_tabId, _cmId) {
	var gettingText = ts_message(_tabId, {type: "get-text"}).then( response => {
		var receivedText = response.text;
		var selectedText = receivedText; // TO DO: Re-implement clipboard use
	
		switch (_cmId) {
    
				
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
			
			
			case "makeGroups":
				newText = clips.makeElements(selectedText,elType="groups");
				break;

			
			case "makeAutofillRows":
				newText = clips.makeElements(selectedText,elType="autofillRows");
				break;				
			
			
			//Text formatting
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
			
			//Attributes
	    
			case "makeAttrs_alt":
				newText = clips.makeAttrs(selectedText,attrName="alt");
				break;
	    
			case "makeAttrs_group":
				newText = clips.makeAttrs(selectedText,attrName="group",attrChars="g");
				break;
				
			case "makeAttrs_value":
				newText = clips.makeAttrs(selectedText,attrName="value");
				break;
				
			case "makeAttrs_value_up":
				newText = clips.makeAttrs(selectedText,attrName="value","",attrValues="up");
				break;
			
			case "makeAttrs_value_down":
				newText = clips.makeAttrs(selectedText,attrName="value","",attrValues="down");
				break;
			
			//Misc Clips
			
			case "makeUnselectable_span":
				newText = clips.makeUnselectable(selectedText,tag="span");
				break;
			
			case "makeUnselectable_div":
				newText = clips.makeUnselectable(selectedText,tag="div");
				break;
			
			
			default:
				newText = selectedText == "" ? clips[_cmId]() : clips[_cmId](selectedText);
				break;
		} //End switch
	
	var settingText = setTabText(_tabId, newText);
	}, reason => {
		console.log("###Text getter failed###");
		console.log(reason);
	});		
}

// Open the specified panel

function openPanel(whichPanel = "styles") {
	var panelSizes = {
		"styles": {width: 750, height: 740},
		"popups": {width: 600, height: 550},
		"numberPipe": {width: 550, height: 100},
		"textInput": {width: 420, height: 100}
	}
	
	if (Object.keys(panelSizes).indexOf(whichPanel) === -1) {
		console.log("Don't have a panel named " + whichPanel);
		return false;
	} 
	
	var openingPanel = browser.windows.create({
		type: "panel",
		width: panelSizes[whichPanel].width,
		height: panelSizes[whichPanel].height,
		url: browser.extension.getURL("src/panels/"+whichPanel+"_panel.html")
	}).catch(reason => {
		console.log("Failed opening panel");
		console.log(reason);
	});
}


var cm_addListener = browser.contextMenus.onClicked.addListener;
var rt_addListener = browser.runtime.onMessage.addListener;

// Context menu listener
function cmListener(cmdata, tab) {
	var cmId = cmdata.menuItemId;
	var cmUrl = typeof cmdata.pageUrl === "undefined" ? null : cmdata.pageUrl;
	var tabId = typeof tab.id === "undefined" ? null : tab.id;
	

	
	if ( cmId.indexOf("cm") !== -1 ) {
		// cm- menu items (explicitly handled menu items)
		// cm- items not mentioned here will have no effect on click	
		switch (cmId) {
			case "cm-prefs":
				var openingOptions = browser.runtime.openOptionsPage();
				break
			
			default:
				break;
		}
	} else {
		// panel- menu items (items opening panels)
		if ( cmId.indexOf("panel-") !== -1 ) {
			var panelSelector = cmId.split("-")[1];
			
			// Since panel will take focus, record activating tab id into volatile storage
			helpers.panelCommandInfo = {
				tabId: tabId
			};
			
			if (panelSelector == "textInput")
				helpers.panelCommandInfo.panelSubtype = cmId.split("-")[2];
			
			openPanel(panelSelector);		
			
		} else {
			// Non cm- and non-panel items (direct text replacement items)
			replaceTabText(tabId, cmId);	
		}
	}
}

// Runtime listener
function rtListener(message, tab, sendResponse) {

	switch (message.type) {
		// Styles panel command info request
		case "panel-command-info-request":
			sendResponse(helpers.panelCommandInfo);
			break;
		
		case "options-info-request":
			sendResponse({
				defaultOptions: helpers.defaultOptions,
				themes: helpers.themes
			});
			break;
		
		// Styles panel handler section
		case "style-selection":
			var commandInfo = message.commandInfo;
			var selectedStyle = message.style;
			var styleMode = message.mode;
			var styleType = message.styleType;
			
			if (styleType == "special") {
				var processedText = clips.newStyleSpecial(selectedStyle);
			} else {
				var processedText = styleMode === "instead" ? clips.newStyleInstead(selectedStyle) : clips.newStyleBeforeAfter(message);
			}
			
			setTabText(commandInfo.tabId, processedText);
			break;
		
		// Popups panel handler section
		case "popup-selection": 
			var commandInfo = message.commandInfo;
			var popupInfo = message.popupInfo;
			
			var processedText = popupInfo.codeType === "popup" ? clips.addPopup(popupInfo) : clips.addTooltip(popupInfo);
			
			setTabText(commandInfo.tabId, processedText);
			
			break;
		
		// Number pipe panel handler section
		case "num-pipe-selection":
			var commandInfo = message.commandInfo;
			
			var processedText = clips.numberPipe(message.numPipeInfo);
			
			setTabText(commandInfo.tabId, processedText);
		
		// Text input panel handler section (block, loop order virtual, dupe check by variable)
		case "text-input-selection":
			var commandInfo = message.commandInfo;
			
			switch (commandInfo.panelSubtype) {
				case "block":
					var processedText = clips.childOrderBlock(message.tInput);
					break;
					
				case "loop":
					var processedText = clips.childOrderLoop(message.tInput);
					break;
				
				case "dupe":
					var processedText = clips.dupeCheckVar(message.tInput);
					break;
				
				default:
					var processedText = "";
			}
		
			setTabText(commandInfo.tabId, processedText);
		
		default:
			break;
	
	}
}

cm_addListener(cmListener);
rt_addListener(rtListener);
