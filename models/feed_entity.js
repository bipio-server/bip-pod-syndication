FeedEntity = {
    entityName : 'feed_entity',
    entitySchema : {
        id: {
            type: String,
            renderable: false,
            writable: false
        },

        feed_id : {
            type: String,
            renderable: false,
            writable: false
        },
        
        created : {
            type: Number,
            renderable: true,
            writable: false
        },

        entity_created : {
            type: Number,
            renderable: true,
            writable: false
        },

        // last append time
        title : {
            type : String,
            renderable : true,
            writable : false
        },    

        // last build time
        link : {
            type : String,
            renderable : true,
            writable : false
        },
        
        description : {
            type : String,
            renderable : true,
            writable : false
        },
        
        category : {
            type : String,
            renderable : true,
            writable : false
        }
    }
};

module.exports = FeedEntity;