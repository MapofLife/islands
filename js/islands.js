//some globals
var map, 
    vis, 
    layer, 
    cdb_api = "http://d3dvrpov25vfw0.cloudfront.net/api/v1/sql?q={0}";

// Extend String with this handy string formatting method.
String.prototype.format = function(i, safe, arg) {
    function format() {
        var str = this, len = arguments.length + 1;

        for ( i = 0; i < len; arg = arguments[i++]) {
            safe = typeof arg === 'object' ? JSON.stringify(arg) : arg;
            str = str.replace(RegExp('\\{' + (i - 1) + '\\}', 'g'), safe);
        }
        return str;
    }


    format.native = String.prototype.format;
    return format;
}();
//Initialize the CartoDB visualization and Google map controls.
function main() {
    cartodb.createVis(
        'map',
        'http://mol.cartodb.com/api/v2/viz/65652344-9026-11e3-994f-6805ca06688a/viz.json', 
        //'http://mol.cartodb.com/api/v1/viz/gadm_islands_join_names/viz.json', 
        {cartodb_logo : false}
    ).done(function(viz, layer) {
        var logo = $('<DIV id="logo">by Map of Life, 2013</div>');
        $(logo).click(function() {
            window.open('http://www.mappinglife.org', '_mol');
        });
        vis = viz;
        lay = layer;
        map = vis.getNativeMap();

        createSlider();

        map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(logo[0]);
        map.setOptions({
            mapTypeId : google.maps.MapTypeId.TERRAIN,
            mapTypeControl : true,
            mapTypeControlOptions : {
                style : google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position : google.maps.ControlPosition.TOP_RIGHT
            }
        });

        $('.cartodb-logo').remove();
        $('#cartodb-gmaps-attribution').remove();

        initAutocomplete();
    });

    //init autocomplete
    $(document).keyup(function(e) {
        var thelayer;
        if (e.keyCode == 27) {// Esc
            if (lay.length != undefined) {
                thelayer = lay[lay.length - 1] // or whatever you want
            } else {
                thelayer = lay

            }
            thelayer.setQuery(
                'SELECT *, false as selected FROM gadm_islands_join_names'
            );
        }
    });

    $('.searchbox .submit').click(function(event) {
        search($('.searchbox .text').val());
    })
}

//Initialize the autocomplete widget
function initAutocomplete() {
    var ac_sql = "" + 
        "SELECT DISTINCT name, name_alt " +
        "FROM gadm_islands_join_names WHERE " + 
        "name~*'\\m{0}' OR name_alt~*'\\m{0}' ORDER BY name asc LIMIT 3000";
        
    $.ui.autocomplete.prototype._renderItem = function(ul, item) {

        item.label = item.label.replace(
            new RegExp(this.term, "gi"),
            "<strong>$&</strong>"
        );
        return $("<li></li>").data(
            "item.autocomplete", item).append(
                "<a>{0}</a>".format(item.label)
            ).appendTo(ul);
    };

    $('.searchbox .text').autocomplete({
        minLength : 2,
        autoFocus: true,
        source : function(request, response) {
            $.getJSON(
                cdb_api.format(
                    ac_sql.format($.trim(request.term)
                        .replace(/ /g, ' ')
                        .replace(/'/g,"''"))
                ), 
                function(json) {
                    var names = [];
                    _.each(json.rows, function(row) {
                        var name, 
                            name_alt = '';
                        if (row.name != undefined) {
                            name = row.name;
                            if(row.name_alt != null) {
                                name_alt = '&nbsp;<i>alt: {0}</i>'
                                    .format(row.name_alt);
                            }
                            names.push({label:(name+name_alt), value:name});
                        }
                    });
                    response(names);
                }, 
                'json'
            );
        },
        select : function(event, ui) {
            search(ui.item.value.replace(/'/g,"''"));
            $(this).autocomplete("close");
        }
    }).focus(function(event) {
        if ($('.ui-menu').not(':visible')) {
            $(this).autocomplete("search");
        }
    }).blur(function(event) {

        $(this).autocomplete("close");

    }).click(function(event) {
        if ($('.ui-menu').not(':visible')) {
            $(this).autocomplete("search");
        }
    });
}

// create layer opacity slider
function createSlider() {
    $('#slider').slider({
        min : 0,
        max : 1,
        step : 0.05,
        value : 0.8,
        slide : function(event, ui) {
            map.overlayMapTypes.getAt(0).setOpacity(ui.value);
        }
    });
}


//Search for an island name then zoom to and outline the result.
function search(val) {
    var thelayer,
        map_sql = "SELECT *, " +
            "CASE WHEN (name_engli = '{0}' " +
                "OR island= '{0}') " +
            "THEN true ELSE false END as selected " +
            "FROM gadm_islands_join_names",
        extent_sql = "" + 
        "SELECT ST_YMIN(ST_EXTENT(the_geom)) as miny, " + 
            "ST_XMIN(ST_EXTENT(the_geom)) as minx, " + 
            "ST_YMAX(ST_EXTENT(the_geom)) as maxy, " + 
            "ST_XMAX(ST_EXTENT(the_geom)) as maxx " + 
        "FROM gadm_islands_join_names where " +
            "island = '{0}' or name_engli = '{0}'";

    $('.searchbox .text').autocomplete("close");
    
    $.getJSON(
        
        cdb_api.format(extent_sql.format(val)), 
        function(response) {
            var minx = -180, maxx = 180, miny = -80, maxy = 80;
            if (response.rows[0].miny != null && 
                response.rows[0].minx != null && 
                response.rows[0].maxx != null && 
                response.rows[0].maxy != null) {
                if ((360 - (Math.abs(response.rows[0].maxx) 
                    + Math.abs(response.rows[0].minx))) < 4) {
                    minx = -181;
                    maxx = -179;
                } else {
                    minx = response.rows[0].minx;
                    maxx = response.rows[0].maxx;
                }
                miny = response.rows[0].miny;
                maxy = response.rows[0].maxy;
                if (val.toLowerCase().indexOf('united states') >= 0) {
                    minx = -184;
                    maxx = -66;
                }
    
                map.fitBounds(
                    new google.maps.LatLngBounds(
                        new google.maps.LatLng(miny, minx),
                        new google.maps.LatLng(maxy, maxx)
                    )
                );
            }
        }
    );
    if (lay.length != undefined) {
        thelayer = lay[lay.length - 1] 
    } else {
        thelayer = lay

    }

    thelayer.setQuery(map_sql.format(val));
}

window.onload = main; 
