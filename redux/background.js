/* vim:noet:ts=4:sw=4
 */

var default_settings = {
	style: 'style-newspaper',
	size: 'size-large',
	margin: 'margin-wide',
	enable_footnotes: false,
	enable_keys: false,
	enable_experimental: false,
	remote: true,
	keys: []
};


function createJavascript(settings)
{
	var js_url, css_url, print_url;

	if (settings.remote && !settings.enable_experimental) {
		var arc90 = "http://lab.arc90.com/experiments/readability/";
		js_url = arc90 + "js/readability.js?x="+(Math.random());
		css_url = arc90 + "/css/readability.css";
		print_url = arc90 + "/css/readability-print.css";
	} else {
		if (settings.enable_experimental)
		{
			js_url = chrome.extension.getURL('readability/readability-x.js');
		} else {
			js_url = chrome.extension.getURL('readability/readability.js');
		}

		css_url = chrome.extension.getURL('readability/readability.css');
		print_url = chrome.extension.getURL('readability/readability-print.css');
	}

	var code = "(function(){readConvertLinksToFootnotes=" + settings['enable_footnotes'] + ";readStyle='" + settings['style'] + "';readSize='" + settings['size'] + "';readMargin='" + settings['margin'] + "';_readability_script=document.createElement('SCRIPT');_readability_script.type='text/javascript';_readability_script.src='" + js_url + "';document.getElementsByTagName('head')[0].appendChild(_readability_script);_readability_css=document.createElement('LINK');_readability_css.rel='stylesheet';_readability_css.href='" + css_url + "';_readability_css.type='text/css';_readability_css.media='screen';document.getElementsByTagName('head')[0].appendChild(_readability_css);_readability_print_css=document.createElement('LINK');_readability_print_css.rel='stylesheet';_readability_print_css.href='" + print_url + "';_readability_print_css.media='print';_readability_print_css.type='text/css';document.getElementsByTagName('head')[0].appendChild(_readability_print_css);})();";

	return code;
}

function render(tab_id)
{
	chrome.tabs.sendRequest(tab_id, {'type': 'render'});
}

function getSettings()
{
	var settings = {};
	for (var opt in default_settings) {
		settings[opt] = default_settings[opt];
		if (!_.isUndefined(localStorage[opt])) {
			settings[opt] = JSON.parse(localStorage[opt]);
		}
	}

	return settings;
}

function setSettings(settings)
{
//	console.log('setSettings called with ' + JSON.stringify(settings));
	for (var opt in default_settings) {
		if (_.isUndefined(settings[opt]) || settings[opt] === '') {
			continue;
		}
		if (typeof(default_settings[opt]) == 'boolean' &&
				typeof(settings[opt]) != 'boolean') {
			settings[opt] = settings[opt] == 'true';
		}
		localStorage[opt] = JSON.stringify(settings[opt]);
	}
//	console.log('Settings now: ' + JSON.stringify(localStorage));

	chrome.windows.getAll({'populate': true}, function(windows)
	{
		_.each(windows, function(window)
		{
			_.each(window.tabs, function(tab)
			{
				chrome.tabs.sendRequest(tab.id, {'type': 'newSettings', 'settings': getSettings()});
			});
		});
	});
}

function requestHandler(data, sender, callback)
{
	var result = undefined;

	if (data['type'] == 'javascript') {
		if (_.include(_.keys(data), 'settings'))
			result = createJavascript(data['settings']);
		else
			result = createJavascript(getSettings());
	}

	if (data['type'] == 'setSettings') {
		setSettings(data['settings']);
	}

	if (data['type'] == 'getSettings') {
		result = getSettings();
	}

	if (data['type'] == 'render') {
		render(data['tab_id']);
	}

	callback(result);
}

chrome.extension.onRequest.addListener(requestHandler);
chrome.extension.onRequestExternal.addListener(requestHandler);

chrome.browserAction.onClicked.addListener(function(tab)
{
	render(tab.id);
});

