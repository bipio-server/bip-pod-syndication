/**
 * 
 * Stores metadata for a syndication subscribe
 * 
 */
SubscriptionTracking = {};
SubscriptionTracking.entityName = 'track_subscribe';
SubscriptionTracking.entitySchema = {
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
        type: Number,
        renderable: true,
        writable: false
    },

    last_update : {
        type : Number,
        renderable : true,
        writable : false
    },
    
    channel_id : {
        type : String,
        renderable : true,
        writable : false
    },

    bip_id : {
        type : String,
        renderable : true,
        writable : false
    },

    // remote guid or url
    guid : {
        type : String,
        renderable : true,
        writable : false
    }
};

module.exports = SubscriptionTracking;