/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const usersCollection = app.findCollectionByNameOrId("_pb_users_auth_");

  const collection = new Collection({
    name: "baseline_history",
    type: "base",
    system: false,
    listRule: "user_id = @request.auth.id",
    viewRule: "user_id = @request.auth.id",
    createRule: "user_id = @request.auth.id",
    updateRule: null, // Read-only - no updates allowed
    deleteRule: "user_id = @request.auth.id",
    fields: [
      // User relation
      {
        system: false,
        id: "rel_user_history",
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
      
      // Snapshot date (when this baseline snapshot was taken)
      {
        system: false,
        id: "snapshot_date",
        name: "snapshot_date",
        type: "date",
        required: true,
        presentable: false,
        hidden: false
      },
      
      // RMSSD baseline metrics
      {
        system: false,
        id: "rmssd_avg_history",
        name: "rmssd_avg",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "rmssd_stdev_history",
        name: "rmssd_stdev",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      
      // SDNN baseline metrics
      {
        system: false,
        id: "sdnn_avg_history",
        name: "sdnn_avg",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "sdnn_stdev_history",
        name: "sdnn_stdev",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      
      // Heart Rate baseline metrics
      {
        system: false,
        id: "hr_avg_history",
        name: "hr_avg",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "hr_stdev_history",
        name: "hr_stdev",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      
      // SD1/SD2 ratio baseline metrics
      {
        system: false,
        id: "sd1_sd2_ratio_avg_history",
        name: "sd1_sd2_ratio_avg",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "sd1_sd2_ratio_stdev_history",
        name: "sd1_sd2_ratio_stdev",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      
      // Metadata
      {
        system: false,
        id: "sessions_count_history",
        name: "sessions_count",
        type: "number",
        required: false,
        presentable: false,
        hidden: false
      },
      {
        system: false,
        id: "established_history",
        name: "established",
        type: "bool",
        required: false,
        presentable: false,
        hidden: false
      }
    ]
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("baseline_history");
  return app.delete(collection);
})

