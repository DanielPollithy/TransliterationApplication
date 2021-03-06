/**
* The collection of methods in order to generate the heat maps.
* The final output is always a web D3.JS rendering!
*
* @class Heatmap
*/

var log = require('electron-log');
var database = require('./database');
var path = require('path');
var fs = require('fs');

/**
* Suits as a in memory cache for the images, fragments and tokens
* Motivation: We don't want to query the database twice for a single object.
* key for the sub categories (images, fragments and tokens) is the <ID>
* value is the object itself
*
* @property IMAGE_FRAGMENT_CACHE
*/
var IMAGE_FRAGMENT_CACHE = IMAGE_FRAGMENT_CACHE || {
        images: {
            // image_id -> image
        },
        fragments: {
            // fragment_id -> image_id
        },
        tokens: {
            // token_id -> fragment_id
        }
    };

/**
* The bounding box cache for every fragment.
* key is fragment_id and value is the bounding box
*
* @property BOUNDING_BOX_CACHE
*/
var BOUNDING_BOX_CACHE = BOUNDING_BOX_CACHE || {
        // fragment_id -> bb
    };

/**
* Reset the object cache
 *
* @method clean_caches
*/
function clean_caches() {
    // cache all images with their tokens
    IMAGE_FRAGMENT_CACHE = {
        images: {
            // image_id -> image
        },
        fragments: {
            // fragment_id -> image_id
        },
        tokens: {
            // token_id -> fragment_id
        }
    };

    // cache the bounding box for every fragment
    BOUNDING_BOX_CACHE = BOUNDING_BOX_CACHE || {
        // fragment_id -> bb
    };
}

/**
* Counts the number of entities given a Neo4j Label
 *
* @method count_entities_by_label
* @param records {array}
* @param label {string}
* @return {Number}
*/
function count_entities_by_label(records, label) {
    var i = 0;
    records.forEach(function (record) {
        if (record._fields[0].labels.includes(label)) {
            i++;
        }
    });
    return i;
}

/**
* Counts the number of entities given the Neo4j Label 'Image'
*
* @method count_images_in_result
* @param records {array}
* @return {Number}
*/
function count_images_in_result(result) {
    return count_entities_by_label(result, "Image");
}

/**
* Counts the number of entities given the Neo4j Label 'Fragment'
*
* @method count_fragments_in_result
* @param records {array}
* @return {Number}
*/
function count_fragments_in_result(result) {
    return count_entities_by_label(result, "Fragment");
}

/**
* Counts the number of entities given the Neo4j Label 'Token'
*
* @method count_tokens_in_result
* @param records {array}
* @return {Number}
*/
function count_tokens_in_result(result) {
    return count_entities_by_label(result, "Token");
}

/**
* Check whether the {node} has the property {property_name}
*
* @method assure_node_has_property
* @param node {object}
* @param property_name {string}
* @return {boolean}
*/
function assure_node_has_property(node, property_name) {
    return node._fields[0].properties.hasOwnProperty(property_name);
}

/**
* Check whether the {node} has the properties {property_name}
*
* @method assure_node_has_properties
* @param node {object}
* @param property_names {array}
* @return {boolean}
*/
function assure_node_has_properties(node, property_names) {
    property_names.forEach(function (prop) {
        if (!assure_node_has_property(node, prop)) {
            return false;
        }
    });
    return true;
}

/**
* Check whether every record has the x, y, width and height property
*
* @method check_all_tokens_are_spatial
* @param records {array}
* @return {boolean}
*/
function check_all_tokens_are_spatial(records) {
    var mandatory = ['x', 'y', 'width', 'height'];
    records.forEach(function (record) {
        if (record._fields[0].labels.includes('Token')) {
            if (!assure_node_has_properties(record, mandatory)) {
                return false;
            }
        }
    });
    return true;
}

/**
* Check whether every image has the width and height property
*
* @method check_all_images_have_dimension
* @param records {array}
* @return {boolean}
*/
function check_all_images_have_dimension(records) {
    var mandatory = ['width', 'height'];
    records.forEach(function (record) {
        if (record._fields[0].labels.includes('Image')) {
            if (!assure_node_has_properties(record, mandatory)) {
                return false;
            }
        }
    });
    return true;
}


/**
* Check the cache for the token's fragment
*
* @method get_cached_fragment_of_token
* @param token_id {Number}
* @return {object}
*/
function get_cached_fragment_of_token(token_id) {
    return IMAGE_FRAGMENT_CACHE.tokens[token_id];
}

