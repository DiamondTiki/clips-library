$(function() {
	$(document).on("click",".numberPipe-panel button",function() {
		let thisQType = $(this).data("qtype");
		let thisQLabel = $(this).closest(".ctrlg-wrapper").find("#qLabel").val();
		let numPipeInfo = {
			qType: thisQType,
			qLabel: thisQLabel
		};
		
		browser.runtime.sendMessage({
			type: "num-pipe-selection", 
			numPipeInfo: {qType: thisQType, qLabel: thisQLabel},
			commandInfo: commandInfo,
			
		});
		
		browser.tabs.getCurrent().then(thisTab => {
			browser.tabs.remove(thisTab.id);
		});
	});
});