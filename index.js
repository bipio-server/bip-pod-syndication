/**
 * 
 * The Bipio Syndication Pod.  Syndication Actions and Content Emitters
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
var Pod = require('bip-pod'),
    Syndication = new Pod({
        name : 'syndication',
        description : 'Syndication',
        description_long : 'The Syndication Pod lets you subscribe to or create syndications such as RSS, ATOM, OStatus, PubSub or your own custom time-series lists, logs and content feeds.',
        dataSources : [ require('./models/track_list') ]
    });

Syndication.add(require('./list.js'));
Syndication.add(require('./feed.js'));

// -----------------------------------------------------------------------------
module.exports = Syndication;
