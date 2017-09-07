$(function() {
	var styleMode = typeof(styleMode) === "undefined" ? "instead" : styleMode;
	
	$(document).on("click",".styles-panel .mode-wrapper :radio", function() {
		if ($ (".mode-wrapper :radio:checked").length > 0)
			styleMode = $ (".mode-wrapper :radio:checked").attr("value");
	});
	
	$(document).on("click",".styles-panel button",function() {
		console.log("clicked a style button");
		let thisStyle = $(this).text();
		let thisStyleType = $(this).closest(".tab").is("#tabs-special") ? "special" : "basic";
		browser.runtime.sendMessage({
			type: "style-selection", 
			styleType: thisStyleType,
			style: thisStyle,
			mode: styleMode,
			commandInfo: commandInfo,
			
		});
		
		browser.tabs.getCurrent().then(thisTab => {			
			browser.tabs.remove(thisTab.id);
		});
	});
});