/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // Get collection IDs
  const usersCollection = app.findCollectionByNameOrId("_pb_users_auth_");
  const sessionsCollection = app.findCollectionByNameOrId("sessions");

  const collection = new Collection({
    id: "hrv_summary",
    name: "session_summary",
    type: "base",
    system: false,
    listRule: "user_id = @request.auth.id",
    viewRule: "user_id = @request.auth.id",
    createRule: "user_id = @request.auth.id",
    updateRule: "user_id = @request.auth.id",
    deleteRule: "user_id = @request.auth.id",
    fields: [
      // Relations
      {
        system: false,
        id: "rel_session",
        name: "session_id",
        type: "relation",
        required: true,
        presentable: false,
        hidden: false,
        collectionId: sessionsCollection.id,
        cascadeDelete: true,
        maxSelect: 1,
        minSelect: 0
      },
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
      
      // Time-domain metrics
      { system: false, id: "rmssd001", name: "rmssd_session_ms", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "rmssdcv", name: "rmssd_cv_percent", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "sdnn001", name: "sdnn_session_ms", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "pnn50001", name: "pnn50_percent", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "meanhr01", name: "session_mean_hr", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "amode501", name: "amode_50", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "amo50001", name: "AMo50_count", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "rrmax001", name: "rr_max_ms", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "rrmin001", name: "rr_min_ms", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "mxdmn001", name: "mxdmn_ms", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "rmssdst", name: "rmssd_start_ms", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "rmssden", name: "rmssd_end_ms", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "timestab", name: "time_to_stabilize_seconds", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "respcoh", name: "resp_coherence_score", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "restidx", name: "restoration_index", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "stressix", name: "session_stress_index", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "meanrr01", name: "mean_rr_ms", type: "number", required: false, presentable: false, hidden: false },
      
      // Frequency-domain metrics
      { system: false, id: "lfpower", name: "lf_power_ms2", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "hfpower", name: "hf_power_ms2", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "lfhf001", name: "lfhf_ratio", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "totpow01", name: "total_power_ms2", type: "number", required: false, presentable: false, hidden: false },
      
      // Nonlinear metrics
      { system: false, id: "sd100001", name: "sd1_ms", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "sd200001", name: "sd2_ms", type: "number", required: false, presentable: false, hidden: false },
      
      // Baevsky metrics
      { system: false, id: "baevmo01", name: "baevsky_mo", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "baevamo", name: "baevsky_amo", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "baevmxd", name: "baevsky_mxdmn_ms", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "baevstr", name: "baevsky_stress_index", type: "number", required: false, presentable: false, hidden: false },
      
      // 4-Score metrics
      { system: false, id: "energy01", name: "energy_score", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "stress01", name: "stress_score", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "health01", name: "health_score", type: "number", required: false, presentable: false, hidden: false },
      { system: false, id: "focus001", name: "focus_score", type: "number", required: false, presentable: false, hidden: false },
      
      // HRV Score
      { system: false, id: "hrvscore", name: "hrv_score", type: "number", required: false, presentable: false, hidden: false }
    ],
    indexes: []
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("hrv_summary");

  return app.delete(collection);
});
