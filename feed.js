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

var moment = require('moment'),
  RSSFeed = require('rss'),
  request = require('request'),
  imagemagick = require('imagemagick');
  htmlparser = require('htmlparser2');

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
        description_long : 'Serves stored items as an RSS 2.0 Feed',
        contentType : DEFS.CONTENTTYPE_XML
      },
      'json' : {
        description : 'JSON',
        description_long : 'Serves stored items as JSON',
        contentType : DEFS.CONTENTTYPE_JSON
      }
    },
    "imports": {
      properties : {
        'title' : {
          type : 'string',
          description : 'Title'
        },
        'description' : {
          type : 'string',
          description : 'Description'
        },
        'summary' : {
          type : 'string',
          description : 'Article Summary'
        },
        'url' : {
          type : 'string',
          description : 'Source URL'
        },
        'created_time' : {
          type : 'string',
          description : 'UTC Created Time'
        },
       
        'author' : {
          type : 'string',
          description : 'Author'
        },
        'image' : {
          type : 'string',
          description : 'Image'
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
 * deletes feed and feed entities for this channel
 */
Feed.prototype.teardown = function(channel, accountInfo, next) {
  var $resource = this.$resource,
    self = this,
    dao = $resource.dao,
    log = $resource.log,
    feedModelName = this.$resource.getDataSourceName('feed'),
    feedEntityModelName = this.$resource.getDataSourceName('feed_entity');

  dao.findFilter(
    feedModelName, 
    {
     owner_id : channel.owner_id,
     channel_id : channel.id
    }, 
    function(err, results) {   
      if (err) {
          log(err, channel, 'error');
      } else {
        var feed = results[0];
        if (feed) {
          dao.removeFilter(
            feedEntityModelName, 
            {
              feed_id : feed.id
            },
            function(err) {
              if (err) {
                log(err, channel, 'error');
              } else {
                dao.removeFilter(feedModelName, { id : feed.id }, next );
              }
            }
          );
        } else {
          next(err, feedEntityModelName, null);
        }
      }
  });  
}

/**
 * push to local cdn path (public)
 */
Feed.prototype._pushImageCDN = function(channel, srcUrl, next) {
  this.pod.getCDNDir(channel, 'feed', function(err, path) {
    var dstFile = path + app.helper.strHash(srcUrl) + '.' + (srcUrl.split('.').pop());
    app.cdn.httpFileSnarf(srcUrl, dstFile, next);  
  });   
}

Feed.prototype._createFeedEntity = function(entityStruct, channel, next) {
  var entityModelName = this.$resource.getDataSourceName('feed_entity'),
    dao = this.$resource.dao,
    model = dao.modelFactory(entityModelName, entityStruct);
    
    dao.create(model, function(err, modelName, result) {
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

          // override supplied image with first found.
          var firstImage = false;
          var parser = new htmlparser.Parser({
            onopentag : function(name, attribs) {
              if (name === 'img' && !firstImage ) {
                imports.image = attribs.src;
                firstImage = true;
              }
            }
          });

          parser.write(imports.description);
          parser.end();

          var entityStruct = {
            feed_id : result.id,
            title : imports.title,
            url : imports.url,
            author : imports.author,
            image : imports.image,
            summary : imports.summary,
            description : imports.description,
            category : imports.category,
            entity_created : imports.created_time && '' !== imports.created_time && 'null' !== imports.created_time  ?
              moment(imports.created_time).unix() : (app.helper.nowUTCSeconds() / 1000)
          }

          // if we have an image, push it into cdn
          if (imports.image) {
            self._pushImageCDN(channel, imports.image, function(err, struct) {
              var cdnURI, cdnRegExp;
              if (!err) {
                if (struct.file) {
                  cdnRegExp = new RegExp('.*' + CDN_DIR.replace('/', '\\/'));                 
                  cdnURI = struct.file.replace(cdnRegExp, CFG.cdn_public);
                  entityStruct.image = cdnURI;
                  
                  imagemagick.identify(struct.file, function(err, features) {
                    entityStruct.image_dim = {
                      width : features.width,
                      height : features.height,
                      format : features.format
                    };

                    self._createFeedEntity(entityStruct, channel, next);
                  });
                }              
              }             
            });
          } else {
            self._createFeedEntity(entityStruct, channel, next);  
          }
        }
      }
      );

  })(imports, channel, sysImports, next);
}

