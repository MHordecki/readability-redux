
var settings = {

    init: function()
    {
        $('select').change(_.bind(function() { this.preview(); this.markDirty(); }, this)); 
        $('input').change(_.bind(this.markDirty, this)); 

        $('#cancel').click(_.bind(this.load, this));
        $('#save').click(_.bind(this.save, this));

        this.load();
    },

    getSelect: function(name)
    {
        return $('#' + name).val();
    },

    setSelect: function(name, value)
    {
        if($('#' + name + ' option[value=' + value + ']')
           .attr('selected', 'selected')
           .val() === undefined)
           $('#' + name + ' option:first-child').attr('selected', 'selected');
    },

    markDirty: function()
    {
        $('#save').attr('disabled', '');
    },

    markClean: function()
    {
        $('#save').attr('disabled', 'disabled');
    },

    save: function()
    {
        var settings = {
            style: this.getSelect('r_style'),
            size: this.getSelect('r_size'),
            margin: this.getSelect('r_margin'),
            enable_links: $('#enable_links').attr('checked'),
            enable_experimental: $('#enable_experimental').attr('checked'),
            enable_keys: $('#enable_keys').attr('checked'),
            keys: keybox.keys
        };

        console.log(settings);
        
        chrome.extension.sendRequest(
            {'type': 'setSettings', 'settings': settings},
            _.bind(this.markClean, this));
    },

    load: function()
    {
        chrome.extension.sendRequest({'type': 'getSettings'}, _.bind(function(settings)
        {
            this.setSelect('r_style', settings['style']);
            this.setSelect('r_size', settings['size']);
            this.setSelect('r_margin', settings['margin']);
            $('#enable_links').attr('checked', settings['enable_links']);
            
            keybox.keys = settings['keys'];
            if(settings['enable_keys'])
                keybox.enable();
            else
                keybox.disable();

              $('#enable_experimental').attr('checked', settings['enable_experimental']);

            keybox.update();
            this.preview()
            this.markClean();
        }, this));
    },

    /* This is a bit wicked, but doing plain simple 
     * location = 'javascript:...' resulted in blank iframe.
     */
    hello_from_child: function(preview_window)
    {
        this.preview_window = preview_window;
        this.preview();
    },

    preview_window: null,

    preview: function()
    {
        var settings = {
            style: this.getSelect('r_style'),
            size: this.getSelect('r_size'),
            margin: this.getSelect('r_margin')
        };

        chrome.extension.sendRequest({'type': 'javascript', 'settings': settings}, _.bind(function(js)
        {
            if(this.preview_window !== null)
            {
                this.preview_window.inject(js);
            }
            else console.log('ZOMG! Preview window IS NULL!');
        }, this));
    }
};


var keybox = {
    pressed: 0,
    keys: [],
    enabled: false,

    init: function()
    {
        $('#keys').keydown(_.bind(this.keydown, this));
        $('#keys').keyup(_.bind(this.keyup, this));
        $('#keys').focus(_.bind(this.focus, this));
        $('#keys').blur(_.bind(this.blur, this));
        $('#enable_keys').change(_.bind(this.checkbox, this));
    },

    enable: function()
    {
        $('#enable_keys').attr('checked', 'checked');
        $('#keys').css('background-color', '');
        $('#keys').css('color', '');
        this.enabled = 1;
    },

    disable: function()
    {
        $('#enable_keys').attr('checked', '');
        $('#keys').css('background-color', 'silver');
        $('#keys').css('color', 'gray');
        this.enabled = 0;
    },

    checkbox: function()
    {
        if($('#enable_keys').attr('checked'))
            this.enable();
        else
            this.disable();
    },

    // It sometimes fails, like when Ctrl+Shift+U, U has a strange key code 229. Dunno why.
    keydown: function(e)
    {
        if(!this.enabled)
            return;

        if(!((e.which >= 65 && e.which <= 90) || e.which == 16 || e.which == 17 || e.which == 18))
            return false;

        if(this.pressed == 0)
            this.keys = [];

        if(_.include(this.keys, e.which)) // Degenerate situation
        {
            this.keys = [];
            this.pressed = 0;
        }

        this.keys.push(e.which);
        this.pressed++;

        settings.markDirty();
        this.update();
    },

    keyup: function(e)
    {
        if(!this.enabled)
            return;

        if(!((e.which >= 65 && e.which <= 90) || e.which == 16 || e.which == 17 || e.which == 18))
            return false;

        this.pressed--;

        this.update();
    },

    update: function()
    {
        var value = [];
        this.keys.sort();

        for(var i = 0; i < this.keys.length; i++)
        {
            var key = this.keys[i];
            if(key >= 65 && key <= 90)
                value.push(String.fromCharCode(key));

            if(key == 16)
                value.push("Shift");

            if(key == 17)
                value.push("Ctrl");

            if(key == 18)
                value.push("Alt");
        }

        $("#keys").attr('value', value.join(' + '));
    },

    focus: function()
    {
        if(!this.enabled)
            return;

        $('#keys').css('background-color', '#ebeff9');
    },

    blur: function()
    {
        if(!this.enabled)
            return;

        $('#keys').css('background-color', '');
        $('#keys').css('color', '');
    }
};

$(document).ready(function()
{
    $('#example iframe').ready(function()
    {
        settings.init();
        keybox.init();
    });
});

