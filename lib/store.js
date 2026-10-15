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
export async function upsertProfile({ id, username, name, avatar }) {
  const col = await collection();
  if (!col) return null;
  const now = new Date();
  return col.findOneAndUpdate(
    { _id: id },
    {
      $set: { username, name, avatar, lastLoginAt: now, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" }
  );
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

const DEFAULT_SERVERS = [
  {
    id: "sydney-rp",
    name: "Sydney Roleplay",
    banner: "/hero/slide-1.jpg",
    players: 0,
    uniqueWeekly: 7,
    role: "owner",
    sparkline: [2, 4, 3, 5, 4, 6, 7],
    hasBanner: true,
  },
  {
    id: "tennessee-rp",
    name: "Tennessee State Roleplay",
    banner: "",
    players: 0,
    uniqueWeekly: 14,
    role: "owner",
    sparkline: [5, 8, 7, 10, 9, 12, 14],
    hasBanner: false,
  },
  {
    id: "georgia-rp",
    name: "Georgia State Roleplay",
    banner: "",
    players: 0,
    uniqueWeekly: 9,
    role: "owner",
    sparkline: [3, 4, 6, 5, 8, 7, 9],
    hasBanner: false,
  },
];

export async function getServersForUser(discordId) {
  const col = await serversCollection();
  if (!col) return DEFAULT_SERVERS;
  try {
    const list = await col.find({ $or: [{ ownerId: discordId }, { members: discordId }] }).toArray();
    if (!list.length) return DEFAULT_SERVERS;
    return list.map((s) => ({
      id: String(s._id),
      name: s.name,
      banner: s.banner || "",
      players: s.players || 0,
      uniqueWeekly: s.uniqueWeekly || 0,
      role: s.ownerId === discordId ? "owner" : "member",
      sparkline: s.sparkline || [1, 2, 3, 2, 4, 3, 5],
      hasBanner: Boolean(s.banner),
    }));
  } catch (err) {
    console.error("Failed to load servers from MongoDB:", err.message);
    return DEFAULT_SERVERS;
  }
}

export async function createServer({ name, banner = "", ownerId, erlcApiKey = "" }) {
  const col = await serversCollection();
  const id = `srv-${Date.now().toString(36)}`;
  const joinCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const doc = {
    _id: id,
    name,
    banner,
    ownerId,
    joinCode,
    erlcApiKey,
    members: [ownerId],
    players: 0,
    uniqueWeekly: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  if (col) {
    await col.insertOne(doc);
  }
  return { id, name, banner, role: "owner", players: 0, uniqueWeekly: 1, joinCode };
}
