/**
 *
 * The Bipio Feed Pod.  list action definition
 * ---------------------------------------------------------------
 *
 * @author Michael Pearson <github@m.bip.io>
 * Copyright (c) 2010-2014 Michael Pearson https://github.com/mjpearson
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
fs = require('fs'),
path = require('path'),
ejs = require('ejs'),
request = require('request'),
imagemagick = require('imagemagick');
htmlparser = require('htmlparser2');


function Feed(podConfig, pod) {
  var self = this;
  
  this.name = 'feed';
  this.description = 'Create A Feed',
  this.description_long = 'Creates an syndication from content you receive from Bips',
  this.trigger = false; // this action can trigger
  this.singleton = false; // only 1 instance per account (can auto install)
  this.auto = false; // no config, not a singleton but can auto-install anyhow
  this.podConfig = podConfig; // general system level config for this pod (transports etc)

  pod.registerCron(this.name, '0 0 * * * *', function() {
    self.expireFeeds.apply(self);
  });
}

Feed.prototype = {};

Feed.prototype.expireFeeds = function() {
  var self = this;

  // get all feeds
  self.$resource.dao.findFilter(
    'channel',
    {
      action : 'syndication.feed'
    },
    function(err, results) {
      var r;
      if (!err) {
        for (var i = 0; i < results.length; i++) {
          r = results[i],
          feedEntityModelName = self.$resource.getDataSourceName('feed_entity'),
          modelName = self.$resource.getDataSourceName('feed');

          // @todo configurable purge times
          if (r.config && '30d' === r.config.purge_after) {
            // purge channel data
            (function(channel) {
              // get marked feeds
              self.$resource.dao.findFilter(
                modelName,
                {
                  channel_id : r.id,
                  owner_id : r.owner_id
                },
                function(err, results) {                  
                  var filter,
                  maxTime = (new Date()).getTime() - (30 * 24 * 60 * 60 * 1000);
                  if (err) {
                    self.log(err, channel, 'error');
                  } else {
                    if (results) {
                      for (var i = 0; i < results.length; i++) {
                        filter = {
                          'feed_id' : results[i].id,
                          'created' : {
                            '$lt' : maxTime
                          }
                        };
                        
                        self.$resource.dao.removeFilter(feedEntityModelName, filter, function(err) {
                          if (err) {
                            self.log(err, channel, 'error');                        
                          }                      
                        });
                      }
                      
                      self.pod.expireCDNDir(channel, self._name, channel.config.purge_after);
                    }
                  }
                }
                );
            })(r);
          }
        }
      } else {
        self.log(err, {
          owner_id : 'SYSTEM',
          action : self._name
        }, 'error');
      }
    }
    );
}

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
      },
      'blog' : {
        description : 'Blog',
        description_long : 'Blogging Format',
        contentType : DEFS.CONTENTTYPE_HTML
      },
      'remove_by_bip' : {
        description : 'Remove By Bip ID',
        description_long : 'Removes a feed entity by its originating Bip ID',
        contentType : DEFS.CONTENTTYPE_JSON,
        properties : {
          id : {
            type : 'string',
            description : 'Bip ID',
            required : true
          }
        }
      },
      'remove_entity' : {
        description : 'Remove Feed Entity',
        description_long : 'Removes a feed entity by its GUID',
        contentType : DEFS.CONTENTTYPE_JSON,
        properties : {
          guid : {
            type : 'string',
            description : 'Entity ID',
            required : true
          }
        }
      }
    },
    'config' : {
      properties : {
        twitter_handle : {
          type : 'string',
          description : 'Twitter Handle (Blog Renderer)'
        },
        github_handle : {
          type : 'string',
          description : 'Github Username (Blog Renderer)'
        },
        dribble_handle : {
          type : 'string',
          description : 'Dribble Username (Blog Renderer)'
        },
        purge_after : {
          type : 'string',
          description : 'Purge after (n) days,weeks,months',
          oneOf : [
          {
            "$ref" : "#/config/definitions/purge_after"
          }
          ]
        }
      },
      definitions : {
        purge_after : {
          "description" : "Purge Content",
          "enum" : [ "never" , "30d" ],
          "enum_label" : [ "Never" , "After 30 Days" ],
          'default' : 'never'
        }
      }
    },
    "imports": {
      properties : {
        'title' : {
          type : 'string',
          description : 'Title'
        },
        'description' : {
          type : 'text',
          description : 'Description'
        },
        'summary' : {
          type : 'text',
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

        'icon' : {
          type : 'string',
          description : 'Source Icon'
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

    self.pod.getCDNDir(channel, 'feed');

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
                dao.removeFilter(feedModelName, {
                  id : feed.id
                }, next );
              }
            }
            );
        } else {
          next(err, feedEntityModelName, null);
        }
      }
    });

  self.pod.rmCDNDir(channel, 'feed');
}

/**
 * push to local cdn path (public)
 */
