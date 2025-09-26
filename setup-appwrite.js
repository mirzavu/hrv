const { Client, Databases, Storage, ID, Permission, Role } = require('node-appwrite');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from various possible locations
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config();

// Use environment variables with fallbacks
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'http://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'hrv-app';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

if (!APPWRITE_API_KEY) {
    console.error("❌ Error: Missing APPWRITE_API_KEY environment variable");
    console.error("");
    console.error("📋 To fix this, you need to:");
    console.error("1. Make sure your Appwrite server is running");
    console.error("2. Go to your Appwrite console (usually http://localhost/console)");
    console.error("3. Navigate to Settings > API Keys");
    console.error("4. Create a new API key with full permissions");
    console.error("5. Set the APPWRITE_API_KEY environment variable:");
    console.error("");
    console.error("   Option 1: Create a .env.local file in your project root:");
    console.error("   APPWRITE_API_KEY=your_api_key_here");
    console.error("   NEXT_PUBLIC_APPWRITE_ENDPOINT=http://localhost/v1");
    console.error("   NEXT_PUBLIC_APPWRITE_PROJECT_ID=your_project_id");
    console.error("");
    console.error("   Option 2: Set as environment variable:");
    console.error("   export APPWRITE_API_KEY=your_api_key_here");
    console.error("");
    console.error(`📊 Current config:`);
    console.error(`   Endpoint: ${APPWRITE_ENDPOINT}`);
    console.error(`   Project ID: ${APPWRITE_PROJECT_ID}`);
    console.error(`   API Key: ${APPWRITE_API_KEY ? '✅ Set' : '❌ Missing'}`);
    process.exit(1);
}

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

// FIXED IDs to prevent duplicates
const DATABASE_NAME = 'HRV Data';
const DATABASE_ID_FIXED = 'hrv-data-main'; // Fixed ID
const SESSIONS_COLLECTION_ID = 'sessions-collection'; // Fixed ID
const USERS_COLLECTION_ID = 'users-collection'; // Fixed ID
const COLLECTION_NAME = 'sessions';
const USERS_COLLECTION_NAME = 'users';

