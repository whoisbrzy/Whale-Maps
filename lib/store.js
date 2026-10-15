/* User storage in MongoDB Atlas (collection "users", _id = Discord user ID).
 *
 *   { _id, username, name, avatar, createdAt, updatedAt, lastLoginAt,
 *     roblox?: { id, name, verifiedAt, via: "dock" } }
 *
 * Without MONGODB_URI every function is a no-op and returns null: the site still works,
 * the Roblox link then lives only in the login cookie. */
import { MONGODB_DB, MONGODB_URI } from "./config.js";

let collPromise = null;

function collection() {
  if (!MONGODB_URI && !collPromise) return Promise.resolve(null);
  if (!collPromise) {
    collPromise = (async () => {
      const { MongoClient } = await import("mongodb"); // loaded only when a database is configured
      const client = new MongoClient(MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const col = client.db(MONGODB_DB).collection("users");
      // One Roblox account can be linked to one Waylo account.
      await col.createIndex({ "roblox.id": 1 }, { unique: true, sparse: true });
      return col;
    })().catch((err) => {
      collPromise = null; // retry on the next request
      throw err;
    });
  }
  return collPromise;
}

/* Tests only: inject a fake collection. */
export function useCollection(col) {
  collPromise = Promise.resolve(col);
}

/* Save the Discord profile on login and return the stored user (with any Roblox link), or null. */
export async function upsertProfile({ id, username, name, avatar, email, guilds }) {
  const col = await collection();
  if (!col) return null;
  const now = new Date();
  const setFields = { username, name, avatar, lastLoginAt: now, updatedAt: now };
  if (email !== undefined) setFields.email = email;
  if (Array.isArray(guilds)) setFields.guilds = guilds;
  return col.findOneAndUpdate(
    { _id: id },
    {
      $set: setFields,
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" }
  );
}

const userGuildsCache = new Map();

export function setCachedGuilds(discordId, guilds) {
  if (discordId && Array.isArray(guilds)) {
    userGuildsCache.set(String(discordId), guilds);
  }
}

export async function getGuilds(discordId) {
  const cached = userGuildsCache.get(String(discordId));
  if (cached && cached.length > 0) return cached;

  const col = await collection();
  if (col) {
    try {
      const u = await col.findOne({ _id: String(discordId) });
      if (u?.guilds && u.guilds.length > 0) {
        userGuildsCache.set(String(discordId), u.guilds);
        return u.guilds;
      }
    } catch (err) {
      console.error("Failed to read user guilds from MongoDB:", err.message);
    }
  }
  return cached || [];
}

/* Throws Error("ROBLOX_TAKEN") if that Roblox account is already linked to someone else. */
export async function setRoblox(discordId, roblox) {
  const col = await collection();
  if (!col) return;
  try {
    await col.updateOne({ _id: discordId }, { $set: { roblox, updatedAt: new Date() } }, { upsert: true });
  } catch (err) {
    if (err && err.code === 11000) throw new Error("ROBLOX_TAKEN");
    throw err;
  }
}

export async function clearRoblox(discordId) {
  const col = await collection();
  if (!col) return;
  await col.updateOne({ _id: discordId }, { $unset: { roblox: "" }, $set: { updatedAt: new Date() } });
}

/* ---- Server Storage (collection "servers") ---- */
let serversCollPromise = null;

async function serversCollection() {
  if (!MONGODB_URI && !serversCollPromise) return null;
  if (!serversCollPromise) {
    serversCollPromise = (async () => {
      const { MongoClient } = await import("mongodb");
      const client = new MongoClient(MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const col = client.db(MONGODB_DB).collection("servers");
      await col.createIndex({ ownerId: 1 });
      await col.createIndex({ members: 1 });
      await col.createIndex({ joinCode: 1 }, { unique: true, sparse: true });
      return col;
    })().catch((err) => {
      serversCollPromise = null;
      throw err;
    });
  }
  return serversCollPromise;
}

/* In-memory store merged with MongoDB to guarantee servers always persist */
const localServers = new Map();

export async function getServersForUser(discordId) {
  const col = await serversCollection();
  let dbList = [];
  if (col) {
    try {
      dbList = await col.find({ $or: [{ ownerId: discordId }, { members: discordId }] }).toArray();
    } catch (err) {
      console.error("Failed to load servers from MongoDB:", err.message);
    }
  }

  const memoryList = Array.from(localServers.values()).filter(
    (s) => s.ownerId === discordId || s.members?.includes(discordId)
  );

  const seen = new Set();
  const result = [];
  for (const s of [...memoryList, ...dbList]) {
    const id = String(s._id || s.id);
    if (!seen.has(id)) {
      seen.add(id);
      result.push({
        id,
        name: s.name,
        banner: s.banner || "",
        icon: s.icon || s.discordServerIcon || "",
        discordServerId: s.discordServerId || "",
        discordServerName: s.discordServerName || "",
        players: s.players || 0,
        role: s.ownerId === discordId ? "owner" : "member",
        hasBanner: Boolean(s.banner),
      });
    }
  }
  return result;
}

export async function createServer({
  name,
  banner = "",
  icon = "",
  ownerId,
  erlcApiKey = "",
  discordServerId = "",
  discordServerName = "",
}) {
  const id = `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const joinCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const doc = {
    _id: id,
    id,
    name,
    banner,
    icon,
    ownerId,
    joinCode,
    erlcApiKey,
    discordServerId,
    discordServerName,
    members: [ownerId],
    players: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // 1. Save in memory
  localServers.set(id, doc);

  // 2. Save in MongoDB
  const col = await serversCollection();
  if (col) {
    try {
      await col.insertOne(doc);
    } catch (err) {
      console.error("Failed to persist server in MongoDB:", err.message);
    }
  }

  return {
    id,
    name,
    banner,
    icon,
    discordServerId,
    discordServerName,
    role: "owner",
    players: 0,
    joinCode,
  };
}
