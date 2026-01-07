/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("monthly_insights");

    // Add "viewed" boolean field
    collection.fields.add(new Field({
        name: "viewed",
        type: "bool",
        required: false,
        presentable: false,
        hidden: false,
        system: false
    }));

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("monthly_insights");

    // Remove "viewed" field
    collection.fields.removeByName("viewed");

    return app.save(collection);
})
