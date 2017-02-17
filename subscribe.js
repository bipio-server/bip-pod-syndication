/**
 *
 * The Bipio Subscribe Pod.  list action definition
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
  self.pod.expireDups(null, 30, function(err) {
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
    parser = new FeedParser(),
    $resource = this.$resource,
    dao = $resource.dao,feedURL='';

  try {
  	  feedURL = channel.config.url;
      request(feedURL)
      .pipe(parser)
      .on('error', function(error) {
        next(error, 'channel', channel);
        delete parser;

      })
      .on('meta', function (meta) {

        delete parser;

        // auto discover description
        var updateCols = {}, newName,hubURL="";
    	  if(meta["atom:link"]) {
    		  for(var i=0;i<meta["atom:link"].length ;i++){
    			  if(meta["atom:link"][i]["@"]["rel"] && meta["atom:link"][i]["@"]["rel"] == 'hub') {
    				  hubURL = meta["atom:link"][i]["@"]["href"];
    				  $resource.dao.createBip(
                {
  			          type : 'http',
  			          note : 'PuSH Callback for ' + meta.title + ' RSS',
  			          app_id : 'syndication.subscribe',
  			          end_life : {
  			        	  time : 0,
  			              imp : 0
  			          },
  			          hub : {
  			            source : {
  			              edges : []
  			            }
  			          },
  			          config : {
  			            auth : 'none',
  			          }
  			        },
  			        accountInfo,
  			        function(err, modelName, bip) {
  			          if (!err) {
  			        	  request({
  			        		    url: hubURL, //URL to hit
  			        		    qs: {
                          from:'bipio',
                          time: +new Date()
                        },  //Query string data
  			        		    method: 'POST',
  			        		    form : {
                          'hub.mode': 'subscribe',
                          'hub.topic':feedURL,
                          'hub.callback':bip._repr,
                          'hub.verify':'sync'
                        }
  			        		}, function(error, response, body){
  		        		    if(error) {
                        next(error);
  		        		        console.log("Error "+error);
  		        		    } else {
                        next();
  		        		    }
  			        		});
  			          } else {
                    next(err);
  			          }
  			        }
              );
    			  }
    		  }
    	  }

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
                  $resource.dao.updateChannelIcon(
                    channel,
                    $resource.getCDNURL().replace('/' + self.pod.options.cdnBasePath , '')
                      + '/' + icoPath
                  );
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
      // RSS is guid, ATOM is id
      $resource.dupFilter(exports, exports.guid ? 'guid' : 'id', channel, sysImports, function(err, entity) {
        next(err, entity);
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
  modelName = this.$resource.getDataSourceName('track_subscribe'),
  meta,
  url = $resource.helper.naturalize(imports.url);

  if (!/^http(s?)/.test(url)) {
    next(url + ' - bad protocol');
    return;
  }

  var parser = new FeedParser(),
    readable = request(url)
    .pipe(parser)
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
          icon : imports.icon
        };

        next(false, exports);

        delete parser;
      }
    });
}

// -----------------------------------------------------------------------------
module.exports = Subscribe;
