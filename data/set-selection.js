self.port.on("updateText",function(updatedText) {
	var tB = document.activeElement;
	
	if (tB.tagName.toLowerCase() == "input" || tB.tagName.toLowerCase() == "textarea") {
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

		var nHeight = textElement.scrollHeight - tHeight;
		tB.scrollTop = tPosition + nHeight;
	} else if (unsafeWindow.decipher && unsafeWindow.decipher.__editor__) {
		//If selection is in XML Editor CodeMirror
		unsafeWindow.decipher.__editor__.replaceSelection(updatedText);
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
});

