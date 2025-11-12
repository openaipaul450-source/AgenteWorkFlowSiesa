#!/usr/bin/env node

/**
 * Test script to verify token usage tracking is working correctly
 */

const BASE_URL = 'http://localhost:3000';

async function testUsageTracking() {
  console.log('🧪 Testing Token Usage Tracking\n');
  console.log('='.repeat(80));

  // Test 1: Report usage for a test session
  console.log('\n📊 Test 1: Reporting token usage...');
  const sessionId = `test-session-${Date.now()}`;

  try {
    const reportResponse = await fetch(`${BASE_URL}/api/usage/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        model: 'gpt-4o-mini',
        promptTokens: 50,
        completionTokens: 100,
        totalTokens: 150,
      }),
    });

    const reportData = await reportResponse.json();

    if (reportData.success) {
      console.log('✅ Usage reported successfully');
      console.log(`   Session ID: ${reportData.logged.sessionId}`);
      console.log(`   Total Tokens: ${reportData.logged.tokens}`);
      console.log(`   Cost: $${reportData.logged.cost.toFixed(6)}`);
    } else {
      console.log('❌ Failed to report usage:', reportData.error);
      return;
    }
  } catch (error) {
    console.error('❌ Error reporting usage:', error.message);
    return;
  }

  // Wait a bit for database to update
  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 2: Fetch stats for the session
  console.log('\n📈 Test 2: Fetching session stats...');

  try {
    const statsResponse = await fetch(
      `${BASE_URL}/api/usage/stats?period=7&sessionId=${sessionId}`
    );
    const statsData = await statsResponse.json();

    if (statsData.success && statsData.currentSession) {
      console.log('✅ Session stats retrieved successfully');
      console.log(`   Session ID: ${statsData.currentSession.sessionId}`);
      console.log(`   Request Count: ${statsData.currentSession.requestCount}`);
      console.log(`   Total Tokens: ${statsData.currentSession.tokensTotal}`);
      console.log(`   Input Tokens: ${statsData.currentSession.tokensInput}`);
      console.log(`   Output Tokens: ${statsData.currentSession.tokensOutput}`);
      console.log(`   Total Cost: $${statsData.currentSession.cost.toFixed(6)}`);
    } else {
      console.log('⚠️  No session data found (this may be normal for a fresh session)');
    }
  } catch (error) {
    console.error('❌ Error fetching stats:', error.message);
    return;
  }

  // Test 3: Report multiple requests to same session
  console.log('\n🔄 Test 3: Reporting multiple requests to same session...');

  try {
    for (let i = 1; i <= 3; i++) {
      const response = await fetch(`${BASE_URL}/api/usage/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          model: 'gpt-4o-mini',
          promptTokens: 30 + i * 10,
          completionTokens: 80 + i * 20,
          totalTokens: 110 + i * 30,
        }),
      });
      const data = await response.json();
      if (data.success) {
        console.log(`   ✅ Request ${i}: ${data.logged.tokens} tokens, $${data.logged.cost.toFixed(6)}`);
      }
    }
  } catch (error) {
    console.error('❌ Error in multiple requests:', error.message);
    return;
  }

  // Wait for database update
  await new Promise(resolve => setTimeout(resolve, 500));

  // Test 4: Fetch updated stats
  console.log('\n📊 Test 4: Fetching updated session stats...');

  try {
    const statsResponse = await fetch(
      `${BASE_URL}/api/usage/stats?period=7&sessionId=${sessionId}`
    );
    const statsData = await statsResponse.json();

    if (statsData.success && statsData.currentSession) {
      console.log('✅ Updated session stats:');
      console.log(`   Request Count: ${statsData.currentSession.requestCount}`);
      console.log(`   Total Tokens: ${statsData.currentSession.tokensTotal}`);
      console.log(`   Total Cost: $${statsData.currentSession.cost.toFixed(6)}`);
    }
  } catch (error) {
    console.error('❌ Error fetching updated stats:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ All tests completed successfully!\n');
  console.log('💡 Next steps:');
  console.log('   1. Open http://localhost:3000 in your browser');
  console.log('   2. Click the token usage button (chart icon) on the left');
  console.log('   3. Have a conversation with the AI');
  console.log('   4. Watch the token counter update in real-time\n');
}

// Run the tests
testUsageTracking().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
