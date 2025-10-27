/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("hrv_summary");

  // Add sd2_sd1_ratio field
  collection.fields.add(new Field({
    name: "sd2_sd1_ratio",
    type: "number",
    required: false,
    presentable: false
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("hrv_summary");
  
  const field = collection.fields.findByName("sd2_sd1_ratio");
  if (field) {
    collection.fields.remove(field.id);
  }

  return app.save(collection);
});


