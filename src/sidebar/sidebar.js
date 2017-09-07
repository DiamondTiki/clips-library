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
	
	$(".tabs-wrapper").tabs();
	
	$("#prefsButton").click(function() {
		var openingOptions = browser.runtime.openOptionsPage();
	});
	
	var background = browser.extension.getBackgroundPage();
	
	var defaultOptions = background.helpers.defaultOptions;
	
	var themes = background.helpers.themes;
	
	var refreshTheme = function() {
		var gettingOptions = storage.get({options: defaultOptions}).then((response) => {
			currentOptions = response.options;			
			refreshTheme(".ui-theme"+currentOptions.theme);
			$ ("body")
				.removeClass( themes.join(" ") )
				.addClass("ui-theme-"+currentOptions.theme);
		});		
	}
	
	var currentOptions;
	
	var storage = browser.storage.local;
	
	refreshTheme();
	
	browser.storage.onChanged.addListener(refreshTheme);
	
	var gettingActiveTab = browser.tabs.query({
		active: true,
		currentWindow: true
	}).then( tabArray => {
		var activeTab = tabArray[0];
		var tabId = activeTab.id;
		
		$(document).on("click",".clips-list button",function() {
			let cmId = $(this).data("clip");
			
			if ( cmId.indexOf("panel-") !== -1 ) {
				background.helpers.panelCommandInfo = {
					tabId: tabId
				};
				
				var panelSelector = cmId.split("-")[1];
				
				if (panelSelector == "textInput")
					background.helpers.panelCommandInfo.panelSubtype = cmId.split("-")[2];
				
				background.openPanel(panelSelector);
			} else {
				background.replaceTabText(tabId, cmId);
			}
		});
	})
});