Feed.prototype._pushImageCDN = function(channel, srcUrl, next) {
  this.pod.getCDNDir(channel, 'feed', function(err, path) {
    if (!err) {
      var dstFile = path + app.helper.strHash(srcUrl) + '.' + (srcUrl.split('.').pop());
      app.cdn.httpFileSnarf(srcUrl, dstFile, next);
    }
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
          var createTime = moment(imports.created_time).unix();

          if (isNaN(createTime)) {
            createTime = Math.floor(app.helper.nowUTCSeconds() / 1000);
          }

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
            icon : imports.icon,
            summary : imports.summary,
            description : imports.description,
            category : imports.category,
            entity_created : createTime,
            src_bip_id : sysImports.bip.id
          }

          entityStruct = app.helper.pasteurize(entityStruct, true);

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
      if (err || !feedMeta || feedMeta.length === 0) {
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
              if ('since' === filterVars[0] && !isNaN(Number(filterVars[1]))) {
                filter['created'] = {
                  '$gt' : Number(filterVars[1] * 1000)
                }
              } else if ('since' !== filterVars[0]) {
                filter[filterVars[0]] = filterVars[1];
              }
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

              if (results.data) {
                for (var i = 0; i < results.data.length; i++) {
                  results.data[i] = {
                    guid : results.data[i].id,
                    categories : [ results.data[i].category ],
                    'title' : results.data[i].title,
                    'description' : results.data[i].description,
                    'link' : results.data[i].url,
                    'icon' : results.data[i].icon,
                    'image' : results.data[i].image,
                    'image_dim' : results.data[i].image_dim,
                    'author' : results.data[i].author,
                    'created_time' : results.data[i].entity_created,
                    'feed_id' : results.data[i].feed_id,
                    '_channel_id' : results.data[i]._channel_id,
                    'src_bip_id' : results.data[i].src_bip_id
                  }
                }
              }
            }

            res.contentType(self.getSchema().renderers[method].contentType);
            res.send($resource.htmlNormalize(payload));
          }
        });
    })(method, channel, req, res);
  }
  else if ('blog' === method) {
    var user = req.remoteUser.user,
    tokens = req.params[0] ===  '/' ? ['', 'page' , 1] : req.params[0].split('/'),
    page = tokens[2];

    if (tokens[1] === 'page' && page) {
      var indexFile = __dirname + '/blog/default/index.ejs';
      fs.readFile(indexFile, 'utf8', function(err, file) {
        if(err) {
          res.writeHead(500, {
            "Content-Type": "text/plain"
          });
          res.write(err + "\n");
          res.end();
          return;
        }

        var tplVars = {
          blogName : channel.name,
          avatar : CFG.website_public + user.settings.avatar,
          name : user.username,
          rssImage : '<img src="' + CFG.website_public + '/static/img/channels/32/color/syndication.png" alt="" class="hub-icon hub-icon-24">',
          twitterImage : channel.config.twitter_handle ? '<a href="https://twitter.com/' + channel.config.twitter_handle + '"><img src="' + CFG.website_public + '/static/img/channels/32/color/twitter.png" alt="" class="hub-icon hub-icon-24"></a><br/>' : '',
          githubImage : channel.config.github_handle ? '<a href="https://github.com/' + channel.config.github_handle + '"><img src="' + CFG.website_public + '/static/img/channels/32/color/github.png" alt="" class="hub-icon hub-icon-24"></a><br/>' : '',
          dribbleImage : channel.config.dribble_handle ? '<a href="http://dribble.com/' + channel.config.dribble_handle + '"><img src="' + CFG.website_public + '/static/img/channels/32/color/dribble.png" alt="" class="hub-icon hub-icon-24"></a><br/>' : '',
          moment : moment
        };

        var firstImage = false;

        self._retr(
          channel,
          10,
          page,
          undefined,
          function(err, results) {
            if (err) {
              res.send(500);
            } else {
              tplVars.articles = results;
              if (results && results.data) {
                for (var i = 0; i < results.data.length; i++) {
                  if (results.data[i].summary && /<img/.test(results.data[i].summary) ) {
                    firstImage = false;
                    var parser = new htmlparser.Parser({
                      onopentag : function(name, attribs) {
                        if (name === 'img' && !firstImage ) {
                          results.data[i].summary = results.data[i].summary.replace(attribs.src, results.data[i].image);
                          firstImage = true;
                        }
                      }
                    });

                    parser.write(results.data[i].summary);
                    parser.end();
                  }
                }
              }
              res.writeHead(200);
              res.write(ejs.render(file, tplVars), "binary");
              res.end();
            }
          })
      });
    } else if (tokens[1] === 'rss') {
      this.rpc('rss', sysImports, options, channel, req, res);
    } else {
      res.send(404);
    }

  } else if ('remove_entity' === method) {
    if (options.guid) {
      this._removeByFilter(channel, {
        id : options.guid
      }, res);
    } else {
      res.send(500);
    }
  } else if ('remove_by_bip' === method) {
    if (options.id) {
      this._removeByFilter(channel, {
        src_bip_id : options.id
      }, res);
    } else {
      res.send(500);
    }
  } else {
    res.send(404);
  }
};

Feed.prototype._removeByFilter = function(channel, entityFilter, res) {
  var $resource = this.$resource,
  dao = $resource.dao,
  modelName = $resource.getDataSourceName('feed'),
  entityModelName = $resource.getDataSourceName('feed_entity'),
  filter = {
    owner_id : channel.owner_id,
    channel_id : channel.id
  };

  dao.findFilter(
    modelName,
    filter,
    function(err, feedMeta) {
      if (err || (feedMeta && feedMeta.length != 1)) {
        res.send(500);
      } else {
        dao.removeFilter(entityModelName, entityFilter, function(err) {
          if (err) {
            res.send(500);
          } else {
            entityFilter.feed_id = feedMeta[0].id;

            // update last build time
            dao.updateColumn(
              modelName,
              {
                id : feedMeta[0].id
              },
              {
                last_build : app.helper.nowUTCSeconds()
              }
              );
            res.send({
              message : 'OK'
            } , 200);
          }
        });
      }
    }
    );
}

// -----------------------------------------------------------------------------
module.exports = Feed;