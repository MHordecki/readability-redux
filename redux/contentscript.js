
function cmp_arrays(a, b)
{
    if(a.length != b.length)
        return false;

    for(var i = 0; i < a.length; i++)
    {
        if(a[i] != b[i])
            return false;
    }

    return true;
}

function remove(a, el)
{
    for(var i = 0; i < a.length; i++)
    {
        if(a[i] == el)
        {
            a.splice(i, 1);
            return;
        }
    }
}

function contains(a, el)
{
    for(var i = 0; i < a.length; i++)
    {
        if(a[i] == el)
        {
            return true;
        }
    }

    return false;
}

var listener = {
    enabled: false,
    goal: [17, 88],
    current_state: [],

    callback: function()
    {
        chrome.extension.sendRequest({'type': 'render'}, function(r) {});
    },

    onkeydown: function(e)
    {
        if(!this.enabled) return false;

        if(!((e.which >= 65 && e.which <= 90) || e.which == 16 || e.which == 17 || e.which == 18))
            return false;

        if(contains(this.current_state, e.which))
            return false;

        this.current_state.push(e.which);
        this.current_state.sort();

        if(cmp_arrays(this.goal, this.current_state))
        {
            this.current_state = [];
            this.callback();
        }

        //console.log('keydown ' + e.which + ' => ' + this.current_state.toString());

        return false;
    },

    onkeyup: function(e)
    {
        if(!this.enabled) return false;

        if(!((e.which >= 65 && e.which <= 90) || e.which == 16 || e.which == 17 || e.which == 18))
            return false;

        remove(this.current_state, e.which);
        //console.log('keyup ' + e.which + ' => ' + this.current_state.toString());

        return false;
    }

};

function prepare_callbacks()
{
    document.body.addEventListener('keydown', function(e) {listener.onkeydown(e);}, false);
    document.body.addEventListener('keyup', function(e) {listener.onkeyup(e);}, false);
}


function refresh_settings(settings)
{
    listener.enabled = settings["enable_keys"];
    listener.goal = settings["keys"];
}

/*
chrome.extension.onRequest.addListener(function(data, sender, callback)
{
    if(data['type'] === "settings_changed")
    {
        refresh_settings(data['settings']);  
    }  
});
*/

chrome.extension.sendRequest({'type': 'get_settings'}, function(r) { refresh_settings(r); });
prepare_callbacks();
