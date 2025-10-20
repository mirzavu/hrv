/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3660498186")

  // remove field
  collection.fields.removeById("text343498061")

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "file1663613038",
    "maxSelect": 1,
    "maxSize": 0,
    "mimeTypes": [],
    "name": "rawFile",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3660498186")

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text343498061",
    "max": 0,
    "min": 0,
    "name": "rawFileId",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // remove field
  collection.fields.removeById("file1663613038")

  return app.save(collection)
})
