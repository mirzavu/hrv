require('dotenv').config({ path: '.env.local' });

/**
 * Test script for AI Insight API
 * Tests both analysis and rewording modes with demo data
 */

const API_URL = 'http://localhost:3001/api/ai-insight';

// Demo data for analysis mode (calibration phase)
// Updated to use actual comparison context strings
const analysisPayload = {
  mode: 'analysis',
  data: {
    metricData: {
      rmssd: { value: 45, change: 12 },
      sdnn: { value: 55, change: 8 },
      lf: { value: 120, change: -5 },
      hf: { value: 180, change: 15 },
      amo50: { value: 25 }
    },
    context: {
      timeContext: "Compared to your state roughly 1 day ago", // Example: extracted from relativeInterpretation
      phaseContext: "calibration phase"
    }
  }
};

// Demo data for rewording mode (established baseline)
const rewordingPayload = {
  mode: 'rewording',
  data: {
    existingInterpretation: {
      title: "HRV Changes vs Baseline",
      physiologicalState: "Optimal (Ready)",
      recommendedAction: "Maximize performance: This is an ideal day for peak physical performance.",
      combinedAdvice: "Proceed with confidence. Ensure high-quality fuel (complex carbs, lean protein) pre-activity. Hydrate optimally."
    }
  }
};

async function testAPI(payload, modeName) {
  console.log(`\n🧪 Testing ${modeName} mode...`);
  console.log('📤 Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log(`\n📥 Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.error('❌ Error Response:', responseText);
      return;
    }

    const data = JSON.parse(responseText);
    console.log('✅ Success Response:');
    console.log(JSON.stringify(data, null, 2));
    
    // Validate response structure
    if (data.title && data.interpretation) {
      console.log('\n✅ Response structure is valid!');
      console.log(`   Title: "${data.title}"`);
      console.log(`   Interpretation: "${data.interpretation}"`);
    } else {
      console.log('\n⚠️  Response structure is missing required fields');
    }
    
  } catch (error) {
    console.error(`\n❌ Error testing ${modeName} mode:`, error.message);
    console.error('Stack:', error.stack);
  }
}

async function main() {
  console.log('🚀 Starting AI Insight API Test');
  console.log('=' .repeat(50));
  
  // Check if API key is set
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    console.log('   Make sure .env.local exists and contains GEMINI_API_KEY');
    process.exit(1);
  }
  
  console.log('✅ GEMINI_API_KEY found');
  console.log(`   Key preview: ${process.env.GEMINI_API_KEY.substring(0, 10)}...`);
  
  // Test analysis mode
  await testAPI(analysisPayload, 'Analysis');
  
  // Wait a bit between requests
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test rewording mode
  await testAPI(rewordingPayload, 'Rewording');
  
  console.log('\n' + '='.repeat(50));
  console.log('✨ Test completed!');
}

main().catch(console.error);

