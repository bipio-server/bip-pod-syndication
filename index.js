/**
 *
 * The Bipio Syndication Pod.  Syndication Actions and Content Emitters
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
var Pod = require('bip-pod'),
    Syndication = new Pod({
        name : 'syndication',
        title : 'Syndication',
        description : 'The Syndication Pod lets you subscribe to or create syndications such as RSS/ATOM/JSON or your own custom time-series lists, logs and content feeds.',
        dataSources : [
            require('./models/track_list'),
            require('./models/feed'),
            require('./models/feed_entity'),
            require('./models/track_subscribe'),
        ]
    });



Syndication.add(require('./list.js'));
Syndication.add(require('./feed.js'));
Syndication.add(require('./subscribe.js'));

// -----------------------------------------------------------------------------
module.exports = Syndication;
