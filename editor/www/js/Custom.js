function apply_custom_settings(editor_ui) {
    get_cross_resource('/media/settings/settings.json').then(
        function(text) {
            var json = JSON.parse(text);
            var styles = {'styles': json.styles || {}};
            var defaultEdgeStyle = json.defaultEdgeStyle;
            editor_ui.editor.graph.stylesheet = realMerge(editor_ui.editor.graph.stylesheet, styles);
            editor_ui.editor.graph.defaultEdgeStyle = realMerge(editor_ui.editor.graph.defaultEdgeStyle,
                defaultEdgeStyle);
        },
        function(err){
            console.log(err);
    });
    //
}

function realMerge(to, from) {

    for (n in from) {

        if (typeof to[n] != 'object') {
            to[n] = from[n];
        } else if (typeof from[n] == 'object') {
            to[n] = realMerge(to[n], from[n]);
        }
    }
    return to;
};

function get_cross_resource(src) {
    var p = new Promise(function(resolve, reject){
        if (require_exists) {
            var {app} = require('electron').remote;
            var extended_path = path.join(app.getAppPath(), src);
            fs.readFile(extended_path, function(err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        } else {
            mxUtils.get(src, function(xhr) {
                // Adds bundle text to resources
                try {
                    var text = xhr.getText();
                } catch (e) {
                    reject(e);
                }
                resolve(text);
            }, function(err) {
                reject(err);
            });
        }
    });
    return p;
}

function set_background_image_on_init(editor_ui) {
    var newValue = urlParams['image'];
    editor_ui.backgroundImage = {src: newValue, width:0, height:0, visible:false};
    editor_ui.hideBackgroundImage = function() {
        editor_ui.setBackgroundImage(new mxImage(null, editor_ui.backgroundImage.width,
            editor_ui.backgroundImage.height)
        );
        editor_ui.backgroundImage.visible = false;
    };
    editor_ui.showBackgroundImage = function() {
        editor_ui.setBackgroundImage(new mxImage(editor_ui.backgroundImage.src, editor_ui.backgroundImage.width,
            editor_ui.backgroundImage.height)
        );
        editor_ui.backgroundImage.visible = true;
    };
    editor_ui.triggerBackgroundImage = function() {
        if (editor_ui.backgroundImage.visible) {
            editor_ui.hideBackgroundImage();
        } else {
            editor_ui.showBackgroundImage();
        }
    };
    if (newValue != null && newValue.length > 0) {
        var img = new Image();

        img.onload = function () {
            var image = new mxImage(newValue, img.width, img.height);
            editor_ui.backgroundImage.width = img.width;
            editor_ui.backgroundImage.height = img.height;
            editor_ui.backgroundImage.visible = true;
            editor_ui.setBackgroundImage(image);
            var object = Object();
            object.width = image.width;
            object.height = image.height;
            editor_ui.setPageFormat(object);
            editor_ui.actions.get("fitPageWidth").funct();
            apply_custom_settings(editor_ui);
        };
        img.onerror = function () {
            // removed this -> electron render thread will fail
            // mxUtils.alert(mxResources.get('fileNotFound'));
        };

        img.src = newValue;
    }
}

function open_xml_on_init(editorUi) {
    var xml_file_path = urlParams['xml_file'];
    if (xml_file_path != null && xml_file_path.length > 0) {
        var splitted = xml_file_path.split('/');
        var only_name = splitted[splitted.length - 1];
        editorUi.editor.filename = only_name;
        console.log(require_exists)
        var req = mxUtils.get(xml_file_path, mxUtils.bind(this, function (req) {
            if (req.request.status >= 200 && req.request.status <= 299) {
                if (req.request.response.length > 0) {
                    editorUi.editor.graph.model.beginUpdate();
                    try {
                        var xmlElem = mxUtils.parseXml(req.request.response).documentElement;
                        editorUi.editor.setGraphXml(xmlElem);

                    }
                    catch (e) {
                        error = e;
                        console.log(e);
                    }
                    finally {
                        editorUi.editor.graph.model.endUpdate();
                        set_background_image_on_init(editorUi);
                    }
                }
            }
        }));
    }
}

function open_xml_on_init_electron(editorUi) {
	const {BrowserWindow, app} = require('electron').remote
    var xml_file_path = path.join(app.getAppPath(), urlParams['xml_file']);
    console.log(xml_file_path)
    if (xml_file_path != null && xml_file_path.length > 0) {
        var splitted = urlParams['xml_file'].split('/');
        var only_name = splitted[splitted.length - 1];
        editorUi.editor.filename = only_name;
        console.log(fs)
        fs.readFile(xml_file_path, function(err, data) {
            console.log(err)
                if (!err) {
                    editorUi.editor.graph.model.beginUpdate();
                    try {
                        var xmlElem = mxUtils.parseXml(data.toString()).documentElement;
                        editorUi.editor.setGraphXml(xmlElem);

                    }
                    catch (e) {
                        error = e;
                        console.log(e);
                    }
                    finally {
                        editorUi.editor.graph.model.endUpdate();
                        set_background_image_on_init(editorUi);
                    }
                }
            }
        );
    }
}

function add_autocomplete_to_input(input, url, field) {
    var url = "http://localhost:4000" + url;
    window.$(input).autocomplete({
        source: function (request, response) {
            window.$.ajax({
                url: url,
                dataType: "jsonp",
                data: {
                    term: request.term,
                    field: field
                },
                success: function (data) {
                    response(data);
                }
            });
        },
        minLength: 0,
        select: function (event, ui) {
            //alert("Selected: " + ui.item.value);
        }
    });
}

function get_type_of_cell(graph, cell) {
    var token_type;
    var cell_style = graph.getCellStyle(cell);
    if (cell_style.hasOwnProperty('tokenType')) {
        token_type = cell_style.tokenType;
    } else if (cell_style.hasOwnProperty('groupType')) {
        token_type = cell_style.groupType;
    }
    else {
        token_type = '';
    }

    if (cell_style.shape === 'connector') {
        token_type = 'connector'
    }
    return token_type;
}

// create edges automatically when token fired creation event
// Two possible types
// 1) small token lays above a bigger token (-> probably a grik)
// 2) else (e.g. overlaps or token is bigger than underlying token): rasur, elision or erneuerung
// Attach this to some button because the event handler has the problem that the box doesn't have
// a state so far. So you could either wait for 1 second or fire the function manually
function generate_edges_between_overlapping_tokens(selected_cell, graph) {
    var cell = selected_cell;

    var token_type = get_type_of_cell(graph, cell);

    var overwriting_relation = 'is_part_of';
    if (token_type === 'modification') {
        overwriting_relation = 'grak';
    }

    if (token_type !== undefined && token_type !== 'connector') {
        // Type 2) Selected Token is bigger than something under it
        var state = graph.getView().getState(cell);
        var found = graph.getAllCells(state.x, state.y, state.width, state.height);
        found.pop(found.indexOf(cell));
        found.forEach(function(c) {
            var tt = get_type_of_cell(graph, c);
            if (tt !== undefined && tt !== 'connector') {
                add_edge_between_cells(graph, cell.getParent(), c, cell, overwriting_relation, token_type);
            }
        });
    }
}


function add_edge_between_cells(graph, parent, origin_cell, target_cell, relation_type, token_type) {
    var cell = graph.insertEdge(parent, null, '', origin_cell, target_cell, null);
    var value = graph.getModel().getValue(cell);
    // Converts the value to an XML node
	if (!mxUtils.isNode(value))
	{
		var doc = mxUtils.createXmlDocument();
		var obj = doc.createElement('object');
		obj.setAttribute('label', value || '');
		value = obj;
	}
    value.setAttribute('relation_type', relation_type);
    if (CUSTOM_PROPERTY_CHANGE_HANDLERS.hasOwnProperty('relation_type')) {
        CUSTOM_PROPERTY_CHANGE_HANDLERS['relation_type'](cell, graph.getCellStyle(cell), value, graph, 'relation_type',
            relation_type, token_type);
    }
    graph.getModel().setValue(cell, value);
}


function initialize_node_with_properties(graph, vertex) {

        var vertex_value = graph.getModel().getValue(vertex);
        // Converts the value to an XML node
        if (!mxUtils.isNode(vertex_value))
        {
            var doc = mxUtils.createXmlDocument();
            var obj = doc.createElement('object');
            obj.setAttribute('label', vertex_value || '');
            vertex_value = obj;
        }

        var token_type = get_type_of_cell(graph, vertex);

        if (!token_type) {return null;}

        var properties = {};

        // get the relation properties
        if (TOKEN_CONFIG.tokens.hasOwnProperty(token_type)) {
            if (TOKEN_CONFIG.tokens[token_type].hasOwnProperty("properties")) {
                properties = TOKEN_CONFIG.tokens[token_type]['properties'];
            }
        }

        // iterate over the properties
        // add them to the edge and call the custom event handler
        Object.keys(properties).forEach(function(prop) {
            vertex_value.setAttribute(prop, properties[prop]);
            // call the custom event handler
            if (CUSTOM_PROPERTY_CHANGE_HANDLERS.hasOwnProperty(prop)) {
                CUSTOM_PROPERTY_CHANGE_HANDLERS[prop](edge, graph.getCellStyle(edge), value, graph, prop,
                    properties[prop], token_type);
            }
        });
        graph.getModel().setValue(vertex, vertex_value);
}


function overwrite_mxgraph_edge_create(graph) {

    graph.insertEdge = function(parent, id, value, source, target, style)
    {
        var parent_style = this.getCellStyle(parent);

        if (Number(parent_style.locked) === 1) {
            return null;
        }
        var edge = this.createEdge(parent, id, value, source, target, style);

        var edge_value = graph.getModel().getValue(edge);
        // Converts the value to an XML node
        if (!mxUtils.isNode(value))
        {
            var doc = mxUtils.createXmlDocument();
            var obj = doc.createElement('object');
            obj.setAttribute('label', edge_value || '');
            edge_value = obj;
        }

        var token_type = 'connector';
        var properties = {relation_type:''};

        // get the relation properties
        if (TOKEN_CONFIG.tokens.hasOwnProperty(token_type)) {
            if (TOKEN_CONFIG.tokens[token_type].hasOwnProperty("properties")) {
                properties = TOKEN_CONFIG.tokens[token_type]['properties'];
            }
            // overwrite with conditional properties
            if (TOKEN_CONFIG.tokens[token_type].hasOwnProperty("conditional_properties")) {
                // iterate over the conditional properties
                if (source) {
                    var source_style = graph.getCellStyle(source);
                    var source_type = source_style.tokenType;
                }
                if (target) {
                    var target_style = graph.getCellStyle(target);
                    var target_type = target_style.tokenType;
                }
                Object.keys(TOKEN_CONFIG.tokens[token_type].conditional_properties).forEach(function(prop) {
                    var from_condition = TOKEN_CONFIG.tokens[token_type].conditional_properties[prop].from;
                    var to_condition = TOKEN_CONFIG.tokens[token_type].conditional_properties[prop].to;
                    var conditions = false;
                    // if the source and the target match the given conditions
                    // overwrite the property
                    if (from_condition && source_type && from_condition === source_type) {
                        if (to_condition && target_type && to_condition === target_type) {
                            properties[prop] = TOKEN_CONFIG.tokens[token_type].conditional_properties[prop].value;
                        }
                    }
                });
            }
        }

        // iterate over the properties
        // add them to the edge and call the custom event handler
        Object.keys(properties).forEach(function(prop) {
            edge_value.setAttribute(prop, properties[prop]);
            // call the custom event handler
            if (CUSTOM_PROPERTY_CHANGE_HANDLERS.hasOwnProperty(prop)) {
                CUSTOM_PROPERTY_CHANGE_HANDLERS[prop](edge, graph.getCellStyle(edge), value, graph, prop,
                    properties[prop], token_type);
            }
        });

        var added_edge = this.addEdge(edge, parent, source, target);

        graph.getModel().setValue(added_edge, edge_value);

        return added_edge;
    };
}

function add_vertex_listener(editor_ui) {
    editor_ui.editor.graph.addListener("cellsInserted", function(sender, evt)
    {
      // var vertex = evt.getProperty('cells')[0];
      var fontSize = editor_ui.editor.graph.stylesheet.styles.defaultVertex.fontSize;
      editor_ui.editor.graph.setCellStyles('fontSize', fontSize, evt.getProperty('cells'));
        evt.getProperty('cells').forEach(function(cell){
            initialize_node_with_properties(editor_ui.editor.graph, cell)
        });
    });
}

function apply_custom_changes(editor_ui) {
    set_background_image_on_init(editor_ui);
    if (require_exists) {
        open_xml_on_init_electron(editor_ui);
    } else {
        open_xml_on_init(editor_ui);
    }
    editor_ui.editor.graph.allowLoops = ALLOW_LOOPS;
    editor_ui.editor.graph.allowDanglingEdges = ALLOW_DANGLING_EDGES;
    overwrite_mxgraph_edge_create(editor_ui.editor.graph);
    add_vertex_listener(editor_ui);
}





