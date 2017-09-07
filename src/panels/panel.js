var commandInfo = null;

$(function() {
	// General setup
	$(".ctrlg-wrapper.vert").each(function() {
		$ (this).controlgroup({
			"direction": "vertical"
		});
				
	});	
	
	
	$(".ctrlg-wrapper.hor").each(function() {
		$ (this).controlgroup({
			"direction": "horizontal"
		}).filter(".noicons")
			.find(":radio,:checkbox")
			.checkboxradio("option", "icon", false);
	});
	
	$(".accordion-wrapper").accordion({
		heightStyle: "auto"
	});
	
	$(".tabs-wrapper").tabs();
	
	$ ("button.lone-button").button();
	
	// Disable the controlgroups while we get the tabid from the background page
	$(".ctrlg-wrapper").each(function() {$ (this).controlgroup("disable")});
	
	// Getting the target tabid for eventual text insertion
	// Once gotten, re-enable control groups
	var gettingCommandInfo = browser.runtime.sendMessage({
		type: "panel-command-info-request"
	}).then((response) => {
		commandInfo = response;
		$(".ctrlg-wrapper").each(function() {$ (this).controlgroup("enable")});
	},(reason) => {
		console.log("Failed getting panel command info (tab id) from background");
		console.log(reason);
	});

	$(".set-corner-bottom").switchClass("ui-corner-top ui-corner-left ui-corner-right ui-corner-all ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-bottom");
	$(".set-corner-all").switchClass("ui-corner-top ui-corner-bottom ui-corner-left ui-corner-right ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-all");
	$(".children-set-corner-all").children().switchClass("ui-corner-top ui-corner-bottom ui-corner-left ui-corner-right ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-all");
	$(".set-corner-top").switchClass("ui-corner-bottom ui-corner-left ui-corner-right ui-corner-all ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-top");	
	$(".set-corner-none").removeClass("ui-corner-bottom ui-corner-left ui-corner-right ui-corner-all ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br ui-corner-top");
	$(".children-set-corner-none").children().removeClass("ui-corner-top ui-corner-bottom ui-corner-left ui-corner-right ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br ui-corner-all");
});