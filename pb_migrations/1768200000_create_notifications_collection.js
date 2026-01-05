/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = new Collection({
        "createRule": "@request.auth.id != ''",
        "deleteRule": "user_id = @request.auth.id",
        "fields": [
            {
                "autogeneratePattern": "[a-z0-9]{15}",
                "hidden": false,
                "id": "text3208210256",
                "max": 15,
                "min": 15,
                "name": "id",
                "pattern": "^[a-z0-9]+$",
                "presentable": false,
                "primaryKey": true,
                "required": true,
                "system": true,
                "type": "text"
            },
            {
                "cascadeDelete": true,
                "collectionId": "_pb_users_auth_",
                "hidden": false,
                "id": "relation_user_id",
                "maxSelect": 1,
                "minSelect": 1,
                "name": "user_id",
                "presentable": false,
                "required": true,
                "system": false,
                "type": "relation"
            },
            {
                "autogeneratePattern": "",
                "hidden": false,
                "id": "text_type",
                "max": 50,
                "min": 1,
                "name": "type",
                "pattern": "",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "text"
            },
            {
                "autogeneratePattern": "",
                "hidden": false,
                "id": "text_title",
                "max": 200,
                "min": 1,
                "name": "title",
                "pattern": "",
                "presentable": true,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "text"
            },
            {
                "autogeneratePattern": "",
                "hidden": false,
                "id": "text_message",
                "max": 1000,
                "min": 0,
                "name": "message",
                "pattern": "",
                "presentable": false,
                "primaryKey": false,
                "required": false,
                "system": false,
                "type": "text"
            },
            {
                "hidden": false,
                "id": "bool_read",
                "name": "read",
                "presentable": false,
                "required": false,
                "system": false,
                "type": "bool"
            },
            {
                "hidden": false,
                "id": "autodate2990389176",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
            },
            {
                "hidden": false,
                "id": "autodate3332085495",
                "name": "updated",
                "onCreate": true,
                "onUpdate": true,
                "presentable": false,
                "system": false,
                "type": "autodate"
            }
        ],
        "id": "pbc_notifications",
        "indexes": [
            "CREATE INDEX idx_notifications_user_id ON notifications (user_id)",
            "CREATE INDEX idx_notifications_created ON notifications (created DESC)"
        ],
        "listRule": "user_id = @request.auth.id",
        "name": "notifications",
        "system": false,
        "type": "base",
        "updateRule": "user_id = @request.auth.id",
        "viewRule": "user_id = @request.auth.id"
    });

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("pbc_notifications");

    return app.delete(collection);
})