/**
* Set the cache for the token's fragment
*
* @method set_cached_fragment_of_token
* @param token_id {Number}
* @param fragment_id {Number}
* @return {boolean}
*/
function set_cached_fragment_of_token(token_id, fragment_id) {
    IMAGE_FRAGMENT_CACHE.tokens[token_id] = fragment_id;
}

/**
* Set the cache for the token's image
*
* @method set_cached_image
* @param token_id {Number}
* @param fragment_id {Number}
* @param image_id {Number}
* @param image {object}
* @return {boolean}
*/
function set_cached_image(token_id, fragment_id, image_id, image) {
    token_id = Number(token_id);
    fragment_id = Number(fragment_id);
    image_id = Number(image_id);
    IMAGE_FRAGMENT_CACHE.tokens[token_id] = fragment_id;
    IMAGE_FRAGMENT_CACHE.fragments[fragment_id] = image_id;
    IMAGE_FRAGMENT_CACHE.images[image_id] = image;
}

/*function save_cache() {
    var bundle = [
        IMAGE_FRAGMENT_CACHE,
        BOUNDING_BOX_CACHE
    ];
    var cache_path = path.join(__dirname, '../media/settings/heatmap_cache.json');
    fs.writeFileSync(cache_path, JSON.stringify(bundle));
}*/

/*
function load_cache() {
    var cache_path = path.join(__dirname, '../media/settings/heatmap_cache.json');
    var bundle;
    try {
        bundle = JSON.parse(fs.readFileSync(cache_path, 'utf8'));
    } catch (e) {
        log.error('Could not load cache');
        log.error(e);
    }
    if (bundle) {
        IMAGE_FRAGMENT_CACHE = bundle[0];
        BOUNDING_BOX_CACHE = bundle[1];
        log.info('Cache loaded from file successfully');
    } else {
        clean_caches();
    }
}*/

/**
* Check the cache for the fragment's bounding box
*
* @method get_cached_fragment_bounding_box
* @param fragment_id {Number}
* @return {object}
*/
function get_cached_fragment_bounding_box(fragment_id) {
    return BOUNDING_BOX_CACHE[fragment_id];
}

/**
* Check the cached fragment's bounding box for the given token
*
* @method get_cached_fragment_bounding_box_for_token
* @param token_id {Number}
* @return {object}
*/
function get_cached_fragment_bounding_box_for_token(token_id) {
    var cached_fragment_id = get_cached_fragment_of_token(token_id);
    if (cached_fragment_id) {
        return get_cached_fragment_bounding_box(cached_fragment_id);
    }
    return null;
}

/**
* Set the cache for the token's bounding box
*
* @method set_fragment_bounding_box
* @param token_id {Number}
* @param fragment_id {Number}
* @param bb {object}
*/
function set_fragment_bounding_box(token_id, fragment_id, bb) {
    token_id = Number(token_id);
    fragment_id = Number(fragment_id);
    set_cached_fragment_of_token(token_id, fragment_id);
    BOUNDING_BOX_CACHE[fragment_id] = bb;
}

/**
* Check the cache for the image
*
* @method get_cached_image
* @param image_id {Number}
* @return {object}
*/
function get_cached_image(image_id) {
    image_id = Number(image_id);
    return IMAGE_FRAGMENT_CACHE.images[image_id];
}

/**
* Check the cache for the image of the fragment
*
* @method get_cached_image_of_fragment
* @param fragment_id {Number}
* @return {object}
*/
function get_cached_image_of_fragment(fragment_id) {
    fragment_id = Number(fragment_id);
    if (IMAGE_FRAGMENT_CACHE.fragments[fragment_id]) {
        var image_id = IMAGE_FRAGMENT_CACHE.fragments[fragment_id];
        return get_cached_image(image_id);
    }
    return null;
}

/**
* Check the cache for the image of the token
*
* @method get_cached_image_of_token
* @param token_id {Number}
* @return {object}
*/
function get_cached_image_of_token(token_id) {
    token_id = Number(token_id);
    var cached_fragment_id = get_cached_fragment_of_token(token_id);
    if (cached_fragment_id) {
        return get_cached_image_of_fragment(cached_fragment_id);
    }
    return null;
}

