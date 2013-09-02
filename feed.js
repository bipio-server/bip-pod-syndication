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

var djs = require('datejs'),
RSSFeed = require('rss'),
request = require('request');

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
        'renderers' : {
            'rss' : {
                description : 'RSS 2.0',
                contentType : DEFS.CONTENTTYPE_XML
            }
        },
        "imports": {
            properties : {
                'title' : {
                    type : 'string',
                    description : 'Title'
                },
                'link' : {
                    type : 'string',
                    description : 'Link'
                },
                'description' : {
                    type : 'string',
                    description : 'Description'
                },
                'category' : {
                    type : 'string',
                    description : 'Category Name'
                },
                'created_time' : {
                    type : 'string',
                    description : 'UTC Created Time'
                }
            }
        }
    }
}

Feed.prototype.setup = function(channel, accountInfo, next) {
    var $resource = this.$resource,
    self = this,
    dao = $resource.dao,
    log = $resource.log,
    modelName = this.$resource.getDataSourceName('feed');

    (function(channel, accountInfo, next) {
        var feedStruct = {
            owner_id : channel.owner_id,
            channel_id : channel.id,
            last_update : app.helper.nowUTCSeconds(),
            last_build : app.helper.nowUTCSeconds()
        }

        model = dao.modelFactory(modelName, feedStruct, accountInfo);
        dao.create(model, function(err, result) {
            if (err) {
                log(err, channel, 'error');
            }
            next(err, 'channel', channel);

        }, accountInfo);
    })(channel, accountInfo, next);
}

/**
 * Invokes (runs) the action.
 */
Feed.prototype.invoke = function(imports, channel, sysImports, contentParts, next) {
    var $resource = this.$resource,
    self = this,
    dao = $resource.dao,
    log = $resource.log,
    modelName = this.$resource.getDataSourceName('feed'),
    entityModelName = this.$resource.getDataSourceName('feed_entity');

    (function(imports, channel, sysImports, next) {
        // get feed metadata
        dao.find(
            modelName,
            {
                owner_id : channel.owner_id,
                channel_id : channel.id
            },
            function(err, result) {
                if (err) {
                    log(err, channel, 'error');
                } else {
                    // set last update time (now)
                    dao.updateColumn(
                        modelName,
                        {
                            id : result.id
                        },
                        {
                            last_update : app.helper.nowUTCSeconds()
                        }
                        );

                    // insert entry
                    var entityStruct = {
                        feed_id : result.id,
                        title : imports.title,
                        link : imports.link,
                        description : imports.description,
                        category : imports.category,
                        entity_created : imports.created_time && imports.created_time !== '' ?
                        Date.parse(imports.created_time).getTime()/1000 :
                        app.helper.nowUTCSeconds()
                    }

                    model = dao.modelFactory(entityModelName, entityStruct);
                    dao.create(model, function(err, result) {
                        if (err) {
                            log(err, channel, 'error');
                        }
                        next(
                            err,
                            {
                                id : result.id
                            }
                            );
                    });
                }
            }
            );

    })(imports, channel, sysImports, next);
}

Feed.prototype.rpc = function(method, options, req, next, channel) {
    var $resource = this.$resource,
    self = this,
    dao = $resource.dao,
    log = $resource.log,
    modelName = this.$resource.getDataSourceName('feed'),
    entityModelName = this.$resource.getDataSourceName('feed_entity');

    // @todo - cache compiled feed to disk
    if (method == 'rss') {

        // get feed metadata
        dao.find(
            modelName,
            {
                owner_id : channel.owner_id,
                channel_id : channel.id
            },
            function(err, result) {
                if (err) {
                    log(err, channel, 'error');
                    next(true, null, err)
                } else if (!result) {
                    next();
                } else {
                    // get last 10 entities
                    var account = {
                        user : {
                            id : channel.owner_id
                        }
                    };
                    dao.list(
                        entityModelName,
                        null,
                        10,
                        1,
                        'entity_created',
                        {
                            feed_id : result.id
                        },
                        function(err, modelName, results) {
                            if (err) {
                                log(err, channel, 'error');
                                next(true, null, err)
                            } else {
                                var struct = {
                                    'meta' : {
                                        title: channel.name,
                                        feed_url : channel.getRendererUrl('rss', req.remoteUser), // self renderer
                                        site_url : req.remoteUser.getDefaultDomainStr(true), // self renderer
                                        image : '', // channel config icon image
                                        description: channel.note,
                                        author : req.remoteUser.getName()
                                    }
                                };
                                var renderOpts = {
                                    content_type : self.getSchema().renderers.rss.contentType
                                };


                                feed = new RSSFeed(struct.meta);
                                for (var i = 0; i < results.data.length; i++) {
                                    console.log(results.data[i]);
                                    results.data[i].guid = results.data[i].id;
                                    results.data[i].categories = [ results.data[i].category ];
                                    feed.item(results.data[i]);
                                }

                                next(
                                    false,
                                    undefined,
                                    feed.xml(),
                                    200,
                                    renderOpts);
                            }
                        }
                        );
                }
            }
            );
    }
};

// -----------------------------------------------------------------------------
module.exports = Feed;