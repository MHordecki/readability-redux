
function create_javascript(settings)
{

    //LOCAL LINKS
    var js_url = chrome.extension.getURL('readability/readability.js');
    var css_url = chrome.extension.getURL('readability/readability.css');
    var print_url = chrome.extension.getURL('readability/readability-print.css');

    if(settings['remote'] === true) // REMOTE LINKS
    {
        console.log('Using remote Readability.');

        js_url = "http://lab.arc90.com/experiments/readability/js/readability.js?x="+(Math.random());
        css_url = "http://lab.arc90.com/experiments/readability/css/readability.css";
        print_url = "http://lab.arc90.com/experiments/readability/css/readability-print.css";
    }
    

    var code = "javascript:(function(){readStyle='" + settings['style'] + "';readSize='" + settings['size'] + "';readMargin='" + settings['margin'] + "';_readability_script=document.createElement('SCRIPT');_readability_script.type='text/javascript';_readability_script.src='" + js_url + "';document.getElementsByTagName('head')[0].appendChild(_readability_script);_readability_css=document.createElement('LINK');_readability_css.rel='stylesheet';_readability_css.href='" + css_url + "';_readability_css.type='text/css';_readability_css.media='screen';document.getElementsByTagName('head')[0].appendChild(_readability_css);_readability_print_css=document.createElement('LINK');_readability_print_css.rel='stylesheet';_readability_print_css.href='" + print_url + "';_readability_print_css.media='print';_readability_print_css.type='text/css';document.getElementsByTagName('head')[0].appendChild(_readability_print_css);})();";

    return code;
}

function render(tab)
{
    var settings = get_settings();
    console.log(settings);

    chrome.tabs.update(tab.id, { url: create_javascript(settings) });
}

function on_request(request, sender, sendResponse)
{
    if(request.type == 'render')
    {
        render(sender.tab);
    }

    sendResponse({});
}
                                                                
function get_settings()
{
    var settings = {
        style: localStorage['style'],
        size: localStorage['size'],
        margin: localStorage['margin']
    };

    var defaults = {
        style: 'style-newspaper',
        size: 'size-large',
        margin: 'margin-wide'
    };

    _.each(defaults, function(val, key)
        {
            if(!_.include(_.keys(settings), key))
            {
                settings[key] = val;
            }
        });

    return settings;
}

function set_settings(settings)
{
    _.extend(localStorage, settings);
}

