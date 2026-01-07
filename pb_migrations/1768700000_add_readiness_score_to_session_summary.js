/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("session_summary");

    // Add "readiness_score" number field
    collection.fields.add(new Field({
        name: "readiness_score",
        type: "number",
        required: false,
        presentable: false,
        hidden: false,
        system: false,
        min: null,
        max: null,
        noDecimal: false
    }));

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("session_summary");

    // Remove "readiness_score" field
    collection.fields.removeByName("readiness_score");

    return app.save(collection);
})
