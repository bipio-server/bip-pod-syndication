FeedEntity = {
    entityName : 'feed_entity',
    entitySchema : {
        id: {
            type: String,
            index : true,
            renderable: false,
            writable: false
        },

        feed_id : {
            type: String,
            index : true,
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
            index : true,
            renderable: true,
            writable: false
        },

        title : {
            type : String,
            renderable : true,
            writable : false
        },    

        url : {
            type : String,
            renderable : true,
            writable : false
        },
        
        author : {
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
            index : true,
            renderable : true,
            writable : false
        }
    }
};

module.exports = FeedEntity;