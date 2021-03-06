FeedEntity = {
    entityName : 'feed_entity',
    entitySchema : {
        id: {
            type: String,
            index : true,
            renderable: true,
            writable: false
        },

        feed_id : {
            type: String,
            index : true,
            renderable: true,
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
        
        description : {
            type : String,
            renderable : true,
            writable : false
        },
        
        summary : {
            type : String,
            renderable : true,
            writable : false
        },
        
        url : {
            type : String,
            renderable : true,
            writable : false
        },
        
        image : {
            type : String,
            renderable : true,
            writable : false
        },
        
        icon : {
            type : String,
            renderable : true,
            writable : false
        },
        
        image_dim : {
          type : Object,
          renderable : true,
          writable : false
        },
        
        author : {
            type : String,
            renderable : true,
            writable : false
        },
        
        category : {
            type : Array,
            index : true,
            renderable : true,
            writable : false
        },
        
        src_bip_id : {
            type : String,
            renderable : false,
            writable : false
        },
        
        favorited : {
          type : Boolean,
          "default" : false,
          renderable: true,
          writable : false
        }
    }
};
module.exports = FeedEntity;