Feed.prototype._retr = function(channel, pageSize, page, customFilter, next) {
  var $resource = this.$resource,
    dao = $resource.dao,
    modelName = $resource.getDataSourceName('feed'),
    entityModelName = $resource.getDataSourceName('feed_entity'),
    filter = {
      owner_id : channel.owner_id,
    };

  if (channel.id) {
    filter.channel_id = channel.id;
  }

  dao.findFilter(
    modelName,
    filter,
    function(err, feedMeta) {
      if (err || !feedMeta) {
        next(err, feedMeta);
      } else {
        var account = {
          user : {
            id : channel.owner_id
          }
        };

        var currentPage = parseInt(page) || 1,
        currentPageSize = parseInt(pageSize) || 10,
        order_by = ['entity_created', 'desc'];

        var filter = {
          feed_id : {
            '$in' : app._.pluck(feedMeta, 'id')
          }
        };

        // extract filters
        if (undefined != customFilter) {
          var tokens = customFilter.split(',');
          for (i in tokens) {
            var filterVars = tokens[i].split(':');
            if (undefined != filterVars[0] && undefined != filterVars[1]) {
              filter[filterVars[0]] = filterVars[1];
            }
          }
        }

        dao.list(
          entityModelName,
          null,
          currentPageSize,
          currentPage,
          order_by,
          filter,
          function(err, modelName, feedData) {
            if (err) {
              next(err, feedData);
            } else {
             
              for (var i = 0; i < feedData.data.length; i++) {                
                feedData.data[i]._channel_id = feedMeta[0].channel_id;             
              }

              next(false, feedData);
            }
          });
      }
    }
    );
}

Feed.prototype.rpc = function(method, sysImports, options, channel, req, res) {
  var $resource = this.$resource,
  self = this,
  dao = $resource.dao,
  log = $resource.log;

  // @todo - cache compiled feed to disk
  if ('rss' === method || 'json' === method) {
    (function(method, channel, req, res) {
      self._retr(
        channel,
        req.query.page_size,
        req.query.page,
        req.query.filter,
        function(err, results) {
          if (err) {
            log(err, channel, 'error');
            res.send(500);
          } else if (!results) {
            res.send(404);
          } else {
            var struct = {
              'meta' : {
                title: channel.name || req.remoteUser.user.name + ' Aggregate',
                feed_url : channel.getRendererUrl(method, req.remoteUser), // self renderer
                site_url : req.remoteUser.getDefaultDomainStr(true), // self renderer
                image : channel.config && channel.config.image ? channel.config.image : '', // channel config icon image
                description: channel.note || 'All Feeds',
                author : req.remoteUser.getName()
              }
            };
            var renderOpts = {
              content_type : self.getSchema().renderers.rss.contentType
            };

            var payload;
            if ('rss' === method) {
              feed = new RSSFeed(struct.meta);
              for (var i = 0; i < results.data.length; i++) {
                results.data[i].guid = results.data[i].id;
                results.data[i].categories = [ results.data[i].category ];
                feed.item(results.data[i]);
              }
              payload = feed.xml();
            } else if ('json' === method) {
              payload = {
                meta : struct.meta,
                entities : results
              }

              for (var i = 0; i < results.data.length; i++) {
                results.data[i] = {
                  guid : results.data[i].id,
                  categories : [ results.data[i].category ],
                  'title' : results.data[i].title,
                  'description' : results.data[i].description,
                  'link' : results.data[i].url,
                  'image' : results.data[i].image,
                  'image_dim' : results.data[i].image_dim,
                  'created_time' : results.data[i].entity_created,
                  '_channel_id' : results._channel_id
                }
              }
            }

            res.contentType(self.getSchema().renderers[method].contentType);
            res.send(payload);
          }
        });
    })(method, channel, req, res);
  } else {
    res.send(404);
  }
};

// -----------------------------------------------------------------------------
module.exports = Feed;