/**
* Check the cache for the bounding box of the token
*
* @method get_bounding_box_of_fragment
* @param token {object}
* @return {object}
*/
function get_bounding_box_of_fragment(token) {
    var token_id = Number(token._fields[0].identity);
    var cached_bb = get_cached_fragment_bounding_box_for_token(token_id);
    if (cached_bb) {
        return new Promise(function (resolve, reject) {
            resolve(cached_bb);
        });
    }
    return database.get_fragment_bounding_box(token_id).then(
        function (bb) {
            set_fragment_bounding_box(token_id, bb.get("fragment_id"), bb);
            return bb;
        },
        function (err) {
            return err;
        }
    );
}

/**
* The normalization techniques are documented in Readthedocs
*
* @method normalization_on_whole_image
* @param token {object}
* @param normalization {null}
* @param target_width {Number}
* @param target_height {Number}
* @return normalized coordinates {object}
*/
function normalization_on_whole_image(token, normalization, target_width, target_height) {
    var token_id = Number(token._fields[0].identity);
    var cached_image = get_cached_image_of_token(token_id);
    if (cached_image) {
        return new Promise(function (resolve, reject) {
            resolve(cached_image);
        });
    }
    return database.get_image_of_token(token_id).then(function (img) {
        set_cached_image(token_id, img.get('fragment_id'), img.get('image_id'), img);
        var image_width = img._fields[0].properties.width;
        var image_height = img._fields[0].properties.height;
        // Check if image has width and height
        if (!image_height || !image_width) {
            return null;
        }
        var width_ratio = image_width / target_width;
        var height_ratio = image_height / target_height;
        var x = Number(token._fields[0].properties.x);
        var y = Number(token._fields[0].properties.y);
        var width = Number(token._fields[0].properties.width);
        var height = Number(token._fields[0].properties.height);
        // console.log(image_width, image_height, width_ratio, height_ratio, x,y, width, height);
        var normalized = {
            'x': Math.round(x / width_ratio),
            'y': Math.round(y / height_ratio),
            'width': Math.round(width / width_ratio),
            'height': Math.round(height / height_ratio)
        };
        return normalized;
    }, function (err) {
        return 'No image found for the given token';
    });
}

/**
* The normalization techniques are documented in Readthedocs
*
* @method normalization_on_bounding_box
* @param token {object}
* @param normalization {null}
* @param target_width {Number}
* @param target_height {Number}
* @return normalized coordinates {object}
*/
function normalization_on_bounding_box(token, normalization, target_width, target_height) {
    return get_bounding_box_of_fragment(token).then(function (bb) {
        if (!bb) {
            log.error("no bb");
            return null;
        }
        var bounding_box = {
            'x': Number(bb._fields[0]),
            'y': Number(bb._fields[1]),
            'x2': Number(bb._fields[2]),
            'y2': Number(bb._fields[3])
        };

        // this happens if the bounding box could not be calculated
        if (!bounding_box.x || !bounding_box.y || !bounding_box.x2 || !bounding_box.y2) {
            log.error("bb could not be calculated");
            return null;
        }

        var normalized_bb = {
            'x': 0,
            'y': 0,
            'width': bounding_box.x2 - bounding_box.x,
            'height': bounding_box.y2 - bounding_box.y,
        };

        //log.log('bb', bounding_box)
        //log.log('n_bb', normalized_bb)

        var width_ratio = normalized_bb.width / target_width;
        var height_ratio = normalized_bb.height / target_height;
        var x = Number(token._fields[0].properties.x) - bounding_box.x;
        var y = Number(token._fields[0].properties.y) - bounding_box.y;
        var width = Number(token._fields[0].properties.width);
        var height = Number(token._fields[0].properties.height);

        //log.log('token', x,y,width, height)
        //log.log(width_ratio)
        //log.log(height_ratio)

        var normalized = {
            'x': Math.round(x / width_ratio),
            'y': Math.round(y / height_ratio),
            'width': Math.round(width / width_ratio),
            'height': Math.round(height / height_ratio)
        };
        //log.log(normalized)
        return normalized;
    }, function (err) {
        return 'No bounding box found for the given token';
    });
}

