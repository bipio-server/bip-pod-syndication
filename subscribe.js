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
  var self = this;
  self.pod.expireDups(channel, 30, function(err) {
    if (err) {
      self.log(err, {
        owner_id : 'SYSTEM',
        action : self._name
      }, 'error');
    }
  });
}

Subscribe.prototype.setup = function(channel, accountInfo, next) {
  var self = this,
    $resource = this.$resource,
    dao = $resource.dao;

  try {
    request(channel.config.url)
    .pipe(new FeedParser())
    .on('error', function(error) {
      next(error, 'channel', channel);
    })
    .on('meta', function (meta) {
      // auto discover description
      var updateCols = {}, newName;

      if (meta.title && channel.name === self.schema.title) {
        newName = meta.title.substring(0, 64);
        updateCols.name = newName;
        channel.name = newName;
      }

      if ((!channel.note || '' === channel.note || self.schema.description === channel.note)
        && (meta.description && '' !== meta.description )) {

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

Subscribe.prototype.trigger = function(imports, channel, sysImports, contentParts, next) {
  var self = this,
    $resource = this.$resource;

  this.invoke(imports, channel, sysImports, contentParts, function(err, exports) {
    if (err) {
      next(err);
    } else {
      $resource.dupFilter(exports, 'guid', channel, sysImports, function(err, entity) {
        next(err, addr);
      });
    }
  });
}


/**
 * Invokes (runs) the action.
 */
Subscribe.prototype.invoke = function(imports, channel, sysImports, contentParts, next) {
  var $resource = this.$resource,
  self = this,
  dao = $resource.dao,
//  log = $resource.log,
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
    next(error);
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

      next(false, exports);
    }
  });
//  .on('end', function() {
//    log(channel.config.url + ' retr finished', channel);
//  });
}

// -----------------------------------------------------------------------------
module.exports = Subscribe;
