/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const collection = app.findCollectionByNameOrId("_pb_users_auth_");

    // Add usage_phase field to users table
    collection.fields.add(new SelectField({
        name: "usage_phase",
        values: ["calibration", "early_baseline", "full_baseline"],
        maxSelect: 1,
        required: false,
        presentable: false,
        system: false,
    }));

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("_pb_users_auth_");

    // Remove field on rollback
    const field = collection.fields.findByName("usage_phase");
    if (field) collection.fields.remove(field.id);

    return app.save(collection);
});

