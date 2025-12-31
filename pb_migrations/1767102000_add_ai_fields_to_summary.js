/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const collection = app.findCollectionByNameOrId("session_summary");

    // Add ai_title field
    collection.fields.add(new Field({
        name: "ai_title",
        type: "text",
        required: false,
        presentable: false,
        system: false,
    }));

    // Add ai_interpretation field
    collection.fields.add(new Field({
        name: "ai_interpretation",
        type: "text",
        required: false,
        presentable: false,
        system: false,
    }));

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("session_summary");

    // Remove fields
    const field1 = collection.fields.findByName("ai_title");
    if (field1) collection.fields.remove(field1.id);

    const field2 = collection.fields.findByName("ai_interpretation");
    if (field2) collection.fields.remove(field2.id);

    return app.save(collection);
});
