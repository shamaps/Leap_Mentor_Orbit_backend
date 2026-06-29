const config = {
  mongodb: {
    url: process.env.MONGO_URI,
    databaseName: process.env.DB_NAME || "leapmentor",
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: "commonjs",
};

module.exports = config;
