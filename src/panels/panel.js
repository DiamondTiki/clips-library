var background = browser.extension.getBackgroundPage();
var commandInfo = background.helpers.panelCommandInfo;

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
	
	$ ("button.lone-button").button();

	$(".set-corner-bottom").switchClass("ui-corner-top ui-corner-left ui-corner-right ui-corner-all ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-bottom");
	$(".set-corner-all").switchClass("ui-corner-top ui-corner-bottom ui-corner-left ui-corner-right ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-all");
	$(".children-set-corner-all").children().switchClass("ui-corner-top ui-corner-bottom ui-corner-left ui-corner-right ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-all");
	$(".set-corner-top").switchClass("ui-corner-bottom ui-corner-left ui-corner-right ui-corner-all ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br", "ui-corner-top");	
	$(".set-corner-none").removeClass("ui-corner-bottom ui-corner-left ui-corner-right ui-corner-all ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br ui-corner-top");
	$(".children-set-corner-none").children().removeClass("ui-corner-top ui-corner-bottom ui-corner-left ui-corner-right ui-corner-tl ui-corner-tr ui-corner-bl ui-corner-br ui-corner-all");
	
	// Styles panel section
	if ($ ("body").data("panel") === "styles") {
		var styleMode = typeof(styleMode) === "undefined" ? "instead" : styleMode;
		
		$(document).on("click",".styles-panel .mode-wrapper :radio", function() {
			if ($ (".mode-wrapper :radio:checked").length > 0)
				styleMode = $ (".mode-wrapper :radio:checked").attr("value");
		});
		
		$(document).on("click",".styles-panel button",function() {
			console.log("clicked a style button");
			let thisStyle = $(this).text();
			browser.runtime.sendMessage({
				type: "style-selection", 
				style: thisStyle,
				mode: styleMode,
				commandInfo: commandInfo
			});
			browser.tabs.getCurrent().then(thisTab => {
				var closing = browser.tabs.remove(thisTab.id);
			}, reason => {
				console.log("Failed getting current tab");
				console.log(reason);
			});		
		});
	}
	
	// Popups panel section
	
	if ($ ("body").data("panel") === "popups") {
		$ (".type-wrapper").on("change", ":radio", function() {
			if ( $ (this).is(":checked[value=tooltip]") ) {
				$ (".popup-attr").hide();
			} else {
				$ (".popup-attr").show();
			}
		});
		
		$ (".code-text :text").each(function() {
			$ (this).outerHeight( $ (this).prev().outerHeight() );
		});
		
		
		$ (".code-table td").each( () => {
			$ (this).find(".code-label,textarea").outerWidth( $ (this).find(".code-radio").outerWidth() );			
		});
		
		$ (".code-table .ta-wrapper").height($ (".code-table .ta-wrapper").height());
		
		$ (".code-table").on("change", ":radio", function() {
			console.log(this);
			if ($ (this).is("[value=image]:checked")) {
				$ (this).closest("td").find("textarea").attr("rows","1");
			} else if ($ (this).is("[value=text]:checked")) {
				$ (this).closest("td").find("textarea").attr("rows","7");
			}
		});
		
		$ (".exec-button").on("click", function() {
			var popupInfo = {};
			$ ("input,textarea").each(function() {
				if ($ (this).is(":radio:checked")) {
					popupInfo[$ (this).attr("name")] = $ (this).attr("value");
				} else if ($ (this).is("textarea,:text")) {
					popupInfo[$ (this).attr("name")] = $ (this).val();
				}
			});
			
			browser.runtime.sendMessage({
				type: "popup-selection", 
				popupInfo: popupInfo,
				commandInfo: commandInfo
			});
			
			browser.tabs.getCurrent().then(thisTab => {
				var closing = browser.tabs.remove(thisTab.id);
			}, reason => {
				console.log("Failed getting current tab");
				console.log(reason);
			});
		})
	}
});