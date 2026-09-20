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
  console.log('🧪 Starting Account & Room Persistence Verification...');

  // 1. Register User A (Host)
  const usernameA = `hero_host_${Date.now()}`;
  const resA = await request('/api/auth/register', 'POST', {
    username: usernameA,
    password: 'securepass123',
  });
  console.log('1. Registered Host:', resA.data.user.username);
  const tokenA = resA.data.token;

  // 2. Register User B (Player)
  const usernameB = `hero_player_${Date.now()}`;
  const resB = await request('/api/auth/register', 'POST', {
    username: usernameB,
    password: 'securepass123',
  });
  console.log('2. Registered Player:', resB.data.user.username);
  const tokenB = resB.data.token;

  // 3. User A creates a character
  const charA = await request('/api/characters', 'POST', {
    name: 'Эльфийский Следопыт',
    race: 'Эльф',
    characterClass: 'ranger',
    stats: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
    bio: 'Опытный следопыт из лесов Сиволда.',
  }, tokenA);
  console.log('3. Host character created:', charA.data.name);

  // 4. User A creates a room
  const roomRes = await request('/api/rooms', 'POST', {
    title: 'Поход в Проклятую Долину',
    setting: 'Густой туман окутывает старинный тракт. Впереди видны руины башни.',
  }, tokenA);
  console.log('4. Room created:', roomRes.data.title, 'Code:', roomRes.data.code);
  const roomCode = roomRes.data.code;

  // 5. User A checks GET /api/rooms/my
  const myRoomsA = await request('/api/rooms/my', 'GET', null, tokenA);
  console.log('5. Host my-rooms count:', myRoomsA.data.length);
  const foundRoomA = myRoomsA.data.find(r => r.code === roomCode);
  if (!foundRoomA) throw new Error('Created room not found in Host my-rooms!');
  if (!foundRoomA.isHost) throw new Error('Room should be marked isHost=true for Host!');
  console.log('   ✓ Room successfully found in Host history with isHost=true');

  // 6. User B checks GET /api/rooms/my before joining
  const myRoomsBBefore = await request('/api/rooms/my', 'GET', null, tokenB);
  const foundRoomBBefore = myRoomsBBefore.data.find(r => r.code === roomCode);
  if (foundRoomBBefore) throw new Error('Room should NOT be in Player B my-rooms before joining!');
  console.log('6. Player B does not see the room before joining (correct)');

  // 7. Player B joins room via HTTP POST /api/rooms/:code/join
  const joinResB = await request(`/api/rooms/${roomCode}/join`, 'POST', {}, tokenB);
  console.log('7. Player B joined room via POST /join:', joinResB.status, !!joinResB.data.room);
  if (joinResB.status !== 200) throw new Error(`Player B join failed: ${JSON.stringify(joinResB.data)}`);

  // 8. Player B checks GET /api/rooms/my after joining
  const myRoomsBAfter = await request('/api/rooms/my', 'GET', null, tokenB);
  const foundRoomBAfter = myRoomsBAfter.data.find(r => r.code === roomCode);
  if (!foundRoomBAfter) throw new Error('Room NOT found in Player B my-rooms after joining!');
  if (foundRoomBAfter.isHost) throw new Error('Room should be isHost=false for Player B!');
  console.log('8. Player B now sees room in my-rooms with playerCount =', foundRoomBAfter.playerCount);

  // 9. Verify 6 players limit over HTTP
  console.log('9. Testing 6 players max limit over HTTP...');
  for (let i = 3; i <= 6; i++) {
    const dummyUser = await request('/api/auth/register', 'POST', {
      username: `player_${i}_${Date.now()}`,
      password: 'password123',
    });
    const dummyJoin = await request(`/api/rooms/${roomCode}/join`, 'POST', {}, dummyUser.data.token);
    if (dummyJoin.status !== 200) throw new Error(`Player ${i} should be able to join: ${JSON.stringify(dummyJoin.data)}`);
  }

  // 7th player should be rejected with status 400
  const extraUser = await request('/api/auth/register', 'POST', {
    username: `player_extra_${Date.now()}`,
    password: 'password123',
  });
  const seventhJoin = await request(`/api/rooms/${roomCode}/join`, 'POST', {}, extraUser.data.token);
  if (seventhJoin.status !== 400 || !seventhJoin.data.error) {
    throw new Error(`7th player should be rejected with 400 error, got: ${seventhJoin.status}`);
  }
  console.log('   ✓ 7th player correctly rejected:', seventhJoin.data.error);

  console.log('\n🎉 ALL ACCOUNT ROOM PERSISTENCE & MULTIPLAYER TESTS PASSED!');
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
