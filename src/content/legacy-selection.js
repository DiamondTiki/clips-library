/*Get Selection*/

self.on("context", function (node) {
	self.postMessage({type:"context"});
	return true;
});

self.on("click", function (node, cmdata) {
	var strSelected = null;
	var textElement = document.activeElement;
	
	// Get selected text and element's content
	if (unsafeWindow.decipher && unsafeWindow.decipher.__editor__) {
		//If selection is in XML Editor CodeMirror
		strSelected = unsafeWindow.decipher.__editor__.doc.getSelection();
	} else if (textElement.tagName == "INPUT" || textElement.tagName == "TEXTAREA") {
		// For input/text areas
		var startPos = textElement.selectionStart;
		var endPos = textElement.selectionEnd;
		strSelected = $ (textElement).val().substring(startPos, endPos)
	} else {
		strSelected = document.getSelection().toString();
	}
	self.postMessage({type: "click", text: strSelected, data: cmdata});
});

/*Get Selection Sidebar*/

self.port.on("get-text", function (clipCommand) {
	console.log("started get-selection-sidebar");
	console.log(clipCommand);
	var strSelected = null;
	var textElement = document.activeElement;
	
	// Get selected text and element's content
	if (textElement.tagName == "INPUT" || textElement.tagName == "TEXTAREA") {
		// For input/text areas
		var startPos = textElement.selectionStart;
		var endPos = textElement.selectionEnd;
		strSelected = textElement.value.substring(startPos, endPos);
	} else {
		strSelected = document.getSelection().toString();
	}
	self.port.emit("selected-text", {command: clipCommand, selection: strSelected});
});

/*Set selection */
self.port.on("updateText",function(updatedText) {
	var tB = document.activeElement;
	
	if (unsafeWindow.decipher && unsafeWindow.decipher.__editor__) {
		//If selection is in XML Editor CodeMirror
		unsafeWindow.decipher.__editor__.replaceSelection(updatedText);
	} else if (tB.tagName.toLowerCase() == "input" || tB.tagName.toLowerCase() == "textarea") {
		//if selection is in a text box
		var tPosition = tB.scrollTop;
		var tHeight = tB.scrollHeight;
		var fullValue = tB.value ? tB.value : '';

		var selEnd = tB.selectionStart + updatedText.length;
		var valueStart = fullValue.substring(0, tB.selectionStart);
		var valueEnd = fullValue.substring(tB.selectionEnd, fullValue.length);
		tB.value = valueStart + updatedText + valueEnd;
		tB.focus();
		tB.setSelectionRange(selEnd, selEnd);

		var nHeight = tB.scrollHeight - tHeight;
		tB.scrollTop = tPosition + nHeight;
	} else {
		var selection = document.getSelection();
		if (!!selection.anchorNode) {
			var selectionContainer = selection.getRangeAt(0).commonAncestorContainer;
			if(selectionContainer.isContentEditable || selectionContainer.parentElement.isContentEditable) {
				//IF selection is in a contentEditable element
				document.execCommand('insertText', false, updatedText);
			}
		}
	}
	
	self.port.emit("textUpdated")
});

