/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const collection = app.findCollectionByNameOrId("_pb_users_auth_");

    // Add timezone field to users table
    // Stores IANA timezone string e.g., "Asia/Kolkata", "America/New_York"
    collection.fields.add(new TextField({
        name: "timezone",
        required: false,
        presentable: false,
        system: false,
        max: 100, // IANA timezone strings are typically under 50 chars
    }));

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("_pb_users_auth_");

    // Remove field on rollback
    const field = collection.fields.findByName("timezone");
    if (field) collection.fields.remove(field.id);

    return app.save(collection);
});
