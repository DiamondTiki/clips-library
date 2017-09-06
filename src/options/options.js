$(function() {
	//Initialize the control group and correct rounding
	$(".prefs-sub-wrapper").controlgroup({
		"direction": "vertical"
	});
	
	$(".set-corner-bottom").switchClass("ui-corner-top ui-corner-left ui-corner-right ui-corner-all ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-bottom");
	$(".set-corner-all").switchClass("ui-corner-top ui-corner-bottom ui-corner-left ui-corner-right ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-all");
	$(".children-set-corner-all").children().switchClass("ui-corner-top ui-corner-bottom ui-corner-left ui-corner-right ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-all");
	$(".set-corner-top").switchClass("ui-corner-bottom ui-corner-left ui-corner-right ui-corner-all ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-top");

	var storage = browser.storage.local;	
	var background = browser.extension.getBackgroundPage();
	
	var defaultOptions = $.extend({}, background.helpers.defaultOptions);
	
	var currentOptions;
	
	var refreshTheme = function(newClass) {
		$ ("body").removeClass( background.helpers.themes.join(" ") ).addClass(newClass);
	}
	
	var onError = function(err) {
		console.log("Promise rejected");
		console.log(err)
	}
	
	var gettingOptions = storage.get({
		options: defaultOptions
	}).then(response => {
		currentOptions = response.options;
		
		refreshTheme("ui-theme-" + currentOptions.theme);
		
		$ (".prefs-wrapper").find("input").each(function() {
			if ($ (this).is(":checkbox")) {
				$ (this).prop("checked", currentOptions[$ (this).attr("name")]).change();
			} else if ($ (this).is(":radio") && $ (this).attr("value") === currentOptions[$ (this).attr("name")]) {
				$ (this).prop("checked", true).change();
			}
		});
		
		$ (".prefs-wrapper").on("change", "input", function() {
			var hasChange = false;
			var optName = $ (this).attr("name");
			if ($ (this).is(":checkbox")) {
				var optValue = $ (this).prop("checked");
				
				currentOptions[optName] = optValue;
				
				hasChange = true;
				
				
			} else if ($ (this).is(":radio:checked")) {
				optValue = $ (this).attr("value");
				
				currentOptions[optName] = optValue;
				
				hasChange = true;
			}
			
			if (hasChange) {
				storage.set({
					options: currentOptions
				}).then(null,onError);
			}
			
			if (optName == "theme") {
				refreshTheme("ui-theme-" + currentOptions.theme)
			}
		});
		
		//Blur a checkbox on uncheck so the button default state is shown
		$("[type=checkbox]").change(function(){
			if (!$ (this).is(":checked")) {
				$ (this).blur();
			}
		});
		
	}, onError);
});



