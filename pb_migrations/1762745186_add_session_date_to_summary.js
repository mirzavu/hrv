/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hrv_summary")

  // add session_date field to store the session's startTime
  collection.fields.addAt(collection.fields.length, new Field({
    "hidden": false,
    "id": "sessiondate",
    "name": "session_date",
    "type": "date",
    "required": false,
    "presentable": false,
    "system": false
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hrv_summary")

  // remove field
  collection.fields.removeById("sessiondate")

  return app.save(collection)
})

