/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("hrv_summary");

  // Add new SD2/SD1-based balance fields
  collection.fields.add(new Field({
    name: "sd1_sd2_balance_score_nbs",
    type: "number",
    required: false,
    presentable: false
  }));

  collection.fields.add(new Field({
    name: "sd1_sd2_parasympathetic_percent",
    type: "number",
    required: false,
    presentable: false
  }));

  collection.fields.add(new Field({
    name: "sd1_sd2_sympathetic_percent",
    type: "number",
    required: false,
    presentable: false
  }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("hrv_summary");
  
  const fields = ["sd1_sd2_balance_score_nbs", "sd1_sd2_parasympathetic_percent", "sd1_sd2_sympathetic_percent"];
  
  fields.forEach(fieldName => {
    const field = collection.fields.findByName(fieldName);
    if (field) {
      collection.fields.remove(field.id);
    }
  });

  return app.save(collection);
});

