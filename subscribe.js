/**
 *
 * The Bipio Subscribe Pod.  list action definition
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

var FeedParser = require('feedparser'),
  request = require('request'),
  moment = require('moment');

function Subscribe(podConfig) {
  this.name = 'subscribe';
  this.description = 'Subscribe to a Feed',
  this.description_long = 'Subscribes to an RSS/ATOM/RDF Feed',
  this.trigger = true; // this action can trigger
  this.singleton = false; // only 1 instance per account (can auto install)
  this.auto = false; // no config, not a singleton but can auto-install anyhow
  this.podConfig = podConfig; // general system level config for this pod (transports etc)
}

Subscribe.prototype = {};

Subscribe.prototype.getSchema = function() {
  return {
    'config' : {
      properties : {
        url : {
          type : 'string',
          optional: false,
          unique : true,
          description : 'Feed URL'
        },
        icon : {
          type : 'string',
          optional: true,
          description : 'Icon URL'
        }
      }
    },
    "imports": {
      properties : {
      }
    },
    "exports": {
      properties : {
        'guid' : {
          type : 'string',
          description : 'GUID'
        },
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
        'link' : {
          type : 'string',
          description : 'Link'
        },
        'date' : {
          type : 'string',
          description : 'Date'
        },
        'pubdate' : {
          type : 'string',
          description : 'Published Date'
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
        }
      }
    }
  }
}

Subscribe.prototype.setup = function(channel, accountInfo, next) {
    var $resource = this.$resource,
    self = this,
    dao = $resource.dao,
    log = $resource.log;

    try {
      request(channel.config.url)
        .pipe(new FeedParser())
        .on('error', function(error) {
          log(error, channel, 'error');
          console.log('returning error');
          next(error, 'channel', channel);
        })
        .on('meta', function (meta) {
          next(false, 'channel', channel);

          // auto discover description
          var updateCols = {};
     
          if (meta.title && channel.name === self.description) {
            updateCols.name = meta.title;
          }
     
          if ( (!channel.note || '' === channel.note) && (meta.description && '' !== meta.description )) {           
            updateCols.note = meta.description;           
            channel.note = updateCols.note;
          }
          
          if (Object.keys(updateCols).length) {
            dao.updateColumn('channel', { id : channel.id }, updateCols);
          }

          if ( (!channel.config.icon || '' === channel.config.icon) && meta.link && '' !== meta.link) {
            app.cdn.getFavicon(channel.config.url, function(err, cdnURI) {
              if (!err && cdnURI) {
                var newConfig = app._.clone(channel.config);
                channel.config.icon = newConfig.icon = cdnURI;
                dao.updateColumn('channel', { id : channel.id }, { config : newConfig });
              }
            });
          }
        });
    } catch (e) {
      next(e, 'channel', channel);
    }


}


/**
 * Invokes (runs) the action.
 */
Subscribe.prototype.invoke = function(imports, channel, sysImports, contentParts, next) {
  var $resource = this.$resource,
  self = this,
  dao = $resource.dao,
  log = $resource.log,
  modelName = this.$resource.getDataSourceName('track_subscribe'),
  meta;

  var readable = request(channel.config.url)
    .pipe(new FeedParser())
    .on('error', function(error) {
      log(error, channel);
      next(true);
    })
    .on('readable', function() {
      var chunk;
      while (null !== (chunk = readable.read())) {
        //console.log(chunk);
        var exports = {
          guid : chunk.guid,
          title : chunk.title,
          description : chunk.description,
          summary : chunk.summary,
          link : chunk.link,
          date : chunk.date,
          pubdate : chunk.pubdate,
          author : chunk.author,
          image : chunk.image.url || '',
          icon : channel.config.icon
          // categories : chunk.categories
        };

        (function(channel, chunk, next) {
          // push to tracking
          dao.find(
            modelName,
            {
              owner_id : channel.owner_id,
              channel_id : channel.id,
              guid : chunk.guid
            },
            function(err, result) {
              var now = moment().unix(),
                pubdate;

              if (err) {
                log(err, channel, 'error');
              } else {
                pubdate = moment(chunk.pubdate).unix();
                if (!result) {
                  var model = dao.modelFactory(modelName, {
                    owner_id : channel.owner_id,
                    channel_id : channel.id,
                    guid : chunk.guid,
                    last_update : pubdate
                  });

                  dao.create(model);

                  next(false, exports);
                } else {
                  if (pubdate > result.last_update) {
                    dao.updateColumn(modelName, { id : result.id },  { last_update : pubdate });
                    next(false, exports);
                  }
                }
              }
            }
          );
        })(channel, chunk, next);
      }
    })
    .on('end', function() {
      log(channel.config.url + ' retr finished', channel);
    });
  }

// -----------------------------------------------------------------------------
module.exports = Subscribe;