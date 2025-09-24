# Appwrite Database Migrations

This directory contains database migration scripts for the HRV application's Appwrite backend.

## Migration Naming Convention

Migration files should follow this naming pattern:
```
XXX_description.js
```

Where:
- `XXX` is a 3-digit number (001, 002, 003, etc.)
- `description` is a brief description of what the migration does
- Files are executed in numerical order

## Examples

- `001_initial_setup.js` - Creates initial database, collections, and basic attributes
- `002_user_profile_fields.js` - Adds user profile fields for onboarding
- `003_add_session_notes.js` - Adds notes field to HRV sessions

## Running Migrations

### Run all migrations:
```bash
cd appwrite/migrations
node run-migrations.js
```

### Run from project root:
```bash
npm run migrate
```

## Creating New Migrations

1. Create a new file with the next sequential number
2. Follow the existing pattern for database connection and error handling
3. Include proper logging for success/failure states
4. Test the migration on a development database first

## Migration Structure

Each migration should:
- Import required Appwrite SDK modules
- Load environment variables from `backend/.env.development`
- Set up the Appwrite client with proper credentials
- Include error handling for existing resources (409 conflicts)
- Log progress and results clearly
- Export or call the main migration function

## Environment Variables

Migrations use the same environment variables as the main application:
- `APPWRITE_ENDPOINT` - Appwrite server endpoint
- `APPWRITE_PROJECT_ID` - Project ID
- `APPWRITE_API_KEY` - API key with database permissions

## Best Practices

1. **Idempotent**: Migrations should be safe to run multiple times
2. **Atomic**: Each migration should be a single logical unit
3. **Backwards Compatible**: Avoid breaking changes when possible
4. **Documented**: Include comments explaining complex operations
5. **Tested**: Test migrations on development data first

## Troubleshooting

- **Permission Errors**: Ensure your API key has the necessary database permissions
- **Connection Issues**: Verify `APPWRITE_ENDPOINT` and network connectivity
- **Existing Resources**: Migrations handle 409 conflicts gracefully by skipping existing items
- **Failed Migrations**: Check logs for specific error messages and fix before re-running
