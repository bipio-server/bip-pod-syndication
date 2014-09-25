/**
 *
 * The Bipio List Pod.  list action definition
 * ---------------------------------------------------------------
 *
 * @author Michael Pearson <github@m.bip.io>
 * Copyright (c) 2010-2013 Michael Pearson https://github.com/mjpearson
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
var fs = require('fs'),
    Stream = require('stream');

function List(podConfig) {
    this.name = 'list';
    this.title = 'Store a list of items',
    this.description = 'Stores content for adjacent channels',
    this.trigger = false; // this action can trigger
    this.singleton = false; // only 1 instance per account (can auto install)
    this.auto = false; // no config, not a singleton but can auto-install anyhow
    this.podConfig = podConfig; // general system level config for this pod (transports etc)
}

List.prototype = {};

List.prototype.getSchema = function() {
    return {
        'config': {
            properties: {
                "write_mode": {
                    type: "string",
                    "description": "Write Mode",
                    oneOf: [{
                        "$ref": "#/config/definitions/write_mode"
                    }]
                },
                "export_file": {
                    type: "boolean",
                    "description": "Export File",
                    "default" : false
                },
                "export_file_name": {
                    type: "string",
                    "description": "Exported File Name"
                },
                'header': {
                    type: "string",
                    description: "File Header"
                }
            },
            "definitions": {
                "write_mode": {
                    "description": "List Write Mode",
                    "enum": ["append", "replace"],
                    "enum_label": ["Append Entries", "Replace Entries"],
                    "default": "append"
                }
            }
        },
        'renderers': {
            'get': {
                description: 'Returns list Content',
                contentType: DEFS.CONTENTTYPE_TEXT

            }
        },

        'exports': {
            properties: {
                'line_item': {
                    type: "string",
                    description: "Line Item"
                }
            }
        },

        // No import, consumes and stores any adjacent export
        imports: {
            properties: {
                'line_item': {
                    type: "string",
                    description: "Line Item"
                },
                "export_file_name": {
                    type: "string",
                    "description": "Exported File Name"
                }
            },
            "required" : [ "line_item" ]
        }
    }
}

List.prototype._getListFile = function(channel, next) {
    var dataDir = this.pod.getDataDir(channel, 'list');
    app.helper.mkdir_p(dataDir, 0777, function(err) {
        next(err, dataDir + channel.id + ".txt");
    });
}

List.prototype.setup = function(channel, accountInfo, next) {
    var $resource = this.$resource,
        self = this,
        dao = $resource.dao,
        log = $resource.log,
        modelName = this.$resource.getDataSourceName('track_list');

    (function(channel, accountInfo, next) {
        self._getListFile(channel, function(err, fileName) {
            if (err) {
                log(err, channel, 'error');
                next(err, 'channel', channel);

            } else {
                var listStruct = {
                    owner_id: channel.owner_id,
                    channel_id: channel.id,
                    last_update: app.helper.nowUTCSeconds(),
                    last_build: app.helper.nowUTCSeconds()
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

List.prototype.teardown = function(channel, accountInfo, next) {
    var $resource = this.$resource,
        self = this,
        dao = $resource.dao,
        log = $resource.log;

    // drop list file
    self._getListFile(channel, function(err, fileName) {
        if (!err) {
            fs.unlink(fileName);
            dao.removeFilter(
                $resource.getDataSourceName('track_list'), {
                    owner_id: channel.owner_id,
                    channel_id: channel.id
                },
                next
            );
        } else {
            next(err, 'channel', self);
        }
    });
}


List.prototype.rpc = function(method, sysImports, options, channel, req, res) {
    var $resource = this.$resource,
        self = this,
        dao = $resource.dao,
        log = $resource.log,
        modelName = $resource.getDataSourceName('track_list');

    if ('get' === method) {
        this._getListFile(channel, function(err, fileName) {
            res.contentType(self.getSchema().renderers.get.contentType);

            if (channel.config.header) {
                var stream = new Stream();
                stream.on('data', function(data) {
                  res.write(data) // change process.stdout to ya-csv
                });

                stream.emit('data', channel.config.header + '\n');
            }

            try {
                var fStream = fs.createReadStream(fileName, {
                    encoding: 'utf8'
                });

                fStream.pipe(res);
            } catch (e) {
                log(e.message, channel, 'error');
                res.send(500);
            }
        });
    } else {
        res.send(404);
    }
};

/**
 * Invokes (runs) the action.
 */
List.prototype.invoke = function(imports, channel, sysImports, contentParts, next) {
    var self = this,
        $resource = this.$resource,
        dao = $resource.dao,
        log = $resource.log,
        modelName = this.$resource.getDataSourceName('track_list');

    if (imports.line_item) {
        (function(imports, channel, sysImports, next) {
            self._getListFile(channel, function(err, fileName) {
                var config = channel.config,
                    mode = config.write_mode === 'append' ? 'appendFile' : 'writeFile';

                fs[mode](fileName, imports.line_item + "\n", function(err) {
                    if (err) {
                        log(err, channel, 'error');
                    } else {
                        var exports = {
                            line_item : imports.line_item
                        };

                        // update model last_update attribute
                        dao.updateColumn(
                            modelName, {
                                owner_id: channel.owner_id,
                                channel_id: channel.id
                            }, {
                                last_update: app.helper.nowUTCSeconds()
                            },
                            function(err) {
                                if (err) {
                                    log(err, channel, 'error');
                                }
                            }
                        );

                        if (app.helper.isTrue(config.export_file)) {

                            config.export_file_name = imports.export_file_name || config.export_file_name;

                            if (!config.export_file_name) {
                                config.export_file_name = 'list_' + channel.id + '.txt';
                            }

                            self.pod.getDataDir(channel, 'request', function(err, dataDir) {
                                if (err) {
                                    next(err);
                                } else {
                                    var localPath = dataDir + config.export_file_name,
                                        rs = fs.createReadStream(fileName),
                                        hs = new Stream(),
                                        ws = fs.createWriteStream(localPath);

                                    hs.on('data', function(data) {
                                        ws.write(data);
                                    });

                                    hs.emit('data', channel.config.header + '\n');

                                    rs.pipe(ws);

                                    fs.stat(localPath, function(err, stats) {
                                        if (err) {
                                            next(err);
                                        } else {
                                            var fileStruct = {
                                              txId : sysImports.client.id,
                                              size : stats.size,
                                              localpath : localPath,
                                              name : config.export_file_name,
                                              type : DEFS.CONTENTTYPE_TEXT,
                                              encoding : 'UTF-8'
                                            };
                                            contentParts._files.push(fileStruct);

                                            next(
                                                false,
                                                exports,
                                                contentParts,
                                                fileStruct.size
                                            );
                                        }
                                    });
                                }
                            });

                        } else {
                            next(err, exports);
                        }
                    }
                });
            });
        })(imports, channel, sysImports, next);
    }
}

// -----------------------------------------------------------------------------
module.exports = List;




























