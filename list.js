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
    this.podConfig = podConfig; // general system level config for this pod (transports etc)
}

List.prototype = {};

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
        var fileName = self.pod.getDataDir(channel, 'request') + channel.id + ".txt", 

        var listStruct = {
            owner_id: channel.owner_id,
            channel_id: channel.id,
            last_update: $resource.helper.nowUTCSeconds(),
            last_build: $resource.helper.nowUTCSeconds()
        }

        model = dao.modelFactory(modelName, listStruct, accountInfo);

        dao.create(model, function(err, result) {
            // touch the  source file
            $resource.file.save(fileName, new Buffer(""), {write: true}, function(err, file) {
                if (err) {
                    log(err, channel, 'error');
                } else {
                    log('created container ' + file.localpath, channel);
                }

                next(err, 'channel', channel); // ok
            });
        }, accountInfo);
    })(channel, accountInfo, next);
}

List.prototype.teardown = function(channel, accountInfo, next) {
    var $resource = this.$resource,
        self = this,
        dao = $resource.dao,
        log = $resource.log;

    // drop list file
    var fileName = self.pod.getDataDir(channel, 'request') + channel.id + ".txt";

    $resource.file.remove(fileName, function(err) {
        if (err) next(err); 
        dao.removeFilter(
            $resource.getDataSourceName('track_list'), {
                owner_id: channel.owner_id,
                channel_id: channel.id
            },
            next
        );
    });
}


List.prototype.rpc = function(method, sysImports, options, channel, req, res) {
    var $resource = this.$resource,
        self = this,
        dao = $resource.dao,
        log = $resource.log,
        modelName = $resource.getDataSourceName('track_list');

    if ('get' === method) {
        var fileName = self.pod.getDataDir(channel, 'request') + channel.id + ".txt",
        res.contentType(self.getSchema().renderers.get.contentType);

        if (channel.config.header) {
            var stream = new Stream();
            stream.on('data', function(data) {
              res.write(data) // change process.stdout to ya-csv
            });

            stream.emit('data', channel.config.header + '\n');
        }

        try {
            $resource.file.get(fileName, function(err, file, fStream){
                fStream.pipe(res);
            });        
        } catch (e) {
            log(e.message, channel, 'error');
            res.send(500);
        }
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
            var fileName = self.pod.getDataDir(channel, 'request') + channel.id + ".txt",
            config = channel.config,
            mode = config.write_mode === 'append' ? 'appendFile' : 'writeFile';

                $resource.file.save(fileName, new Buffer(imports.line_item + "\n"), { append: (mode === 'appendFile'), write: (mode === 'writeFile') }, function(err, struct1) {
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
                                last_update: $resource.helper.nowUTCSeconds()
                            },
                            function(err) {
                                if (err) {
                                    log(err, channel, 'error');
                                }
                            }
                        );

                        if ($resource.helper.isTruthy(config.export_file)) {

                            config.export_file_name = imports.export_file_name || config.export_file_name;

                            if (!config.export_file_name) {
                                config.export_file_name = 'list_' + channel.id + '.txt';
                            }

                            $resource.file.save(self.pod.getDataDir(channel, 'request') + config.export_file_name, file.localpath, { header: channel.config.header }, function(err, struct2) {
                                if (err) next(err);
                                contentParts._files.push(struct2);
                                next( false, exports, contentParts, struct2.size );
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




























