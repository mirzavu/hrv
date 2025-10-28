/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("_pb_users_auth_");

  const collection = new Collection({
    id: "user_baselines",
    name: "user_baselines",
    type: "base",
    system: false,
    listRule: "user_id = @request.auth.id",
    viewRule: "user_id = @request.auth.id",
    createRule: "user_id = @request.auth.id",
    updateRule: "user_id = @request.auth.id",
    deleteRule: "user_id = @request.auth.id",
    fields: [
      // User relation
      {
        system: false,
        id: "rel_user",
        name: "user_id",
        type: "relation",
        required: true,
        presentable: false,
        hidden: false,
        collectionId: usersCollection.id,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0
      },
      
      // RMSSD baseline metrics
      {
        system: false,
        id: "rmssd_avg",
        name: "rmssd_avg",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "rmssd_std",
        name: "rmssd_stdev",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      
      // SDNN baseline metrics
      {
        system: false,
        id: "sdnn_avg",
        name: "sdnn_avg",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "sdnn_std",
        name: "sdnn_stdev",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      
      // Heart Rate baseline metrics
      {
        system: false,
        id: "hr_avg",
        name: "hr_avg",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "hr_std",
        name: "hr_stdev",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      
      // SD1/SD2 ratio baseline metrics
      {
        system: false,
        id: "sd1_sd2_avg",
        name: "sd1_sd2_ratio_avg",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "sd1_sd2_std",
        name: "sd1_sd2_ratio_stdev",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      
      // Metadata
      {
        system: false,
        id: "sess_count",
        name: "sessions_count",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "established",
        name: "established",
        type: "bool",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "updated_at",
        name: "last_updated",
        type: "date",
        required: false,
        presentable: false,
        hidden: false
      }
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("user_baselines");
  return app.delete(collection);
})

