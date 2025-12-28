/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const collections = ["user_baselines", "baseline_history"];

    for (const name of collections) {
        try {
            const collection = app.findCollectionByNameOrId(name);

            // Energy Score
            collection.fields.add(new Field({
                name: "energy_score_avg",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));
            collection.fields.add(new Field({
                name: "energy_score_stdev",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));

            // Stress Score
            collection.fields.add(new Field({
                name: "stress_score_avg",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));
            collection.fields.add(new Field({
                name: "stress_score_stdev",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));

            // Health Score
            collection.fields.add(new Field({
                name: "health_score_avg",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));
            collection.fields.add(new Field({
                name: "health_score_stdev",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));

            // Focus Score
            collection.fields.add(new Field({
                name: "focus_score_avg",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));
            collection.fields.add(new Field({
                name: "focus_score_stdev",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));

            // HRV Score
            collection.fields.add(new Field({
                name: "hrv_score_avg",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));
            collection.fields.add(new Field({
                name: "hrv_score_stdev",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));

            app.save(collection);
        } catch (e) {
            console.log(`Error updating collection ${name}: ` + e);
        }
    }
}, (app) => {
    const collections = ["user_baselines", "baseline_history"];

    for (const name of collections) {
        try {
            const collection = app.findCollectionByNameOrId(name);

            collection.fields.removeByName("energy_score_avg");
            collection.fields.removeByName("energy_score_stdev");
            collection.fields.removeByName("stress_score_avg");
            collection.fields.removeByName("stress_score_stdev");
            collection.fields.removeByName("health_score_avg");
            collection.fields.removeByName("health_score_stdev");
            collection.fields.removeByName("focus_score_avg");
            collection.fields.removeByName("focus_score_stdev");
            collection.fields.removeByName("hrv_score_avg");
            collection.fields.removeByName("hrv_score_stdev");

            app.save(collection);
        } catch (e) {
            console.log(`Error reverting collection ${name}: ` + e);
        }
    }
})
