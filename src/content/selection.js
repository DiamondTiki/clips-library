browser.runtime.onMessage.addListener( textHandler );

function textHandler(message, senderObj, sendResponse) {
	var command = message.type;
	if (command == "get-text") {

		var strSelected = null;
		var textElement = document.activeElement;
		
		
		
		// Get selected text and element's content
		if (window.wrappedJSObject.decipher && window.wrappedJSObject.decipher.__editor__) {
			//If selection is in XML Editor CodeMirror
			strSelected = window.wrappedJSObject.decipher.__editor__.doc.getSelection();
		} else if (textElement.tagName == "INPUT" || textElement.tagName == "TEXTAREA") {
			// For input/text areas
			var startPos = textElement.selectionStart;
			var endPos = textElement.selectionEnd;
			strSelected = $ (textElement).val().substring(startPos, endPos)
		} else {
			strSelected = document.getSelection().toString();
		}
		
		if (typeof strSelected !== "string") 
			sendResponse({text: "###Selection is not text###"})
		else
			sendResponse({text: strSelected});

	} else if (command == "update-text") {

		var updatedText = message.newText;
		var tB = document.activeElement;
		
		if (window.wrappedJSObject.decipher && window.wrappedJSObject.decipher.__editor__) {
			//If selection is in XML Editor CodeMirror
			window.wrappedJSObject.decipher.__editor__.replaceSelection(updatedText);
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
	}
};