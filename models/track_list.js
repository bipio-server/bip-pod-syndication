/**
 * 
 * Stores metadata for a syndication feed channel
 * 
 */
ListTracking = {};
ListTracking.entityName = 'track_list';
ListTracking.entitySchema = {
    id: {
        type: String,
        renderable: false,
        writable: false
    },
    owner_id : {
        type: String,
        renderable: false,
        writable: false
    },
    
    created : {
        type: String,
        renderable: true,
        writable: false
    },
    
    // last append time
    last_update : {
        type : String,
        renderable : true,
        writable : false
    },
    
    channel_id : {
        type : String,
        renderable : true,
        writable : false
    },
    
    // last build time
    last_build : {
        type : String,
        renderable : true,
        writable : false
    }
};

ListTracking.compoundKeyContraints = {
    channel_id : 1
};

module.exports = ListTracking;