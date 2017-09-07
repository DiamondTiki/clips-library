$(function() {
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
			browser.tabs.remove(thisTab.id);
		});
	});
});