const PocketBase = require('pocketbase').default || require('pocketbase');

async function testAdminAuth() {
  const pb = new PocketBase('http://127.0.0.1:8091');
  
  try {
    console.log('Testing admin authentication...');
    const authData = await pb.admins.authWithPassword('mirza.ekm@gmail.com', 'changeme123');
    console.log('✅ Admin authentication successful!');
    console.log('\nAdmin Details:');
    console.log('  ID:', authData.record.id);
    console.log('  Email:', authData.record.email);
    console.log('  Verified:', authData.record.verified);
    console.log('  Created:', authData.record.created);
    console.log('\nAuth Store:');
    console.log('  Token valid:', pb.authStore.isValid);
    console.log('  Token:', authData.token.substring(0, 50) + '...');
    return true;
  } catch (error) {
    console.log('❌ Admin authentication failed!');
    console.log('Error:', error.message);
    if (error.response) {
      console.log('Response:', JSON.stringify(error.response, null, 2));
    }
    return false;
  }
}

testAdminAuth();


