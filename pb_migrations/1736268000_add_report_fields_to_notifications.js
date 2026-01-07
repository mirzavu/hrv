/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("pbc_notifications");

    // Add report_type field (optional text field)
    collection.fields.addAt(5, new Field({
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_report_type",
        "max": 20,
        "min": 0,
        "name": "report_type",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
    }));

    // Add report_period field (optional text field to store date like '2026-01-05 00:00:00.000Z')
    collection.fields.addAt(6, new Field({
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text_report_period",
        "max": 50,
        "min": 0,
        "name": "report_period",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
    }));

    // Add unique index to prevent duplicate notifications for same report period
    collection.indexes.push(
        "CREATE UNIQUE INDEX idx_notifications_report_unique ON notifications (user_id, report_type, report_period) WHERE report_type IS NOT NULL AND report_period IS NOT NULL"
    );

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("pbc_notifications");

    // Remove the unique index
    collection.indexes = collection.indexes.filter(idx =>
        !idx.includes("idx_notifications_report_unique")
    );

    // Remove report_period field
    collection.fields.removeById("text_report_period");

    // Remove report_type field
    collection.fields.removeById("text_report_type");

    return app.save(collection);
})
