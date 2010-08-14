
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
            render();
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
    },

    setSettings: function(settings)
    {
        this.enabled = settings["enable_keys"];
        this.goal = settings["keys"];
        this.current_state = [];
        console.log(settings);
    }

};

function render()
{
    chrome.extension.sendRequest({'type': 'javascript'}, function(response)
    {
        var script = document.createElement('script');
        script.appendChild(document.createTextNode(response));
        console.log(document.getElementsByTagName('head'));
        document.getElementsByTagName('head')[0].appendChild(script);
    });
}

chrome.extension.onRequest.addListener(function(data, sender, callback)
{
    if(data['type'] === "render")
    {
        render();
    } else
    if(data['type'] == 'newSettings')
    {
        listener.setSettings(data['settings']);
    }
});

chrome.extension.sendRequest({'type': 'getSettings'}, function(r) { listener.setSettings(r); });

document.body.addEventListener('keydown', function(e) {listener.onkeydown(e);}, false);
document.body.addEventListener('keyup', function(e) {listener.onkeyup(e);}, false);

