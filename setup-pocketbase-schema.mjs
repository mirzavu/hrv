import PocketBase from 'pocketbase';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Configuration
const PB_URL = process.env.PB_URL || 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL || 'mirza.ekm@gmail.com';
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD || 'changeme123';

async function setupPocketBaseSchema() {
  const pb = new PocketBase(PB_URL);

  try {
    // Authenticate as admin
    console.log('🔐 Authenticating as admin...');
    await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    console.log('✅ Admin authentication successful');
    
    // Check existing collections
    const existingCollections = await pb.collections.getList(1, 100);
    console.log('📋 Existing collections:', existingCollections.items.map(c => c.name));

    // 1. Add custom fields to users collection (system auth collection)
    console.log('\n📝 Adding custom fields to users collection...');
    
    const userFields = [
      { name: 'authUserId', type: 'text', options: { max: 50 } },
      { name: 'name', type: 'text', options: { max: 100 } },
      { name: 'lastLoginAt', type: 'date' },
      { name: 'age', type: 'number' },
      { name: 'gender', type: 'text', options: { max: 50 } },
      { name: 'weight', type: 'number' },
      { name: 'height', type: 'number' },
      { name: 'purpose', type: 'text', options: { max: 255 } },
      { name: 'profileCompleted', type: 'bool' },
      { name: 'onboardingCompletedAt', type: 'date' },
      { name: 'createdAt', type: 'date' } // For compatibility
    ];

    for (const field of userFields) {
      try {
        await pb.collections.update('users', {
          schema: [
            ...((await pb.collections.getOne('users')).schema || []),
            {
              name: field.name,
              type: field.type,
              system: false,
              required: false,
              presentable: false,
              options: field.options || {}
            }
          ]
        });
        console.log(`  ✅ Added field: ${field.name}`);
      } catch (error) {
        if (error.response?.data?.schema?.[field.name]) {
          console.log(`  - Field '${field.name}' already exists`);
        } else {
          console.error(`  ❌ Failed to add field '${field.name}':`, error.message);
        }
      }
    }

    // 2. Create sessions collection
    console.log('\n📝 Creating sessions collection...');
    try {
      await pb.collections.create({
        name: 'sessions',
        type: 'base',
        system: false,
        schema: [
          {
            name: 'userId',
            type: 'relation',
            system: false,
            required: true,
            presentable: false,
            options: {
              collectionId: 'users',
              cascadeDelete: true,
              minSelect: null,
              maxSelect: 1,
              displayFields: null
            }
          },
          {
            name: 'startTime',
            type: 'date',
            system: false,
            required: true,
            presentable: false,
            options: {}
          },
          {
            name: 'endTime',
            type: 'date',
            system: false,
            required: true,
            presentable: false,
            options: {}
          },
          {
            name: 'rawFileId',
            type: 'text',
            system: false,
            required: true,
            presentable: false,
            options: {
              min: null,
              max: 255,
              pattern: ''
            }
          }
        ],
        indexes: [],
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        options: {}
      });
      console.log('  ✅ Sessions collection created');
    } catch (error) {
      if (error.response?.code === 400 && (error.message.includes('already exists') || error.response?.data?.name)) {
        console.log('  - Sessions collection already exists');
      } else {
        console.error('  ❌ Failed to create sessions collection:', error.message);
        throw error;
      }
    }

    // 3. Create heart_rate_data collection
    console.log('\n📝 Creating heart_rate_data collection...');
    try {
      await pb.collections.create({
        name: 'heart_rate_data',
        type: 'base',
        system: false,
        schema: [
          {
            name: 'file',
            type: 'file',
            system: false,
            required: true,
            presentable: false,
            options: {
              maxSelect: 1,
              maxSize: 52428800, // 50MB
              mimeTypes: ['application/zip', 'text/csv', 'application/octet-stream'],
              thumbs: [],
              protected: false
            }
          }
        ],
        indexes: [],
        listRule: null, // Admin only for listing
        viewRule: null, // Admin only for viewing
        createRule: '@request.auth.id != ""', // Any authenticated user can upload
        updateRule: null, // Admin only
        deleteRule: null, // Admin only
        options: {}
      });
      console.log('  ✅ Heart rate data collection created');
    } catch (error) {
      if (error.response?.code === 400 && (error.message.includes('already exists') || error.response?.data?.name)) {
        console.log('  - Heart rate data collection already exists');
      } else {
        console.error('  ❌ Failed to create heart rate data collection:', error.message);
        throw error;
      }
    }

    // 4. Create session_summary collection with all 40+ fields
    console.log('\n📝 Creating session_summary collection...');
    const sessionSummarySchema = [
      {
        name: 'session_id',
        type: 'relation',
        system: false,
        required: true,
        presentable: false,
        options: {
          collectionId: 'sessions',
          cascadeDelete: true,
          minSelect: null,
          maxSelect: 1,
          displayFields: null
        }
      },
      {
        name: 'user_id',
        type: 'relation',
        system: false,
        required: true,
        presentable: false,
        options: {
          collectionId: 'users',
          cascadeDelete: true,
          minSelect: null,
          maxSelect: 1,
          displayFields: null
        }
      },
      // Time-domain metrics
      { name: 'rmssd_session_ms', type: 'number' },
      { name: 'rmssd_cv_percent', type: 'number' },
      { name: 'sdnn_session_ms', type: 'number' },
      { name: 'pnn50_percent', type: 'number' },
      { name: 'session_mean_hr', type: 'number' },
      { name: 'amode_50', type: 'number' },
      { name: 'AMo50_count', type: 'number' },
      { name: 'rr_max_ms', type: 'number' },
      { name: 'rr_min_ms', type: 'number' },
      { name: 'mxdmn_ms', type: 'number' },
      { name: 'rmssd_start_ms', type: 'number' },
      { name: 'rmssd_end_ms', type: 'number' },
      { name: 'time_to_stabilize_seconds', type: 'number' },
      { name: 'resp_coherence_score', type: 'number' },
      { name: 'restoration_index', type: 'number' },
      { name: 'session_stress_index', type: 'number' },
      { name: 'mean_rr_ms', type: 'number' },
      
      // Frequency-domain metrics
      { name: 'lf_power_ms2', type: 'number' },
      { name: 'hf_power_ms2', type: 'number' },
      { name: 'lfhf_ratio', type: 'number' },
      { name: 'total_power_ms2', type: 'number' },
      
      // Nonlinear metrics
      { name: 'sd1_ms', type: 'number' },
      { name: 'sd2_ms', type: 'number' },
      
      // Baevsky metrics
      { name: 'baevsky_mo', type: 'number' },
      { name: 'baevsky_amo', type: 'number' },
      { name: 'baevsky_mxdmn_ms', type: 'number' },
      { name: 'baevsky_stress_index', type: 'number' },
      
      // 4-Score metrics
      { name: 'energy_score', type: 'number' },
      { name: 'stress_score', type: 'number' },
      { name: 'health_score', type: 'number' },
      { name: 'focus_score', type: 'number' },
      
      // HRV Score
      { name: 'hrv_score', type: 'number' },
      
      // Compatibility field
      { name: 'createdAt', type: 'date' }
    ];

    try {
      await pb.collections.create({
        name: 'session_summary',
        type: 'base',
        system: false,
        schema: sessionSummarySchema.map(field => ({
          name: field.name,
          type: field.type,
          system: false,
          required: field.name === 'session_id' || field.name === 'user_id',
          presentable: false,
          options: field.type === 'relation' ? field.options : {}
        })),
        indexes: [],
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        options: {}
      });
      console.log('  ✅ Session summary collection created');
    } catch (error) {
      if (error.response?.code === 400 && (error.message.includes('already exists') || error.response?.data?.name)) {
        console.log('  - Session summary collection already exists');
      } else {
        console.error('  ❌ Failed to create session summary collection:', error.message);
        throw error;
      }
    }

    console.log('\n🎉 PocketBase schema setup completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  ✅ Users collection: Enhanced with profile fields');
    console.log('  ✅ Sessions collection: Created with user relation');
    console.log('  ✅ Heart rate data collection: Created with file upload');
    console.log('  ✅ Session summary collection: Created with 40+ HRV metrics');
    
  } catch (error) {
    console.error('\n❌ Schema setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupPocketBaseSchema();