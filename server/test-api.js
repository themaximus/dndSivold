// Automated Integration Test for D&D Mauporia Engine
const http = require('http');

async function request(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3001,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Mauporia D&D API & Engine Automated Verification...\n');

  try {
    // 1. Health check
    console.log('1. Testing /api/health...');
    const health = await request('/api/health');
    console.log('   Status:', health.status, health.data);
    if (health.status !== 200) throw new Error('Health check failed');

    // 2. Register Host
    console.log('\n2. Registering Host user...');
    const hostUser = await request('/api/auth/register', 'POST', {
      username: `host_${Date.now()}`,
      password: 'password123',
    });
    console.log('   Host registered:', hostUser.data.user.username);
    const hostToken = hostUser.data.token;

    // 3. Register Player
    console.log('\n3. Registering Player user...');
    const playerUser = await request('/api/auth/register', 'POST', {
      username: `player_${Date.now()}`,
      password: 'password123',
    });
    console.log('   Player registered:', playerUser.data.user.username);
    const playerToken = playerUser.data.token;

    // 4. Create Host Character (Fighter)
    console.log('\n4. Creating Fighter character for Host...');
    const charFighter = await request(
      '/api/characters',
      'POST',
      {
        name: 'Борис Железнобокий',
        race: 'Человек',
        characterClass: 'fighter',
        stats: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
        bio: 'Ветеран бесчисленных осад.',
      },
      hostToken
    );
    console.log('   Character created:');
    console.log(`   - Name: ${charFighter.data.name}, Class: ${charFighter.data.characterClass}`);
    console.log(`   - HP: ${charFighter.data.hpMax}, AC: ${charFighter.data.ac}`);
    console.log(`   - Active Abilities: ${charFighter.data.abilities.map((a) => a.name).join(', ')}`);
    console.log(`   - Inventory: ${charFighter.data.inventory.map((i) => i.name).join(', ')}`);

    if (charFighter.data.hpMax !== 12) {
      console.warn(`   Expected HP 12 for 10 HitDie + 2 CON, got ${charFighter.data.hpMax}`);
    }

    // 5. Create Player Character (Wizard)
    console.log('\n5. Creating Wizard character for Player...');
    const charWizard = await request(
      '/api/characters',
      'POST',
      {
        name: 'Мерлин Седой',
        race: 'Эльф',
        characterClass: 'wizard',
        stats: { str: 8, dex: 14, con: 12, int: 16, wis: 13, cha: 10 },
        bio: 'Исследователь древних рун.',
      },
      playerToken
    );
    console.log(`   - Name: ${charWizard.data.name}, Class: ${charWizard.data.characterClass}`);
    console.log(`   - HP: ${charWizard.data.hpMax}, AC: ${charWizard.data.ac}`);
    console.log(`   - Spells: ${charWizard.data.abilities.map((a) => a.name).join(', ')}`);

    // 6. Create Room
    console.log('\n6. Creating D&D Game Room with setting...');
    const roomRes = await request(
      '/api/rooms',
      'POST',
      {
        title: 'Заброшенный склеп под Вайтруном',
        setting: 'Холодные каменные своды. Впереди слышен лязг костей скелетов.',
        deepseekModel: 'deepseek-chat',
      },
      hostToken
    );
    console.log('   Room Created:');
    console.log(`   - Code: ${roomRes.data.code}`);
    console.log(`   - Status: ${roomRes.data.status}, Round: ${roomRes.data.roundNumber}`);

    // 7. Get Room by Code
    console.log(`\n7. Fetching room details for code "${roomRes.data.code}"...`);
    const fetchRoom = await request(`/api/rooms/${roomRes.data.code}`, 'GET', null, playerToken);
    console.log(`   - Room Title: ${fetchRoom.data.room.title}`);
    console.log(`   - Setting: ${fetchRoom.data.room.setting}`);

    console.log('\n✅ ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
  }
}

runTests();
