self.on("context", function (node) {
	self.postMessage({type:"context"});
	return true;
});

self.on("click", function (node, cmdata) {
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
	self.postMessage({type: "click", text: strSelected, data: cmdata});
});


/*
console.log("alive");
self.on("click", function (node, data) {
  self.postMessage("You clicked " + data);
});
*/