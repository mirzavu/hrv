import { Client, Databases } from 'node-appwrite';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the backend's .env file
dotenv.config({ path: path.resolve(process.cwd(), '..', '..', 'backend', '.env.development') });

// Use default values if environment variables are not set
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'http://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || 'hrv-app';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

if (!APPWRITE_API_KEY) {
    console.error("Error: Missing APPWRITE_API_KEY environment variable");
    console.error("Please set APPWRITE_API_KEY in backend/.env.development or as an environment variable");
    process.exit(1);
}

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);

const DATABASE_NAME = 'HRV Data';
const USERS_COLLECTION_NAME = 'users';

async function addUserProfileFields() {
    try {
        console.log("🔧 Adding user profile fields to users collection...");

        // Find existing database (should exist from previous migration)
        console.log(`🔍 Looking for existing database '${DATABASE_NAME}'...`);
        const dbList = await databases.list();
        const database = dbList.databases.find(db => db.name === DATABASE_NAME);
        if (!database) {
            throw new Error(`Could not find database named '${DATABASE_NAME}'. Please run 001_initial_setup.js first.`);
        }
        console.log(`✅ Found database '${DATABASE_NAME}' (ID: ${database.$id})`);
        const DATABASE_ID = database.$id;

        // Get users collection ID by name
        const colList = await databases.listCollections(DATABASE_ID);
        const usersCollection = colList.collections.find(col => col.name === USERS_COLLECTION_NAME);
        if (!usersCollection) {
            throw new Error(`Could not find users collection named ${USERS_COLLECTION_NAME}`);
        }
        const USERS_COLLECTION_ID = usersCollection.$id;

        // Define new user profile attributes
        const newAttributes = [
            { key: 'age', type: 'integer', required: false },
            { key: 'gender', type: 'string', required: false, size: 20 },
            { key: 'weight', type: 'float', required: false }, // in kg
            { key: 'height', type: 'float', required: false }, // in cm
            { key: 'purpose', type: 'string', required: false, size: 50 }, // fitness, medical, research
            { key: 'profileCompleted', type: 'boolean', required: false, default: false },
            { key: 'onboardingCompletedAt', type: 'datetime', required: false },
        ];

        // Create each attribute
        for (const attr of newAttributes) {
            try {
                switch (attr.type) {
                    case 'string':
                        await databases.createStringAttribute(DATABASE_ID, USERS_COLLECTION_ID, attr.key, attr.size, attr.required, attr.default);
                        break;
                    case 'integer':
                        await databases.createIntegerAttribute(DATABASE_ID, USERS_COLLECTION_ID, attr.key, attr.required, null, null, attr.default);
                        break;
                    case 'float':
                        await databases.createFloatAttribute(DATABASE_ID, USERS_COLLECTION_ID, attr.key, attr.required, null, null, attr.default);
                        break;
                    case 'boolean':
                        await databases.createBooleanAttribute(DATABASE_ID, USERS_COLLECTION_ID, attr.key, attr.required, attr.default);
                        break;
                    case 'datetime':
                        await databases.createDatetimeAttribute(DATABASE_ID, USERS_COLLECTION_ID, attr.key, attr.required, attr.default);
                        break;
                }
                console.log(`  ✅ User profile attribute '${attr.key}' created.`);
            } catch (e) {
                if (e.code === 409) {
                    console.log(`  - User profile attribute '${attr.key}' already exists. Skipping.`);
                } else {
                    console.error(`  ❌ Failed to create user profile attribute '${attr.key}':`, e.message);
                    throw e;
                }
            }
        }

        console.log("✅ User profile fields migration completed successfully!");

    } catch (error) {
        console.error("❌ User profile fields migration failed:", error);
        throw error;
    }
}

addUserProfileFields();
