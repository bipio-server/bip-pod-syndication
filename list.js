/**
 *
 * The Bipio List Pod.  list action definition
 * ---------------------------------------------------------------
 *
 * Copyright (c) 2017 InterDigital, Inc. All Rights Reserved
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
        fileName = this.pod.getDataDir(channel, 'list') + channel.id + ".txt";
    // touch the  source file
    $resource.file.save(
        fileName,
        new Buffer(""),
        {
            write: true,
            persist : true
        },
        next
    );
}

List.prototype.teardown = function(channel, accountInfo, next) {
    next(false);
    return;
    // drop list file
    var fileName = this.pod.getDataDir(channel, 'list') + channel.id + ".txt";
    this.$resource.file.remove(fileName, { persist : true }, next);
}


List.prototype.rpc = function(method, sysImports, options, channel, req, res) {
    var $resource = this.$resource,
        self = this,
        dao = $resource.dao,
        log = $resource.log;

    if ('get' === method) {
        var fileName = self.pod.getDataDir(channel, 'list') + channel.id + ".txt";
        res.contentType(self.pod.getActionRPCs('list', 'get').contentType);
        if (channel.config.header) {
            var stream = new Stream();
            stream.on('data', function(data) {
              res.write(data)
            });

            stream.emit('data', channel.config.header + '\n');
        }

        try {
            $resource.file.get(
                fileName,
                {
                    persist : true
                },
                function(err, file, fStream){
                    if (err) {
                        res.status(500).end();
                    } else {
                        fStream.pipe(res);
                    }
                });
        } catch (e) {
            log(e.message, channel, 'error');
            res.status(500).end();
        }
    } else {
        res.status(404).end();
    }
};

/**
 * Invokes (runs) the action.
 */
List.prototype.invoke = function(imports, channel, sysImports, contentParts, next) {
    var self = this,
        $resource = this.$resource,
        dao = $resource.dao,
        log = $resource.log;

    if (imports.line_item) {

        var fileName = self.pod.getDataDir(channel, 'list') + channel.id + ".txt",
        config = imports,
        mode = config.write_mode === 'append' ? 'appendFile' : 'writeFile';

        $resource.file.save(
            fileName,
            new Buffer(imports.line_item + "\n"),
            {
                persist : true,
                append: (mode === 'appendFile'),
                write: (mode === 'writeFile')
            },
            function(err, fileStruct) {
                if (err) {
                    next(err);
                } else {
                    var exports = {
                        line_item : imports.line_item
                    };

                    if ($resource.helper.isTruthy(config.export_file)) {

                        config.export_file_name = imports.export_file_name || config.export_file_name;

                        if (!config.export_file_name) {
                            config.export_file_name = 'list_' + channel.id + '.txt';
                        }

                        $resource.file.save(
                            self.pod.getDataDir(channel, 'list') + config.export_file_name,
                            fileStruct.localpath,
                            {
                                header: imports.header
                            },
                            function(err, fileStruct) {
                                if (err) {
                                    next(err);
                                } else {
                                    contentParts._files.push(fileStruct);
                                }

                                next( false, exports, contentParts, fileStruct.size );
                            });
                    } else {
                        next(err, exports);
                    }
                }
            }
        );
    }
}

// -----------------------------------------------------------------------------
module.exports = List;




























