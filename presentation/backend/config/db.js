const mongoose = require("mongoose");
const { connectMongo } = require("./mongo");

async function testConnection() {
  await connectMongo();
  await mongoose.connection.db.admin().ping();
}

async function query() {
  throw new Error("SQL query helper is not available in Mongo mode");
}

module.exports = {
  testConnection,
  query
};
