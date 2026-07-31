const dns = require("dns");
const mongoose = require("mongoose");

function readEnv(name) {
  return String(process.env[name] || "").trim();
}

function parseCommaList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLocalDnsServer(server) {
  const value = String(server || "").trim();
  return value === "127.0.0.1" || value === "::1";
}

function maskMongoUri(uri) {
  if (!uri) return "";
  const value = String(uri);
  const atIndex = value.indexOf("@");
  if (atIndex === -1) return value;
  const protocolIndex = value.indexOf("://");
  if (protocolIndex === -1 || protocolIndex + 3 >= atIndex) return value;
  return `${value.slice(0, protocolIndex + 3)}***:***${value.slice(atIndex)}`;
}

function maskMongoUrisInText(text) {
  if (!text) return "";
  const value = String(text);
  return value.replace(/(mongodb(?:\+srv)?:\/\/)([^@\s/]+)@/gi, "$1***:***@");
}

async function ensureNodeDns() {
  const explicitServers = parseCommaList(process.env.DNS_SERVERS);
  if (explicitServers.length > 0) {
    dns.setServers(explicitServers);
    return;
  }

  const currentServers = dns.getServers();
  const localOnly = currentServers.length > 0 && currentServers.every(isLocalDnsServer);
  if (!localOnly) return;

  try {
    await dns.promises.resolve4("example.com");
    return;
  } catch (_error) {
    // Fall through and apply fallback servers.
  }

  const fallbackServers = parseCommaList(process.env.DNS_FALLBACK_SERVERS);
  const nextServers = fallbackServers.length > 0 ? fallbackServers : ["8.8.8.8", "1.1.1.1"];
  dns.setServers(nextServers);
  console.warn(
    `Node DNS lookup failed using local resolver (${currentServers.join(
      ", "
    )}); switched to ${nextServers.join(", ")}. Set DNS_SERVERS to override.`
  );
}

function getMongoCandidates() {
  const primaryUri = readEnv("MONGO_URI") || readEnv("MONGODB_URI");
  const fallbackUri = readEnv("MONGO_FALLBACK_URI");

  const candidates = [];
  if (primaryUri) candidates.push({ label: "primary", uri: primaryUri });
  if (fallbackUri) candidates.push({ label: "fallback", uri: fallbackUri });

  const seen = new Set();
  return candidates.filter((item) => {
    if (seen.has(item.uri)) return false;
    seen.add(item.uri);
    return true;
  });
}

function isExpectedRollNumberIndex(index) {
  if (!index || !index.unique) return false;
  const condition = index.partialFilterExpression?.rollNumber || null;
  return condition?.$exists === true && String(condition?.$type || "").toLowerCase() === "string";
}

function isNamespaceNotFoundError(error) {
  if (!error) return false;
  if (Number(error.code) === 26) return true;
  const message = String(error.message || "").toLowerCase();
  return message.includes("ns does not exist") || message.includes("namespace not found");
}

async function ensureUserCollectionIndexes() {
  const usersCollection = mongoose.connection.collection("users");
  let indexes = [];
  try {
    indexes = await usersCollection.indexes();
  } catch (error) {
    if (!isNamespaceNotFoundError(error)) {
      throw error;
    }
    indexes = [];
  }
  const rollNumberIndex = indexes.find((item) => item.name === "rollNumber_1");

  if (isExpectedRollNumberIndex(rollNumberIndex)) {
    return;
  }

  // Legacy data may store rollNumber as null; remove it so uniqueness applies only to real IDs.
  await usersCollection.updateMany({ rollNumber: null }, { $unset: { rollNumber: 1 } });

  if (rollNumberIndex) {
    await usersCollection.dropIndex("rollNumber_1");
  }

  await usersCollection.createIndex(
    { rollNumber: 1 },
    {
      name: "rollNumber_1",
      unique: true,
      partialFilterExpression: {
        rollNumber: { $exists: true, $type: "string" }
      }
    }
  );
}

async function connectMongo() {
  await ensureNodeDns();
  const mongoCandidates = getMongoCandidates();
  const timeoutMs = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000);

  if (mongoCandidates.length === 0) {
    throw new Error("MONGO_URI (or MONGODB_URI) is required");
  }

  const failures = [];

  for (const candidate of mongoCandidates) {
    try {
      await mongoose.connect(candidate.uri, {
        serverSelectionTimeoutMS: timeoutMs
      });
      await ensureUserCollectionIndexes();
      return {
        source: candidate.label,
        uri: candidate.uri
      };
    } catch (error) {
      const maskedErrorMessage = maskMongoUrisInText(error?.message);
      failures.push(`${candidate.label} [${maskMongoUri(candidate.uri)}] -> ${maskedErrorMessage}`);
      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.disconnect();
        }
      } catch (_disconnectError) {
        // Ignore disconnect errors while retrying next candidate.
      }
    }
  }

  const failureReason = failures.join(" | ");
  throw new Error(
    `${failureReason}. If using MongoDB Atlas, ensure your deployment's outbound IP is allowed in Network Access.`
  );
}

module.exports = {
  connectMongo
};
