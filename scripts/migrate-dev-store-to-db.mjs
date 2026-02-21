#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = process.cwd();
const STORE_PATH = resolve(ROOT, "pros-b-next/data/dev-store.json");

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlTimestamp(value, fallbackIso) {
  const iso = value ? new Date(value).toISOString() : fallbackIso;
  return `${sqlString(iso)}::timestamptz`;
}

function tokenStableId(chain, address) {
  const digest = createHash("sha256")
    .update(`${chain}:${address}`)
    .digest("hex")
    .slice(0, 24);
  return `mig_${digest}`;
}

function voteStableId(chain, address, voterWallet) {
  const digest = createHash("sha256")
    .update(`${chain}:${address}:${voterWallet}`)
    .digest("hex")
    .slice(0, 24);
  return `miv_${digest}`;
}

function loadStore() {
  const raw = readFileSync(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw);

  return {
    tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
    votes: Array.isArray(parsed.votes) ? parsed.votes : [],
  };
}

function buildSql(store) {
  const now = new Date().toISOString();
  const chunks = [];

  chunks.push("BEGIN;");

  for (const token of store.tokens) {
    if (!token?.chain || !token?.address) continue;

    const chain = String(token.chain).toLowerCase();
    const address = String(token.address).toLowerCase();
    const id = tokenStableId(chain, address);
    const createdAt = sqlTimestamp(token.createdAt, now);

    chunks.push(`
INSERT INTO "Token" ("id", "chain", "address", "createdAt")
VALUES (${sqlString(id)}, ${sqlString(chain)}::"Chain", ${sqlString(address)}, ${createdAt})
ON CONFLICT ("chain", "address")
DO UPDATE SET "createdAt" = LEAST("Token"."createdAt", EXCLUDED."createdAt");`.trim());
  }

  for (const vote of store.votes) {
    if (!vote?.chain || !vote?.address || !vote?.voterWallet || !vote?.choice) continue;

    const chain = String(vote.chain).toLowerCase();
    const address = String(vote.address).toLowerCase();
    const voterWallet = String(vote.voterWallet).toLowerCase();
    const id = voteStableId(chain, address, voterWallet);
    const choice = String(vote.choice).toLowerCase();
    const signature = String(vote.signature ?? "");
    const message = String(vote.message ?? "");
    const createdAt = sqlTimestamp(vote.createdAt, now);
    const updatedAt = sqlTimestamp(vote.updatedAt, now);

    chunks.push(`
INSERT INTO "Vote" ("id", "tokenId", "voterWallet", "choice", "signature", "message", "createdAt", "updatedAt")
SELECT ${sqlString(id)}, t."id", ${sqlString(voterWallet)}, ${sqlString(choice)}::"VoteChoice", ${sqlString(signature)}, ${sqlString(message)}, ${createdAt}, ${updatedAt}
FROM "Token" t
WHERE t."chain" = ${sqlString(chain)}::"Chain"
  AND t."address" = ${sqlString(address)}
ON CONFLICT ("tokenId", "voterWallet")
DO UPDATE SET
  "choice" = EXCLUDED."choice",
  "signature" = EXCLUDED."signature",
  "message" = EXCLUDED."message",
  "updatedAt" = EXCLUDED."updatedAt";`.trim());
  }

  chunks.push("COMMIT;");

  return chunks.join("\n\n");
}

function main() {
  let store;

  try {
    store = loadStore();
  } catch (error) {
    console.error("Failed to read dev-store.json:", error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const sql = buildSql(store);

  if (!sql.includes("INSERT INTO")) {
    console.log("No rows to migrate (tokens/votes are empty).");
    return;
  }

  const result = spawnSync("npx", ["prisma", "db", "execute", "--stdin"], {
    cwd: ROOT,
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(
    `Migration complete: tokens=${store.tokens.length}, votes=${store.votes.length}`,
  );
}

main();
