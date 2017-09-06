$(function() {
	$(".ctrlg-wrapper").each(function() {
		$ (this).controlgroup({
			"direction": "vertical"
		});
	});
	$(".accordion-wrapper").accordion({
		collapsible: true,
		heightStyle: "auto"
	});
	
	$("#prefsButton").button({
		icons: {primary: "ui-icon-gear"},
	});
	
	$("#prefsButton").click(function() {
		var openingOptions = browser.runtime.openOptionsPage();
	});
	
	var background = browser.extension.getBackgroundPage();
	
	var gettingActiveTab = browser.tabs.query({
		active: true,
		currentWindow: true
	}).then( tabArray => {
		var activeTab = tabArray[0];
		var tabId = activeTab.id;
		
		$(document).on("click",".clips-list button",function() {
			let clipCommand = $(this).data("clip");
			

			if (clipCommand == "newStyle") {
				browser.windows.getCurrent().then(thisWindow => {
					return browser.tabs.query({windowId: thisWindow.id, active: true}) ;
				}).then( queryTabs => {
					background.helpers.panelCommandInfo = {
						tabId: queryTabs[0].id
					};
					background.openPanel("styles");
				}).catch(reason => {console.log(reason)});			
			} else {
				background.replaceTabText(tabId, clipCommand);
			}
		});
	})
});