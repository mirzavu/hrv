const { Client, Databases, Storage, ID, Permission, Role } = require('node-appwrite');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from the backend's .env file
dotenv.config({ path: path.resolve(process.cwd(), '..', '..', 'backend', '.env.development') });

// Use default values if environment variables are not set
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'http://localhost/v1';
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID || 'hrv-app';
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;

if (!APPWRITE_API_KEY) {
    console.error("Error: Missing APPWRITE_API_KEY environment variable");
    console.error("Please set APPWRITE_API_KEY in backend/.env.development or as an environment variable");
    console.error("You can get the API key from the Appwrite console at http://localhost/console");
    console.error("Go to Settings > API Keys and create a new API key");
    process.exit(1);
}

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

        const DATABASE_NAME = 'HRV Data';
        const COLLECTION_NAME = 'sessions';
        const USERS_COLLECTION_NAME = 'users';

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

        // 2.5. Create Users Collection (if it doesn't exist)
        let usersCollection;
        try {
            usersCollection = await databases.createCollection(DATABASE_ID, ID.unique(), USERS_COLLECTION_NAME, [
                Permission.read(Role.users()),
                Permission.create(Role.users()),
                Permission.update(Role.users()),
                Permission.delete(Role.users()),
            ]);
            console.log(`✅ Users collection '${USERS_COLLECTION_NAME}' created successfully.`);
        } catch (e) {
            if (e.code === 409) {
                console.log(`- Users collection '${USERS_COLLECTION_NAME}' already exists.`);
                const colList = await databases.listCollections(DATABASE_ID);
                usersCollection = colList.collections.find(col => col.name === USERS_COLLECTION_NAME);
                if (!usersCollection) throw new Error(`Could not find users collection named ${USERS_COLLECTION_NAME}`);
            } else {
                throw e;
            }
        }
        const USERS_COLLECTION_ID = usersCollection.$id;

        console.log("\n✨ Your IDs are:");
        console.log("------------------------------------");
        console.log(`DATABASE_ID:   '${DATABASE_ID}'`);
        console.log(`COLLECTION_ID: '${COLLECTION_ID}'`);
        console.log("------------------------------------");
        console.log("ACTION: Copy these IDs into hrv-clean/frontend/src/hooks/useHrvSession.js\n");


        // 3. Create Attributes for Users Collection
        console.log("- Checking and creating users collection attributes...");

        const usersAttributes = [
            { key: 'authUserId', type: 'string', required: true, size: 50 }, // Link to Appwrite auth user ID
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

        // 4. Create Attributes for Sessions Collection
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
                    case 'relation':
                        // Create a relation to the users collection
                        await databases.createRelationshipAttribute(DATABASE_ID, COLLECTION_ID, USERS_COLLECTION_ID, 'manyToOne', false, attr.key, null, 'cascade');
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

        // 5. Create Storage Bucket for Raw Heart Rate Data
        console.log("- Checking and creating storage bucket for raw heart rate data...");
        
        const BUCKET_ID = 'heart-rate-data';
        const BUCKET_NAME = 'Heart Rate Data';
        
        try {
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
            console.log(`✅ Storage bucket '${BUCKET_NAME}' created successfully.`);
        } catch (e) {
            if (e.code === 409) {
                console.log(`- Storage bucket '${BUCKET_NAME}' already exists. Skipping.`);
            } else {
                console.error(`❌ Failed to create storage bucket '${BUCKET_NAME}':`, e.message);
            }
        }
        
        console.log("\n🎉 Appwrite setup complete!");
        console.log("\n📝 Next steps:");
        console.log("1. Update your environment variables with the IDs above");
        console.log("2. The storage bucket 'heart-rate-data' is ready for raw data files");
        console.log("3. Sessions will now store raw heart rate data in JSON files");

    } catch (error) {
        console.error("\n❌ An error occurred during setup:", error);
    }
}

setup();
