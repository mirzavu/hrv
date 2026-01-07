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
                "id": "relation_user_id_monthly",
                "maxSelect": 1,
                "minSelect": 1,
                "name": "user_id",
                "presentable": false,
                "required": true,
                "system": false,
                "type": "relation"
            },
            {
                "hidden": false,
                "id": "date_month_start",
                "max": "",
                "min": "",
                "name": "month_start",
                "presentable": true,
                "required": true,
                "system": false,
                "type": "date"
            },
            {
                "autogeneratePattern": "",
                "hidden": false,
                "id": "text_monthly_insight_title",
                "max": 200,
                "min": 1,
                "name": "insight_title",
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
                "id": "text_monthly_insight_observation",
                "max": 2000,
                "min": 1,
                "name": "insight_observation",
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
                "id": "text_monthly_insight_action",
                "max": 1000,
                "min": 1,
                "name": "insight_action",
                "pattern": "",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "text"
            },
            {
                "hidden": false,
                "id": "autodate2990389177",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
            },
            {
                "hidden": false,
                "id": "autodate3332085496",
                "name": "updated",
                "onCreate": true,
                "onUpdate": true,
                "presentable": false,
                "system": false,
                "type": "autodate"
            }
        ],
        "id": "pbc_monthly_insights",
        "indexes": [
            "CREATE UNIQUE INDEX idx_monthly_insights_user_month ON monthly_insights (user_id, month_start)",
            "CREATE INDEX idx_monthly_insights_user_id ON monthly_insights (user_id)"
        ],
        "listRule": "user_id = @request.auth.id",
        "name": "monthly_insights",
        "system": false,
        "type": "base",
        "updateRule": "user_id = @request.auth.id",
        "viewRule": "user_id = @request.auth.id"
    });

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("pbc_monthly_insights");

    return app.delete(collection);
})