async function setup() {
    try {
        console.log("🚀 Starting Appwrite setup...");

        // 1. Check if Database exists by ID first, then create if needed
        let database;
        try {
            // Try to get database by fixed ID first
            database = await databases.get(DATABASE_ID_FIXED);
            console.log(`✅ Database '${DATABASE_NAME}' already exists (ID: ${DATABASE_ID_FIXED})`);
        } catch (e) {
            if (e.code === 404) { // Database doesn't exist
                try {
                    database = await databases.create(DATABASE_ID_FIXED, DATABASE_NAME);
                    console.log(`✅ Database '${DATABASE_NAME}' created successfully (ID: ${DATABASE_ID_FIXED})`);
                } catch (createError) {
                    if (createError.code === 409) {
                        // ID conflict, try to find by name
                        console.log(`- Database ID conflict, searching by name...`);
                        const dbList = await databases.list();
                        database = dbList.databases.find(db => db.name === DATABASE_NAME);
                        if (!database) throw new Error(`Could not find database named ${DATABASE_NAME}`);
                        console.log(`✅ Found existing database '${DATABASE_NAME}' (ID: ${database.$id})`);
                    } else {
                        throw createError;
                    }
                }
            } else {
                throw e;
            }
        }
        const DATABASE_ID = database.$id;

        // 2. Create Sessions Collection with fixed ID
        let collection;
        try {
            collection = await databases.getCollection(DATABASE_ID, SESSIONS_COLLECTION_ID);
            console.log(`✅ Sessions collection already exists`);
        } catch (e) {
            if (e.code === 404) {
                collection = await databases.createCollection(DATABASE_ID, SESSIONS_COLLECTION_ID, COLLECTION_NAME, [
                    Permission.read(Role.users()),
                    Permission.create(Role.users()),
                    Permission.update(Role.users()),
                    Permission.delete(Role.users()),
                ]);
                console.log(`✅ Sessions collection created successfully`);
            } else {
                throw e;
            }
        }

        // 3. Create Users Collection with fixed ID
        let usersCollection;
        try {
            usersCollection = await databases.getCollection(DATABASE_ID, USERS_COLLECTION_ID);
            console.log(`✅ Users collection already exists`);
        } catch (e) {
            if (e.code === 404) {
                usersCollection = await databases.createCollection(DATABASE_ID, USERS_COLLECTION_ID, USERS_COLLECTION_NAME, [
                    Permission.read(Role.users()),
                    Permission.create(Role.users()),
                    Permission.update(Role.users()),
                    Permission.delete(Role.users()),
                ]);
                console.log(`✅ Users collection created successfully`);
            } else {
                throw e;
            }
        }

        console.log("\n✨ Your IDs are:");
        console.log("------------------------------------");
        console.log(`DATABASE_ID:            '${DATABASE_ID}'`);
        console.log(`SESSIONS_COLLECTION_ID: '${SESSIONS_COLLECTION_ID}'`);
        console.log(`USERS_COLLECTION_ID:    '${USERS_COLLECTION_ID}'`);
        console.log("------------------------------------");
        console.log("ACTION: Copy these IDs into src/types/index.ts\n");

        // 4. Create Attributes for Users Collection
        console.log("- Checking and creating users collection attributes...");

        const usersAttributes = [
            { key: 'authUserId', type: 'string', required: true, size: 50 },
            { key: 'name', type: 'string', required: false, size: 100 },
            { key: 'email', type: 'string', required: true, size: 255 },
            { key: 'createdAt', type: 'datetime', required: true },
            { key: 'lastLoginAt', type: 'datetime', required: false },
        ];

        for (const attr of usersAttributes) {
            try {
                switch (attr.type) {
                    case 'string':
                        await databases.createStringAttribute(DATABASE_ID, USERS_COLLECTION_ID, attr.key, attr.size, attr.required);
                        break;
                    case 'datetime':
                        await databases.createDatetimeAttribute(DATABASE_ID, USERS_COLLECTION_ID, attr.key, attr.required);
                        break;
                }
                console.log(`  ✅ Users attribute '${attr.key}' created.`);
            } catch (e) {
                if (e.code === 409) {
                    console.log(`  - Users attribute '${attr.key}' already exists. Skipping.`);
                } else {
                    console.error(`  ❌ Failed to create users attribute '${attr.key}':`, e.message);
                }
            }
        }

        // 5. Create Attributes for Sessions Collection
        console.log("- Checking and creating sessions collection attributes...");

        const sessionAttributes = [
            { key: 'userId', type: 'relation', required: true },
            { key: 'startTime', type: 'datetime', required: true },
            { key: 'endTime', type: 'datetime', required: true },
            { key: 'rawFileId', type: 'string', required: true, size: 255 },
        ];

        for (const attr of sessionAttributes) {
            try {
                switch (attr.type) {
                    case 'string':
                        await databases.createStringAttribute(DATABASE_ID, SESSIONS_COLLECTION_ID, attr.key, attr.size, attr.required);
                        break;
                    case 'datetime':
                        await databases.createDatetimeAttribute(DATABASE_ID, SESSIONS_COLLECTION_ID, attr.key, attr.required);
                        break;
                    case 'relation':
                        await databases.createRelationshipAttribute(DATABASE_ID, SESSIONS_COLLECTION_ID, USERS_COLLECTION_ID, 'manyToOne', false, attr.key, null, 'cascade');
                        break;
                }
                console.log(`  ✅ Sessions attribute '${attr.key}' created.`);
            } catch (e) {
                if (e.code === 409) {
                    console.log(`  - Sessions attribute '${attr.key}' already exists. Skipping.`);
                } else {
                    console.error(`  ❌ Failed to create sessions attribute '${attr.key}':`, e.message);
                }
            }
        }

        // 6. Create Storage Bucket for Raw Heart Rate Data
        console.log("- Checking and creating storage bucket for raw heart rate data...");
        
        const BUCKET_ID = 'heart-rate-data';
        const BUCKET_NAME = 'Heart Rate Data';
        
        try {
            await storage.getBucket(BUCKET_ID);
            console.log(`✅ Storage bucket '${BUCKET_NAME}' already exists`);
        } catch (e) {
            if (e.code === 404) {
                await storage.createBucket(
                    BUCKET_ID,
                    BUCKET_NAME,
                    [
                        Permission.read(Role.users()),
                        Permission.create(Role.users()),
                        Permission.update(Role.users()),
                        Permission.delete(Role.users()),
                    ],
                    false, // fileSecurity
                    true,  // enabled
                    undefined, // maximumFileSize (use default)
                    ['json'], // allowedFileExtensions
                    undefined, // compression
                    undefined, // encryption
                    undefined  // antivirus
                );
                console.log(`✅ Storage bucket '${BUCKET_NAME}' created successfully`);
            } else {
                console.error(`❌ Failed to create storage bucket '${BUCKET_NAME}':`, e.message);
            }
        }
        
        console.log("\n🎉 Appwrite setup complete!");
        console.log("\n📝 Next steps:");
        console.log("1. Update your environment variables with the IDs above");
        console.log("2. The storage bucket 'heart-rate-data' is ready for raw data files");
        console.log("3. Sessions will now store raw heart rate data in JSON files");
        console.log("\n🔒 No duplicate databases will be created - using fixed IDs!");

    } catch (error) {
        console.error("\n❌ An error occurred during setup:", error);
    }
}

setup();
