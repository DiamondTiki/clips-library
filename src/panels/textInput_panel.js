$(function() {
	$(document).on("click",".textInput-panel button",function() {
		let thisTInput = $(this).closest(".ctrlg-wrapper").find("#tInput").val();

		browser.runtime.sendMessage({
			type: "text-input-selection", 
			tInput: thisTInput,
			commandInfo: commandInfo,
			
		});
		
		browser.tabs.getCurrent().then(thisTab => {
			browser.tabs.remove(thisTab.id);
		});
	});
});