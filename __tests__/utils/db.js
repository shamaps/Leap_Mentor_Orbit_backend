const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod;

/**
 * Initializes an in-memory MongoDB instance and connects Mongoose.
 */
const connect = async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
};

/**
 * Disconnects Mongoose and stops the in-memory MongoDB instance.
 */
const close = async () => {
    if (mongoose.connection.db) {
        await mongoose.connection.dropDatabase();
    }
    await mongoose.connection.close();
    if (mongod) {
        await mongod.stop();
    }
};

/**
 * Clears all data collections between individual test executions.
 */
const clear = async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
};

module.exports = { connect, close, clear };