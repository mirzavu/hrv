import { Client, Databases, ID, Permission, Role } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the backend's .env file
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env.development') });

const { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY } = process.env;

if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !APPWRITE_API_KEY) {
    console.error("Error: Missing required environment variables in backend/.env.development");
    console.error("Please ensure APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY are set.");
    process.exit(1);
}

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_NAME = 'HRV Data';
const COLLECTION_NAME = 'hrv_sessions';

async function setup() {
    try {
        console.log("🚀 Starting Appwrite setup...");

        // 1. Create Database
        let database;
        try {
            database = await databases.create(ID.unique(), DATABASE_NAME);
            console.log(`✅ Database '${DATABASE_NAME}' created successfully.`);
        } catch (e) {
            if (e.code === 409) { // 409 = Conflict, meaning it already exists
                console.log(`- Database '${DATABASE_NAME}' already exists. Fetching it...`);
                // You'll need to list and find it if you don't know the ID
                const dbList = await databases.list();
                database = dbList.databases.find(db => db.name === DATABASE_NAME);
                if (!database) throw new Error(`Could not find database named ${DATABASE_NAME}`);
            } else {
                throw e;
            }
        }
        const DATABASE_ID = database.$id;

        // 2. Create Collection
        let collection;
        try {
            collection = await databases.createCollection(DATABASE_ID, ID.unique(), COLLECTION_NAME, [
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]);
            console.log(`✅ Collection '${COLLECTION_NAME}' created successfully.`);
        } catch (e) {
            if (e.code === 409) {
                console.log(`- Collection '${COLLECTION_NAME}' already exists.`);
                 const colList = await databases.listCollections(DATABASE_ID);
                collection = colList.collections.find(col => col.name === COLLECTION_NAME);
                if (!collection) throw new Error(`Could not find collection named ${COLLECTION_NAME}`);
            } else {
                throw e;
            }
        }
        const COLLECTION_ID = collection.$id;


        console.log("\n✨ Your IDs are:");
        console.log("------------------------------------");
        console.log(`DATABASE_ID:   '${DATABASE_ID}'`);
        console.log(`COLLECTION_ID: '${COLLECTION_ID}'`);
        console.log("------------------------------------");
        console.log("ACTION: Copy these IDs into hrv-clean/frontend/src/hooks/useHrvSession.js\n");


        // 3. Create Attributes
        console.log("- Checking and creating attributes...");

        const attributes = [
            { key: 'sessionType', type: 'string', required: true, size: 50 },
            { key: 'date', type: 'datetime', required: true },
            { key: 'duration', type: 'float', required: true },
            { key: 'totalBeats', type: 'integer', required: true },
            { key: 'meanHR', type: 'float', required: false },
            { key: 'meanRR', type: 'float', required: false },
            { key: 'rmssd', type: 'float', required: false },
            { key: 'sdnn', type: 'float', required: false },
            { key: 'pnn50', type: 'float', required: false },
            { key: 'mxdmn', type: 'float', required: false },
            { key: 'cv', type: 'float', required: false },
            { key: 'mo', type: 'float', required: false },
            { key: 'amo50', type: 'float', required: false },
            { key: 'user', type: 'string', required: true, size: 50 },
        ];

        for (const attr of attributes) {
            try {
                switch (attr.type) {
                    case 'string':
                        await databases.createStringAttribute(DATABASE_ID, COLLECTION_ID, attr.key, attr.size, attr.required);
                        break;
                    case 'datetime':
                        await databases.createDatetimeAttribute(DATABASE_ID, COLLECTION_ID, attr.key, attr.required);
                        break;
                    case 'float':
                        await databases.createFloatAttribute(DATABASE_ID, COLLECTION_ID, attr.key, attr.required);
                        break;
                    case 'integer':
                        await databases.createIntegerAttribute(DATABASE_ID, COLLECTION_ID, attr.key, attr.required);
                        break;
                }
                console.log(`  ✅ Attribute '${attr.key}' created.`);
            } catch (e) {
                if (e.code === 409) {
                    console.log(`  - Attribute '${attr.key}' already exists. Skipping.`);
                } else {
                    console.error(`  ❌ Failed to create attribute '${attr.key}':`, e.message);
                }
            }
        }
        
        console.log("\n🎉 Appwrite setup complete!");

    } catch (error) {
        console.error("\n❌ An error occurred during setup:", error);
    }
}

setup();
