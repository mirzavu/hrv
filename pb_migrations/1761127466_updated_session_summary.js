/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hrv_summary")

  // add field
  collection.fields.addAt(35, new Field({
    "hidden": false,
    "id": "json624997478",
    "maxSize": 0,
    "name": "rr_quality_data",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hrv_summary")

  // remove field
  collection.fields.removeById("json624997478")

  return app.save(collection)
})
