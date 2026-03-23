// backend/__tests__/setup.js
process.env.JWT_SECRET = "test_secret";

const mongoose              = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server"); // ✅ ReplSet not Server

let replSet;

beforeAll(async () => {
  // ✅ Start as replica set — required for transactions
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 }, // 1 node is enough for tests
  });

  const uri = replSet.getUri();
  await mongoose.connect(uri);
  console.log("✅ Test DB connected (replica set)");
}, 30000); // ✅ 30s timeout — replica set takes longer to start

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
  console.log("✅ Test DB disconnected");
});