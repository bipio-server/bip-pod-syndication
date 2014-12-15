/**
 *
 * The Bipio Subscribe Pod.  list action definition
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

var FeedParser = require('feedparser'),
  request = require('request'),
  moment = require('moment'),
  crypto = require('crypto'),
  favitest = require('favitest');

function Subscribe(podConfig, pod) {
  var self = this;
  pod.registerCron(this.name, '0 0 * * * *', function() {
    self.expireTracker.apply(self);
  });
}

Subscribe.prototype = {};

/**
 * Dumps any syndication GUID's tracked over 30 days ago
 */
Subscribe.prototype.expireTracker = function() {
  var self = this,
  modelName = self.$resource.getDataSourceName('track_subscribe'),
  maxTime = (new Date()).getTime() - (30 * 24 * 60 * 60 * 1000);

  self.$resource.dao.removeFilter(
    modelName,
    {
      'created' : {
        '$lt' : maxTime
      }
    },
    function(err) {
      if (err) {
        self.log(err, {
          owner_id : 'SYSTEM',
          action : self._name
        }, 'error');
      }
    }
    );
}

Subscribe.prototype.setChannelIcon = function(channel, cdnURI) {
  var newConfig = app._.clone(channel.config),
  dao = this.$resource.dao;

  channel.config.icon = newConfig.icon = cdnURI;
  dao.updateColumn('channel', {
    id : channel.id
  }, {
    config : newConfig
  });
}

Subscribe.prototype.setup = function(channel, accountInfo, next) {
  var $resource = this.$resource,
  self = this,
  podConfig = this.
  dao = $resource.dao,
  log = $resource.log;

  try {
    request(channel.config.url)
    .pipe(new FeedParser())
    .on('error', function(error) {
      log(error, channel, 'error');
      next(error, 'channel', channel);
    })
    .on('meta', function (meta) {
      // auto discover description
      var updateCols = {}, newName;

      if (meta.title && channel.name === self.description) {
        newName = meta.title.substring(0, 64);
        updateCols.name = newName;
        channel.name = newName;
      }

      if ( (!channel.note || '' === channel.note) && (meta.description && '' !== meta.description )) {
        updateCols.note = meta.description;
        channel.note = updateCols.note;
      }

      if (Object.keys(updateCols).length) {
        dao.updateColumn('channel', {
          id : channel.id
        }, updateCols);
      }

      if ( (!channel.config.icon || '' === channel.config.icon) && meta.link && '' !== meta.link) {
        favitest(channel.config.url, function(err, favURL, suffix, mime, domain) {
          if (!err) {
            var domainHash = crypto.createHash('md5').update(domain.toLowerCase()).digest("hex"),
              icoPath = self.pod.getCDNDir.call(self.pod, channel, 'syndication', 'img') +  domainHash + suffix;

            $resource.file.save(
              icoPath,
              request.get(favURL),
              {
                persist : true
              },
              function(err, struct) {
                if (!err) {
                  $resource.dao.updateChannelIcon(channel, $resource.getCDNURL() + '/' + icoPath);
                }
              });
          }
        });
      }

      next(false, 'channel', channel);
    });
  } catch (e) {
    next(e, 'channel', channel);
  }
}

/**
 * deletes subscription tracking
 */
Subscribe.prototype.teardown = function(channel, accountInfo, next) {
  var $resource = this.$resource,
  self = this,
  dao = $resource.dao,
  log = $resource.log,
  modelName = this.$resource.getDataSourceName('track_subscribe');

  dao.removeFilter(
    modelName,
    {
      owner_id : channel.owner_id,
      channel_id : channel.id
    },
    function(err) {
      if (err) {
        log(err, channel, 'error');
      }
      next(err, modelName, null);
    });
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
  meta,
  url = $resource.helper.naturalize(channel.config.url);

  if (!/^http(s?)/.test(url)) {
    next(url + ' - bad protocol');
    return;
  }

  var readable = request(url)
  .pipe(new FeedParser())
  .on('error', function(error) {
    log(error, channel);
    next(true);
  })
  .on('readable', function() {
    var chunk;
    while (null !== (chunk = readable.read())) {
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
      };

      (function(channel, chunk, next) {
        // push to tracking
        dao.find(
          modelName,
          {
            owner_id : channel.owner_id,
            channel_id : channel.id,
            guid : chunk.guid,
            bip_id : sysImports.bip.id
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
                  bip_id : sysImports.bip.id,
                  last_update : pubdate
                });

                dao.create(model);

                next(false, exports);
              } else {
                if (pubdate > result.last_update) {
                  dao.updateColumn(modelName, {
                    id : result.id
                  },  {
                    last_update : pubdate
                  });
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
