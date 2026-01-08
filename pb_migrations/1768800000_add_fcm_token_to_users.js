/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("users");

    collection.fields.add(new Field({
        name: "fcm_token",
        type: "text",
        required: false,
        presentable: false,
        hidden: false,
        system: false,
    }));

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("users");

    collection.fields.removeByName("fcm_token");

    return app.save(collection);
})
