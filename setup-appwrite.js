/* eslint-disable @typescript-eslint/no-require-imports */
const { Client, Databases, Storage, Permission, Role } = require('node-appwrite');
const dotenv = require('dotenv');

// Load environment variables from various possible locations
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });
dotenv.config();

const REQUIRED_ENV_VARS = [
    'APPWRITE_ENDPOINT',
    'APPWRITE_PROJECT_ID',
    'APPWRITE_API_KEY',
    'APPWRITE_DATABASE_ID',
    'APPWRITE_USERS_COLLECTION_ID',
    'APPWRITE_SESSIONS_COLLECTION_ID'
];

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0) {
    console.error('❌ Error: Missing required environment variables');
    console.error('');
    console.error('The following variables must be set before running this script:');
    missingEnvVars.forEach((key) => console.error(`  - ${key}`));
    console.error('');
    console.error('Set them in your environment or add them to your .env.local file.');
    process.exit(1);
}

const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
const APPWRITE_PROJECT_ID = process.env.APPWRITE_PROJECT_ID;
const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
const DATABASE_ID_TARGET = process.env.APPWRITE_DATABASE_ID;
const SESSIONS_COLLECTION_ID = process.env.APPWRITE_SESSIONS_COLLECTION_ID;
const USERS_COLLECTION_ID = process.env.APPWRITE_USERS_COLLECTION_ID;

const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setKey(APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

// FIXED IDs to prevent duplicates
const DATABASE_NAME = 'HRV Data';
const COLLECTION_NAME = 'sessions';
const USERS_COLLECTION_NAME = 'users';

async function setup() {
    try {
        console.log("🚀 Starting Appwrite setup...");

        // 1. Check if Database exists by ID first, then create if needed
        let database;
        try {
            // Try to get database by configured ID first
            database = await databases.get(DATABASE_ID_TARGET);
            console.log(`✅ Database '${DATABASE_NAME}' already exists (ID: ${DATABASE_ID_TARGET})`);
        } catch (e) {
            if (e.code === 404) { // Database doesn't exist
                try {
                    database = await databases.create(DATABASE_ID_TARGET, DATABASE_NAME);
                    console.log(`✅ Database '${DATABASE_NAME}' created successfully (ID: ${DATABASE_ID_TARGET})`);
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
        try {
            await databases.getCollection(DATABASE_ID, SESSIONS_COLLECTION_ID);
            console.log(`✅ Sessions collection already exists`);
        } catch (e) {
            if (e.code === 404) {
                await databases.createCollection(DATABASE_ID, SESSIONS_COLLECTION_ID, COLLECTION_NAME, [
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
        try {
            await databases.getCollection(DATABASE_ID, USERS_COLLECTION_ID);
            console.log(`✅ Users collection already exists`);
        } catch (e) {
            if (e.code === 404) {
                await databases.createCollection(DATABASE_ID, USERS_COLLECTION_ID, USERS_COLLECTION_NAME, [
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
        if (DATABASE_ID !== DATABASE_ID_TARGET) {
            console.warn(`⚠️  Warning: Database ID in Appwrite ('${DATABASE_ID}') differs from APPWRITE_DATABASE_ID ('${DATABASE_ID_TARGET}'). Update your environment variable to match.`);
        } else {
            console.log("ACTION: Confirm these IDs match your APPWRITE_* and NEXT_PUBLIC_APPWRITE_* environment variables.\n");
        }

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
        
        const desiredExtensions = ['csv', 'gz'];

        try {
            const existingBucket = await storage.getBucket(BUCKET_ID);
            console.log(`✅ Storage bucket '${BUCKET_NAME}' already exists`);

            const allowedExtensions = existingBucket.allowedFileExtensions ?? [];
            const needsExtensionUpdate =
                desiredExtensions.some((ext) => !allowedExtensions.includes(ext)) ||
                allowedExtensions.some((ext) => !desiredExtensions.includes(ext));

            if (needsExtensionUpdate) {
                await storage.updateBucket(
                    BUCKET_ID,
                    existingBucket.name,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    desiredExtensions
                );
                console.log(`  🔄 Updated allowed extensions to: ${desiredExtensions.join(', ')}`);
            } else {
                console.log('  - Allowed extensions already include csv/gz.');
            }
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
                    desiredExtensions, // allowedFileExtensions
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
    console.log("3. Sessions will now store raw heart rate data as gzipped CSV files");
        console.log("\n🔒 No duplicate databases will be created - using fixed IDs!");

    } catch (error) {
        console.error("\n❌ An error occurred during setup:", error);
    }
}

setup();
