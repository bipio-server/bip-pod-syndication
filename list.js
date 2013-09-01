/**
 *
 * The Bipio List Pod.  list action definition
 * ---------------------------------------------------------------
 *
 * @author Michael Pearson <michael@cloudspark.com.au>
 * Copyright (c) 2010-2013 CloudSpark pty ltd http://www.cloudspark.com.au
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
var fs = require('fs');

function List(podConfig) {
    this.name = 'list';
    this.description = 'Store a list of items',
    this.description_long = 'Content that this channel receives will be stored "as-is" into a list',
    this.trigger = false; // this action can trigger
    this.singleton = false; // only 1 instance per account (can auto install)
    this.auto = false; // no config, not a singleton but can auto-install anyhow
    this.podConfig = podConfig; // general system level config for this pod (transports etc)
}

List.prototype = {};

List.prototype.getSchema = function() {
    return {
        'config' : {
            properties : {
                "write_mode" : {
                    type : "string",
                    "description" : "Write Mode",
                    oneOf : [
                            {
                                "$ref" : "#/definitions/write_mode"
                            }
                            ]
                },

                "renderers" : {
                    type : "string",
                    description : "List Visibility",
                    oneOf : [
                            {
                                "$ref" : "#/definitions/render_mode"
                            }
                    ]
                }
            },
            "definitions" : {
                "render_mode" : {
                    "description" : "Keep this list private, or open to anyone to read",
                    "enum" : [ "private" , "public" ],
                    "enum_label" : ["Me Only", "Anyone"],
                    "default" : "private"
                },
                "write_mode" : {
                    "description" : "List Write Mode",
                    "enum" : [ "append" , "replace" ],
                    "enum_label" : ["Append Entries", "Replace Entries"],
                    "default" : "append"
                }
            }
        },
        'renderers' : {
            'csv' : {
                description : 'Comma Separated Values'

            },
            'tsv' : {
                description : 'Tab Separated Values'

            },
            'excel' : {
                description : 'Excel Spreadsheet'

            }
        },
        'defaults' : {
            'icon_url' : CFG_CDN + '/channels/rss.png'
        },
        'exports' : {
            properties : {
                'last_modified' : {
                    type : String,
                    description : 'Last modified timestamp (UTC)'
                }
            }
        },

        // No import, consumes and stores any adjacent export
        imports: {}
    }
}

List.prototype._getListFile = function(channel, next) {
    var dataDir = this.pod.getDataDir(channel, 'list');
    
    app.helper.mkdir_p(dataDir, 0777, function(err) {        
       next(err, dataDir + channel.id + ".json") ;
    });
}

List.prototype.setup = function(channel, accountInfo, next) {
     var $resource = this.$resource,
        self = this,
        dao = $resource.dao,
        log = $resource.log,
        modelName = this.$resource.getDataSourceName('track_list');

    (function(channel, accountInfo, next) {
        self._getListFile(channel, function(err, fileName ) {
            if (err) {
                log(err, channel, 'error');
                next(err, 'channel', channel);

            } else {
                var listStruct = {
                    owner_id : channel.owner_id,
                    channel_id : channel.id,
                    last_update : app.helper.nowUTCSeconds(),
                    last_build : app.helper.nowUTCSeconds()
                }

                model = dao.modelFactory(modelName, listStruct, accountInfo);

                dao.create(model, function(err, result) {
                    // touch the  source file
                    fs.writeFile(fileName, "", function(err) {
                        if (err) {
                            log(err, channel, 'error');
                        } else {
                            log('created container ' + fileName, channel);
                        }

                        next(err, 'channel', channel); // ok                
                    });
                }, accountInfo);
            }
        });
    })(channel, accountInfo, next);
}


/**
 * Invokes (runs) the action.
 */
List.prototype.invoke = function(imports, channel, sysImports, contentParts, next) {
    var self = this,
        $resource = this.$resource,
        dao = $resource.dao,
        log = $resource.log,
        modelName = this.$resource.getDataSourceName('track_list'),
        exports = imports;

    (function(imports, channel, sysImports, next) {
        self._getListFile(channel, function(err, fileName ) {
            var mode = channel.config.write_mode === 'append' ? 'appendFile' : 'writeFile';
            fs[mode](fileName, JSON.stringify(imports) + ",\n", function (err) {
                if (err) {
                    log(err, channel, 'error');
                } else {
                    // update model last_update attribute
                    dao.updateColumn(
                        modelName,
                        {
                            owner_id : channel.owner_id,
                            channel_id : channel.id
                        },
                        {
                            last_update : app.helper.nowUTCSeconds()
                        },
                        function(err) {
                            if (err) {
                                log(err, channel, 'error');
                            }
                        }
                    );

                    next(err, exports);
                }
            });
            
            
        });
    })(imports, channel, sysImports, next);
}

// -----------------------------------------------------------------------------
module.exports = List;