/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
    const collections = ["user_baselines", "baseline_history"];

    for (const name of collections) {
        try {
            const collection = app.findCollectionByNameOrId(name);

            // Add LF Power Avg
            collection.fields.add(new Field({
                name: "lf_power_avg",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));

            // Add HF Power Avg
            collection.fields.add(new Field({
                name: "hf_power_avg",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));

            // Add LF/HF Avg
            collection.fields.add(new Field({
                name: "lf_hf_avg",
                type: "number",
                required: false,
                presentable: false,
                hidden: false
            }));

            // Add AMo50 Avg
            collection.fields.add(new Field({
                name: "amo50_avg",
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

            collection.fields.removeByName("lf_power_avg");
            collection.fields.removeByName("hf_power_avg");
            collection.fields.removeByName("lf_hf_avg");
            collection.fields.removeByName("amo50_avg");

            app.save(collection);
        } catch (e) {
            console.log(`Error reverting collection ${name}: ` + e);
        }
    }
})
