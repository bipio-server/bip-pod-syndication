/**
 *
 * The Bipio Feed Pod.  list action definition
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

function Feed(podConfig) {
    this.name = 'feed';
    this.description = 'Create A Feed',
    this.description_long = 'Creates an syndication from content you receive from Bips',
    this.trigger = false; // this action can trigger
    this.singleton = false; // only 1 instance per account (can auto install)
    this.auto = false; // no config, not a singleton but can auto-install anyhow
    this.podConfig = podConfig; // general system level config for this pod (transports etc)
}

Feed.prototype = {};

Feed.prototype.getSchema = function() {
    return {        
        'config' : {
            properties : {
                "renderers" : {
                    type : "object",
                    properties : {
                        'rss' : {
                            type : "string",
                            oneOf : [
                            {
                                "$ref" : "#/definitions/render_mode"
                            }
                            ]
                        }
                    }
                },
                "default_public" : {
                    type : "string",                        
                    oneOf : [
                    {
                        "$ref" : "#/definitions/default_public"
                    }
                    ]
                }
            },
            "definitions" : {
                "render_mode" : {
                    "description" : "Keep this renderer private, or readable by anyone",
                    "enum" : [ "private" , "public" ],
                    "enum_label" : ["Me Only", "Anyone"],
                    "default" : "private"
                },
                "default_public" : {
                    "description" : "Make this my Default Public Profile Feed. 'On' overrides privacy setting",
                    "enum" : [ "on" , "off" ],
                    "enum_label" : ["On", "Off"],
                    "default" : "off"
                }
            }
        },
        'renderers' : {
            'rss' : {
                description : 'RSS 2.0',
                contentType : DEFS.CONTENTTYPE_XML
            }
        },
        'defaults' : {
            'icon_url' : CFG_CDN + '/channels/rss.png'
        },
        'exports' : {
            properties : {            
            }
        },
        "imports": {
            properties : {
                'title' : {
                    type : String,
                    description : 'Title'
                },
                'link' : {
                    type : String,
                    description : 'Link'
                },
                'description' : {
                    type : String,
                    description : 'Description'
                },
                'category' : {
                    type : String,
                    description : 'Category Name'
                }
            }
        }
    }
}

Feed.prototype._getFeedFilePathList = function(channel) {
    var dataDir = this.$resource.getDataDir(channel, 'list');        
    return process.cwd() + dataDir + channel.id + ".jsontxt";
}

Feed.prototype.setup = function(channel, accountInfo, options, next) {
    var dao = this.$resource.dao,
    modelName = 'channel_pod_syndication_tracking',
    dataDir = this.$resource.getDataDir(channel, 'feed');
    
    var fName = this._getFeedFilePath(channel);
    
    // @todo derive datdir from fName basename
    helper.mkdir_p(dataDir, 0777, function() {

        var feedStruct = {
            owner_id : channel.owner_id,
            channel_id : channel.id,
            last_update : helper.nowUTCSeconds(),
            last_build : helper.nowUTCSeconds()
        }

        model = dao.modelFactory(modelName, feedStruct, accountInfo);

        dao.create(model, function(err, result) {
            // touch the  .json source file
            fs.writeFile(fName, "", function(err) {
                if (err) {
                    console.log(err);
                    throw new Error(err);
                } else {
                    console.log("created :: " + fName );
                    next(err, 'channel', channel);
                }
            });

            next(err, 'channel', channel);
        }, accountInfo);
    });
}


/**
 * Invokes (runs) the action.
 */
Feed.prototype.invoke = function(imports, channel, sysImports, contentParts, next) {
    var dao = this.$resource.dao,
    modelName = 'channel_pod_syndication_tracking',
    dataDir = this.$resource.getDataDir(channel, 'feed'),
    exports = {};

    // pump the import payload straight into the file
    var fName = process.cwd() + dataDir + channel.id + ".json";
    fs.appendFile(fName, JSON.stringify(imports) + "\n", function (err) {
        if (err) {
            throw new Error('Could not init RSS for channel ' + channel);
        } else {
            // update model last_update attribute
            next(err, exports);
        }
    });

    next(false, exports);
}

// -----------------------------------------------------------------------------
module.exports = Feed;