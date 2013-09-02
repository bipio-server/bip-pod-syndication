/**
 * 
 * Stores metadata for a syndication feed channel
 * 
 */
Feed = {
    entityName : 'feed',
    entitySchema : {
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

        channel_id : {
            type : String,
            renderable : true,
            writable : false
        },

        created : {
            type: Number,
            renderable: true,
            writable: false
        },

        // last append time
        last_update : {
            type : Number,
            renderable : true,
            writable : false
        },    

        // last build time
        last_build : {
            type : Number,
            renderable : true,
            writable : false
        }
    },
    compoundKeyContraints : {
        channel_id : 1,
        owner_id :1 
    }
};


module.exports = Feed;