/**
* The normalization techniques are documented in Readthedocs
*
* @method normalization_on_bounding_box_centered
* @param token {object}
* @param normalization {null}
* @param target_width {Number}
* @param target_height {Number}
* @return normalized coordinates {object}
*/
function normalization_on_bounding_box_centered(token, normalization, target_width, target_height) {
    var token_id = Number(token._fields[0].identity);
    return database.get_image_of_token(token_id).then(function (img) {
        var image_width = img._fields[0].properties.width;
        var image_height = img._fields[0].properties.height;
        // Check if image has width and height
        if (!image_height || !image_width) {
            return null;
        }
        var width_ratio = image_width / target_width;
        var height_ratio = image_height / target_height;
        var x = Number(token._fields[0].properties.x);
        var y = Number(token._fields[0].properties.y);
        var width = Number(token._fields[0].properties.width);
        var height = Number(token._fields[0].properties.height);
        //log.log(image_width, image_height, width_ratio, height_ratio, x,y, width, height);
        var normalized = {
            'x': Math.round(x / width_ratio),
            'y': Math.round(y / height_ratio),
            'width': Math.round(width / width_ratio),
            'height': Math.round(height / height_ratio)
        };

        return get_bounding_box_of_fragment(token).then(function (bb) {
            if (!bb) {
                return null;
            }
            var bounding_box = {
                'x': Number(bb._fields[0]),
                'y': Number(bb._fields[1]),
                'x2': Number(bb._fields[2]),
                'y2': Number(bb._fields[3])
            };

            // this happens if the bounding box could not be calculated
            if (!bounding_box.x || !bounding_box.y || !bounding_box.x2 || !bounding_box.y2) {
                return null;
            }

            var normalized_bb = {
                'x': bounding_box.x,
                'y': bounding_box.y,
                'width': bounding_box.x2 - bounding_box.x,
                'height': bounding_box.y2 - bounding_box.y,
            };

            var bounding_box_center = {
                'x': normalized_bb.x + normalized_bb.width / 2,
                'y': normalized_bb.y + normalized_bb.height / 2,
            };

            var image_center = {
                'x': image_width / 2,
                'y': image_height / 2,
            };

            var movement_vector = {
                'x': bounding_box_center.x - image_center.x,
                'y': bounding_box_center.y - image_center.y
            };

            var normalized_movement_vector = {
                'x': Math.round(movement_vector.x / width_ratio),
                'y': Math.round(movement_vector.y / height_ratio)
            };


            var new_normalized = {
                'x': normalized.x - normalized_movement_vector.x,
                'y': normalized.y - normalized_movement_vector.y,
                'width': normalized.width,
                'height': normalized.height
            };

            return new_normalized;
        }, function (err) {
            log.error(err)
            return 'No bounding box found for the given token';
        });

        return normalized;
    }, function (err) {
        log.error(err)
        return 'No image found for the given token';
    });
}

/**
* Wrapper for the three different normalization techniques
*
* @method normalize_token_spatials
* @param token {object}
* @param normalization {Number} 1,2,3
* @param target_width {Number}
* @param target_height {Number}
* @return normalized coordinates {object}
*/
function normalize_token_spatials(token, normalization, target_width, target_height) {
    if (normalization === 1) {
        return normalization_on_whole_image(token, normalization, target_width, target_height);
    } else if (normalization === 2) {
        return normalization_on_bounding_box(token, normalization, target_width, target_height);
    } else if (normalization === 3) {
        return normalization_on_bounding_box_centered(token, normalization, target_width, target_height);
    }
}

/**
* Reformats the heat map to d3js readable data
*
* @method format_heat_map_to_d3js
* @param heat_map {object}
* @return d3js data {object}
*/
function format_heat_map_to_d3js(heat_map) {
    /*var data = [
     {score: 0.5, row: 0, col: 0},
     {score: 0.7, row: 0, col: 1},
     {score: 0.2, row: 1, col: 0},
     {score: 0.4, row: 1, col: 1}
     ];*/
    var data = [];
    for (var x = 0; x < heat_map.length; x++) {
        for (var y = 0; y < heat_map[0].length; y++) {
            data.push(
                {
                    'score': heat_map[x][y],
                    'row': x,
                    'col': y
                }
            );
        }
    }
    return data;
}

