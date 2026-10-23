const http = require('http');
const path = require('path');
const ioClient = require('socket.io-client');
const prisma = require('../src/db');

const TEST_PORT = 5099;
process.env.PORT = TEST_PORT;
process.env.NODE_ENV = 'test';

let baseUrl = `http://localhost:${TEST_PORT}`;

// Helper: Make HTTP request using native fetch
async function request(method, path, body = null, token = null) {
  const url = `${baseUrl}${path}`;
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, body: data };
}

// Simple test assertion helper
const testResults = [];
async function test(name, fn) {
  try {
    await fn();
    testResults.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    testResults.push({ name, passed: false, error: err.message });
    console.error(`  ✗ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function run() {
  console.log('=====================================================');
  console.log('🚀 SITEPULSE FULL-SYSTEM VERIFICATION SUITE');
  console.log('=====================================================\n');

  // Start the server in-process
  console.log('1. Starting Backend & Gateway on port', TEST_PORT);
  require('../src/server');
  
  // Wait a moment for server to listen
  await new Promise(r => setTimeout(r, 1200));

  let testUserToken = null;
  let testUser = null;
  let testSite = null;
  let testConversation = null;
  const testPassword = 'Password123!Secure';
  const testEmail = `test_${Date.now()}@example.com`;

  try {
    console.log('\n--- SUITE A: INFRASTRUCTURE & STATIC ASSETS ---');
    await test('Health check endpoint responds 200 OK', async () => {
      const res = await request('GET', '/api/health');
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'ok', 'Status was not ok');
    });

    await test('Widget script is served statically at /sitepulse.js', async () => {
      const res = await request('GET', '/sitepulse.js');
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(typeof res.body === 'string' && res.body.includes('SitePulse'), 'Script does not contain SitePulse code');
    });

    await test('Dashboard SPA is served statically at /', async () => {
      const res = await request('GET', '/');
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(typeof res.body === 'string' && (res.body.includes('<!DOCTYPE html>') || res.body.includes('SitePulse API and Gateway running')), 'Did not return valid dashboard response');
    });

    console.log('\n--- SUITE B: AUTHENTICATION & ACCESS CONTROL ---');
    await test('Auth status endpoint reports initialized: true (or false)', async () => {
      const res = await request('GET', '/api/v1/auth/status');
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(typeof res.body.initialized === 'boolean', 'initialized property not boolean');
      assert(res.body.serverInstance, 'serverInstance missing');
    });

    await test('Signup: Registers new test user with hashed password and returns JWT', async () => {
      const res = await request('POST', '/api/v1/auth/signup', {
        name: 'Automated Tester',
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword
      });
      assert(res.status === 201, `Expected 201, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert(res.body.token, 'Token not returned');
      assert(res.body.user && res.body.user.email === testEmail.toLowerCase(), 'User email does not match');
      testUserToken = res.body.token;
      testUser = res.body.user;
    });

    await test('Login: Successfully logs in with valid credentials and issues JWT', async () => {
      const res = await request('POST', '/api/v1/auth/login', {
        email: testEmail,
        password: testPassword
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.token, 'Token missing');
      assert(res.body.user && res.body.user.id === testUser.id, 'User mismatch');
    });

    await test('Login: Rejects invalid password with 401 Unauthorized', async () => {
      const res = await request('POST', '/api/v1/auth/login', {
        email: testEmail,
        password: 'WrongPassword999!'
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
      assert(res.body.error, 'Error message expected');
    });

    await test('Protected Route: Profile endpoint /me succeeds with Bearer token', async () => {
      const res = await request('GET', '/api/v1/auth/me', null, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.email === testEmail.toLowerCase(), 'Profile email mismatch');
    });

    await test('Protected Route: Profile endpoint /me rejects unauthenticated request', async () => {
      const res = await request('GET', '/api/v1/auth/me');
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    console.log('\n--- SUITE C: SITE PROPERTY MANAGEMENT ---');
    await test('Create Site: Authenticated admin creates new website property', async () => {
      const res = await request('POST', '/api/v1/sites', {
        name: 'Automated Test Site',
        domain: 'autotest.local'
      }, testUserToken);
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.apiKey, 'API Key was not generated');
      assert(res.body.name === 'Automated Test Site', 'Name mismatch');
      testSite = res.body;
    });

    await test('List Sites: Retrieves active sites for user', async () => {
      const res = await request('GET', '/api/v1/sites', null, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body), 'Sites should be an array');
      const found = res.body.find(s => s.id === testSite.id);
      assert(found, 'Created site not found in user sites list');
    });

    await test('Update Settings: Modifies widget visual and behavioral configurations', async () => {
      const updatedSettings = {
        primaryColor: '#008080',
        title: 'Custom Support Header',
        subtitle: 'Automated test suite active',
        greeting: 'Hello test visitor!',
        position: 'left',
        enableChat: true,
        enableFeedback: true,
        enableBugReport: false,
        requireEmail: true
      };
      const res = await request('PUT', '/api/v1/widget/config', {
        siteKey: testSite.apiKey,
        settings: updatedSettings
      }, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.settings.primaryColor === '#008080', 'Setting was not updated');
      assert(res.body.settings.position === 'left', 'Position was not updated');
    });

    await test('Update Domain & Name: Updates site domain/URL without changing apiKey or losing data', async () => {
      const res = await request('PATCH', `/api/v1/sites/${testSite.id}`, {
        name: 'Renamed Store Property',
        domain: 'newdomain.store.com'
      }, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.site.domain === 'newdomain.store.com', 'Domain update mismatch');
      assert(res.body.site.apiKey === testSite.apiKey, 'API key must remain unchanged');
      testSite = res.body.site;
    });

    console.log('\n--- SUITE D: PUBLIC CLIENT WIDGET ENDPOINTS ---');
    await test('Widget Config: Publicly returns settings for valid siteKey', async () => {
      const res = await request('GET', `/api/v1/widget/config?key=${testSite.apiKey}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.settings && res.body.settings.primaryColor === '#008080', 'Widget config settings mismatch');
    });

    await test('Widget Config: Returns 404 for non-existent siteKey', async () => {
      const res = await request('GET', '/api/v1/widget/config?key=invalid-key-999');
      assert(res.status === 404, `Expected 404, got ${res.status}`);
    });

    console.log('\n--- SUITE E: USER FEEDBACK & BUG REPORTING ---');
    await test('Feedback: Visitor submits rating and comment', async () => {
      const res = await request('POST', '/api/v1/feedback', {
        siteKey: testSite.apiKey,
        rating: 5,
        comment: 'Outstanding support widget, seamless experience!',
        userEmail: 'visitor@feedback.test'
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.feedback && res.body.feedback.rating === 5, 'Feedback rating mismatch');
    });

    await test('Feedback: Admin retrieves site feedback list', async () => {
      const res = await request('GET', `/api/v1/feedback?siteKey=${testSite.apiKey}`, null, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body) && res.body.length >= 1, 'Feedback list empty');
      assert(res.body[0].comment.includes('Outstanding support'), 'Feedback comment content mismatch');
    });

    await test('Bug Report: Visitor submits bug issue with environment diagnostics', async () => {
      const res = await request('POST', '/api/v1/bugs', {
        siteKey: testSite.apiKey,
        title: 'Checkout button unresponsive',
        description: 'Clicking submit checkout did not proceed on mobile safari',
        userEmail: 'reporter@bug.test',
        url: 'https://store.test/checkout',
        browser: 'Safari Mobile 17.2',
        device: 'iPhone 15 Pro'
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      assert(res.body.bug && res.body.bug.title === 'Checkout button unresponsive', 'Bug report mismatch');
    });

    await test('Bug Report: Admin retrieves site bug reports', async () => {
      const res = await request('GET', `/api/v1/bugs?siteKey=${testSite.apiKey}`, null, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body) && res.body.length >= 1, 'Bug reports list empty');
      assert(res.body[0].browser === 'Safari Mobile 17.2', 'Diagnostics browser mismatch');
    });

    console.log('\n--- SUITE F: REAL-TIME CONVERSATION & SOCKET.IO GATEWAY ---');
    await test('Conversation Init: Rejects initialization when email is missing', async () => {
      const res = await request('POST', '/api/v1/conversations/init', {
        siteKey: testSite.apiKey,
        visitorId: 'visitor_session_123',
        visitorEmail: ''
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await test('Conversation Init: Rejects initialization when email format is invalid', async () => {
      const res = await request('POST', '/api/v1/conversations/init', {
        siteKey: testSite.apiKey,
        visitorId: 'visitor_session_123',
        visitorEmail: 'not-an-email'
      });
      assert(res.status === 400, `Expected 400, got ${res.status}`);
    });

    await test('Conversation Init: Initializes visitor conversation session with valid email', async () => {
      const res = await request('POST', '/api/v1/conversations/init', {
        siteKey: testSite.apiKey,
        visitorId: 'visitor_session_123',
        visitorName: 'Alice Customer',
        visitorEmail: 'alice@customer.test',
        externalId: 'cust_9876'
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.id, 'Conversation ID not returned');
      assert(res.body.visitorEmail === 'alice@customer.test', 'Visitor email mismatch');
      testConversation = res.body;
    });

    await test('Socket.IO: End-to-end real-time chat between Visitor and Admin Operator', async () => {
      const adminSocket = ioClient(baseUrl, { transports: ['websocket'] });
      const visitorSocket = ioClient(baseUrl, { transports: ['websocket'] });

      await Promise.all([
        new Promise(resolve => adminSocket.on('connect', resolve)),
        new Promise(resolve => visitorSocket.on('connect', resolve))
      ]);

      // Admin joins site room
      adminSocket.emit('join_site_admin', { siteKey: testSite.apiKey });
      // Both join conversation room
      adminSocket.emit('join_conversation', { conversationId: testConversation.id });
      visitorSocket.emit('join_conversation', { conversationId: testConversation.id });

      // Visitor sends a message
      const messagePromise = new Promise(resolve => {
        adminSocket.on('message_received', (msg) => {
          if (msg.content === 'Hello from visitor over WebSocket!') {
            resolve(msg);
          }
        });
      });

      const notificationPromise = new Promise(resolve => {
        adminSocket.on('new_message_notification', (notif) => {
          if (notif.conversationId === testConversation.id) {
            resolve(notif);
          }
        });
      });

      visitorSocket.emit('send_message', {
        conversationId: testConversation.id,
        siteKey: testSite.apiKey,
        senderType: 'visitor',
        senderName: 'Alice Customer',
        content: 'Hello from visitor over WebSocket!'
      });

      const [receivedMsg, notif] = await Promise.all([messagePromise, notificationPromise]);
      assert(receivedMsg.content === 'Hello from visitor over WebSocket!', 'Message content mismatch');
      assert(notif.conversationId === testConversation.id, 'Notification conversationId mismatch');

      adminSocket.disconnect();
      visitorSocket.disconnect();
    });

    await test('Conversation Messages: Fetch messages via REST verifies message persistence', async () => {
      const res = await request('GET', `/api/v1/conversations/${testConversation.id}/messages`, null, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body) && res.body.length >= 1, 'Messages not found in DB');
      assert(res.body[0].content === 'Hello from visitor over WebSocket!', 'Stored message content mismatch');
    });

    await test('Conversation Status: Operator updates conversation status to resolved', async () => {
      const res = await request('PATCH', `/api/v1/conversations/${testConversation.id}/status`, {
        status: 'resolved'
      }, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.status === 'resolved', 'Status not marked resolved');
    });

    console.log('\n--- SUITE G: PAGE TARGETING & AUTO-DISCOVERY ---');
    await test('Pages Discovery: Retrieves auto-discovered pages for site', async () => {
      const res = await request('GET', `/api/v1/sites/${testSite.apiKey}/pages`, null, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(Array.isArray(res.body.pages), 'Pages list not returned');
      assert(res.body.pages.some(p => p.path === '/'), 'Root path / missing');
    });

    await test('Crawler Scan: Scans site domain and discovers internal links', async () => {
      const res = await request('POST', `/api/v1/sites/${testSite.apiKey}/scan`, null, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(typeof res.body.count === 'number', 'Count not returned in scan response');
    });

    await test('Page Rules Update: Configures path toggles and master widget switch', async () => {
      const pageRulesConfig = {
        enabled: true,
        defaultPolicy: 'allow',
        rules: {
          '/checkout/*': false,
          '/pricing': true
        }
      };
      const res = await request('PUT', '/api/v1/widget/config', {
        siteKey: testSite.apiKey,
        settings: {
          pageRules: pageRulesConfig
        }
      }, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.settings.pageRules.rules['/checkout/*'] === false, 'Page rule toggle mismatch');
    });

    console.log('\n--- SUITE H: PASSWORD-PROTECTED DANGER ZONE DELETIONS ---');
    await test('Delete Chats: Rejects request with incorrect password', async () => {
      const res = await request('DELETE', `/api/v1/sites/${testSite.id}/conversations`, {
        password: 'WrongPassword'
      }, testUserToken);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await test('Delete Chats: Clears all conversations and messages with valid admin password', async () => {
      const res = await request('DELETE', `/api/v1/sites/${testSite.id}/conversations`, {
        password: testPassword
      }, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.success, 'Clear chats did not succeed');

      // Verify conversations count is 0
      const convsRes = await request('GET', `/api/v1/conversations?siteKey=${testSite.apiKey}`, null, testUserToken);
      assert(convsRes.body.length === 0, 'Conversations still exist after clear');
    });

    await test('Delete Site: Rejects deletion with incorrect password', async () => {
      const res = await request('DELETE', `/api/v1/sites/${testSite.id}`, {
        password: 'WrongPassword'
      }, testUserToken);
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    await test('Delete Site: Successfully cascades and permanently removes site property', async () => {
      const res = await request('DELETE', `/api/v1/sites/${testSite.id}`, {
        password: testPassword
      }, testUserToken);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      assert(res.body.success, 'Delete site did not succeed');

      // Verify site no longer in site list
      const sitesRes = await request('GET', '/api/v1/sites', null, testUserToken);
      const stillExists = sitesRes.body.find(s => s.id === testSite.id);
      assert(!stillExists, 'Site still exists after deletion');
      testSite = null;
    });

  } finally {
    // Clean up test user from database
    console.log('\n--- TEARDOWN: CLEANING UP TEST ARTIFACTS ---');
    if (testSite) {
      await prisma.site.deleteMany({ where: { id: testSite.id } }).catch(() => {});
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } }).catch(() => {});
      console.log(`  ✓ Removed temporary test user ${testEmail}`);
    }
  }

  console.log('\n=====================================================');
  const passed = testResults.filter(t => t.passed).length;
  const total = testResults.length;
  console.log(`TEST SUMMARY: ${passed}/${total} PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('=====================================================');

  if (passed !== total) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('FATAL TEST ERROR:', err);
  process.exit(1);
});
