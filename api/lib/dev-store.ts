import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import type { Chain, VoteChoice } from "@/lib/token";
import { normalizeAddress, toConsensusLabel } from "@/lib/token";

export async function registerToken(chain: Chain, addressInput: string) {
  const address = normalizeAddress(addressInput);

  const token = await prisma.token.upsert({
    where: {
      chain_address: {
        chain,
        address,
      },
    },
    create: {
      id: randomUUID(),
      chain,
      address,
    },
    update: {},
  });

  return {
    chain: token.chain,
    address: token.address,
    createdAt: token.createdAt.toISOString(),
  };
}

export async function getTokenConsensus(chain: Chain, addressInput: string) {
  const address = normalizeAddress(addressInput);

  const token = await prisma.token.findUnique({
    where: {
      chain_address: {
        chain,
        address,
      },
    },
    select: {
      id: true,
    },
  });

  if (!token) {
    return {
      token: { chain, address },
      consensus: {
        total: 0,
        valid: 0,
        risky: 0,
        unknown: 0,
        label: "UNKNOWN" as const,
      },
    };
  }

  const votes = await prisma.vote.findMany({
    where: {
      tokenId: token.id,
    },
    select: {
      choice: true,
    },
  });

  const valid = votes.filter((vote) => vote.choice === "valid").length;
  const risky = votes.filter((vote) => vote.choice === "risky").length;
  const unknown = votes.filter((vote) => vote.choice === "unknown").length;
  const total = votes.length;

  return {
    token: { chain, address },
    consensus: {
      total,
      valid,
      risky,
      unknown,
      label: toConsensusLabel(valid, risky, unknown),
    },
  };
}

export async function upsertVote(input: {
  chain: Chain;
  address: string;
  wallet: string;
  choice: VoteChoice;
  signature: string;
  message: string;
}) {
  const address = normalizeAddress(input.address);
  const wallet = normalizeAddress(input.wallet);

  const token = await prisma.token.upsert({
    where: {
      chain_address: {
        chain: input.chain,
        address,
      },
    },
    create: {
      id: randomUUID(),
      chain: input.chain,
      address,
    },
    update: {},
    select: {
      id: true,
    },
  });

  const vote = await prisma.vote.upsert({
    where: {
      tokenId_voterWallet: {
        tokenId: token.id,
        voterWallet: wallet,
      },
    },
    create: {
      id: randomUUID(),
      tokenId: token.id,
      voterWallet: wallet,
      choice: input.choice,
      signature: input.signature,
      message: input.message,
    },
    update: {
      choice: input.choice,
      signature: input.signature,
      message: input.message,
    },
  });

  return {
    chain: input.chain,
    address,
    voterWallet: vote.voterWallet,
    choice: vote.choice,
    signature: vote.signature,
    message: vote.message,
    createdAt: vote.createdAt.toISOString(),
    updatedAt: vote.updatedAt.toISOString(),
  };
}

export async function getWhatsHotTokens(limitInput = 20, pageInput = 1) {
  const limit = Math.min(Math.max(1, limitInput), 20);
  const page = Math.max(1, pageInput);
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000);

  const tokens = await prisma.token.findMany({
    select: {
      chain: true,
      address: true,
      createdAt: true,
      _count: {
        select: {
          votes: true,
        },
      },
    },
  });

  const sorted = tokens
    .map((token) => ({
      chain: token.chain,
      address: token.address,
      createdAt: token.createdAt.toISOString(),
      voteCount: token._count.votes,
      isNew: token.createdAt >= since,
    }))
    .sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      const addressCompare = a.address.localeCompare(b.address);
      if (addressCompare !== 0) return addressCompare;
      return a.chain.localeCompare(b.chain);
    });

  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const paged = sorted.slice(start, start + limit);

  return {
    items: paged.map((token) => ({
      chain: token.chain,
      address: token.address,
      createdAt: token.createdAt,
      voteCount: token.voteCount,
      badge: token.isNew ? ("NEW" as const) : undefined,
    })),
    page: safePage,
    pageSize: limit,
    totalItems,
    totalPages,
  };
}