// shall return number of nodes, fragments, images and the normalized data array
MAX_SIZE_HEATMAP = 300;
MAX_PIXEL_SIZE = 10;
SUPPORTED_NORMALIZATIONS = 3;
/**
* Entry point for the heat map calculations
*
* @method process_heatmap_query
* @param query {string}
* @param normalization {number} 1,2,3 [1, SUPPORTED_NORMALIZATIONS]
* @param width {Number} ]0; MAX_SIZE_HEATMAP[
* @param height {Number} ]0; MAX_SIZE_HEATMAP[
* @param pixel_size {Number} ]0; MAX_PIXEL_SIZE[
* @return d3js data {object}
*/
function process_heatmap_query(query, normalization, width, height, pixel_size) {
    // load_cache();
    clean_caches();
    var p = new Promise(function (resolve, reject) {
        if (width < 1 || width > MAX_SIZE_HEATMAP || height < 1 || height > MAX_SIZE_HEATMAP) {
            return reject('Dimension of heat map are not in between 1 and ' + MAX_SIZE_HEATMAP);
        }
        if (normalization > SUPPORTED_NORMALIZATIONS || normalization < 1) {
            return reject('Unsupported normalization');
        }
        if (pixel_size < 1 || pixel_size > MAX_PIXEL_SIZE) {
            return reject('Wrong pixel_size');
        }

        var all_promises = [];
        // counts
        var num_images = 0;
        var num_fragments = 0;
        var num_tokens = 0;
        var num_errors = 0;

        var heat_map = new Array(width);
        for (var i = 0; i < width; i++) {
            heat_map[i] = new Array(height);
            for (var z = heat_map[i].length - 1; z >= 0; --z) {
                heat_map[i][z] = 0;
            }
        }

        var prom = Promise.resolve();

        // get the query result
        var session = database._get_session();
        session.run(query).subscribe(
            {
                onNext: function (record) {
                    num_images += count_images_in_result([record]);
                    num_fragments += count_fragments_in_result([record]);
                    num_tokens += count_tokens_in_result([record]);
                    // is there a token without the position coordinates?
                    // that means we have to check whether every token has the following attributes
                    // x,y,width,height
                    var all_tokens_are_spatial = check_all_tokens_are_spatial([record]);
                    if (!all_tokens_are_spatial) {
                        return reject('not all tokens are spatial (have x, y, width and height property)');
                    }
                    // check if all images have a width and height attribute
                    var all_images_have_dimensions = check_all_images_have_dimension([record]);
                    if (!all_images_have_dimensions) {
                        return reject('not all images have dimensions (have width and height property)');
                    }
                    prom = prom.then(function(){
                        var p = normalize_token_spatials(record, normalization, width, height)
                            .then(function(normalized){
                                if (!normalized) {
                                    // normalization failed
                                    num_errors++;
                                } else {
                                    // calcalute all point spanned by the rects x,y,width,height
                                    for (var x_ = (normalized.x >= 0)? normalized.x:0; x_ < normalized.x + normalized.width && x_ < width; x_++) {
                                        for (var y_ = (normalized.y >= 0)? normalized.y:0; y_ < normalized.y + normalized.height && y_ < height; y_++) {
                                            if (x_ >= 160 || x_ < 0) {
                                                a = 3;
                                            }
                                            heat_map[x_][y_]++;
                                        }
                                    }
                                }
                                return Promise.resolve();
                            });
                        return p;
                    });


                },
                onCompleted: function () {
                    session.close();
                    log.info("Data finished streaming from db");
                    prom.then(function () {
                        //save_cache();
                        if (num_tokens === 0) {
                            return reject('Zero tokens found by query');
                        }
                        log.info("Normalize the output matrix...");

                        // calculate the maximum entry of the matrix
                        var max = -Infinity;
                        var min = Infinity;
                        for (var x = 0; x < heat_map.length; x++) {
                            for (var y = 0; y < heat_map[0].length; y++) {
                                if (heat_map[x][y] > max) {
                                    max = heat_map[x][y];
                                }
                                if (heat_map[x][y] < min) {
                                    min = heat_map[x][y];
                                }
                            }
                        }

                        // maximum distance
                        var interval = (max - min) * 1.0;
                        log.log("interval")
                        log.log(interval)

                        // transform the values of the matrix into the interval [0;1]
                        // by dividing every entry by max
                        for (var x = 0; x < heat_map.length; x++) {
                            for (var y = 0; y < heat_map[0].length; y++) {
                                heat_map[x][y] = (heat_map[x][y] - min) / interval;
                            }
                        }
                        var d3js_heat_map = format_heat_map_to_d3js(heat_map);
                        return resolve({
                            'num_images': num_images,
                            'num_fragments': num_fragments,
                            'num_tokens': num_tokens,
                            'num_errors': num_errors,
                            'heat_map': d3js_heat_map
                        });
                    });
                },
                onError: function (error) {
                    log.error(error);
                    return reject(error);
                },
            }
        );

    });
    return p;
}


module.exports = {
    'process_heatmap_query': process_heatmap_query,
    'count_images_in_result': count_images_in_result,
    'count_fragments_in_result': count_fragments_in_result,
    'count_tokens_in_result': count_tokens_in_result,
    'IMAGE_FRAGMENT_CACHE': IMAGE_FRAGMENT_CACHE,
    'BOUNDING_BOX_CACHE': BOUNDING_BOX_CACHE

};