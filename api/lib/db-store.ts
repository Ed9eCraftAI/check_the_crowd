import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import type { Chain, VoteChoice } from "@/lib/token";
import { hashWalletAddress, normalizeAddress, toConsensusLabel } from "@/lib/token";

type HotTokenQueryRow = {
  chain: Chain;
  address: string;
  createdAt: Date;
  _count: {
    votes: number;
  };
};
type HotTokenComputedRow = {
  chain: Chain;
  address: string;
  createdAt: string;
  voteCount: number;
  isNew: boolean;
};

const VOTE_NONCE_TTL_MS = 5 * 60 * 1000;

export async function issueVoteNonce(walletInput: string) {
  const walletHash = hashWalletAddress(walletInput);
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + VOTE_NONCE_TTL_MS);
  const nonce = randomUUID();

  await prisma.nonce.create({
    data: {
      id: randomUUID(),
      wallet: walletHash,
      nonce,
      issuedAt,
      expiresAt,
    },
  });

  return {
    walletHash,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function consumeVoteNonce(input: {
  nonceId: string;
}) {
  const result = await prisma.nonce.updateMany({
    where: {
      id: input.nonceId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  return result.count === 1;
}

export async function getActiveVoteNonce(input: {
  wallet: string;
  nonce: string;
}) {
  const walletHash = hashWalletAddress(input.wallet);
  const nonceRecord = await prisma.nonce.findUnique({
    where: {
      wallet_nonce: {
        wallet: walletHash,
        nonce: input.nonce,
      },
    },
    select: {
      id: true,
      issuedAt: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!nonceRecord) return null;
  if (nonceRecord.usedAt) return null;
  if (nonceRecord.expiresAt.getTime() <= Date.now()) return null;

  return {
    id: nonceRecord.id,
    issuedAt: nonceRecord.issuedAt.toISOString(),
    expiresAt: nonceRecord.expiresAt.toISOString(),
  };
}

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
      exists: false,
      token: { chain, address },
      consensus: {
        total: 0,
        appearsLegit: 0,
        suspicious: 0,
        unclear: 0,
        label: "unclear" as const,
      },
    };
  }

  const votesRaw = await prisma.vote.findMany({
    where: {
      tokenId: token.id,
    },
    select: {
      choice: true,
    },
  });
  const votes = votesRaw as Array<{ choice: string }>;

  const appearsLegit = votes.filter(
    (vote) => String(vote.choice) === "appears_legit",
  ).length;
  const suspicious = votes.filter(
    (vote) => String(vote.choice) === "suspicious",
  ).length;
  const unclear = votes.filter((vote) => String(vote.choice) === "unclear").length;
  const total = votes.length;

  return {
    exists: true,
    token: { chain, address },
    consensus: {
      total,
      appearsLegit,
      suspicious,
      unclear,
      label: toConsensusLabel(appearsLegit, suspicious, unclear),
    },
  };
}

export async function upsertVote(input: {
  chain: Chain;
  address: string;
  wallet: string;
  choice: VoteChoice;
  signature?: string;
  message?: string;
  verificationMethod?: "signed" | "connected_only";
  nonce?: string;
}) {
  const address = normalizeAddress(input.address);
  const walletHash = hashWalletAddress(input.wallet);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vote = await prisma.$transaction(async (tx: any) => {
    const token = await tx.token.upsert({
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

    const previousVote = await tx.vote.findUnique({
      where: {
        tokenId_voterWallet: {
          tokenId: token.id,
          voterWallet: walletHash,
        },
      },
      select: {
        choice: true,
      },
    });

    const nextVote = await tx.vote.upsert({
      where: {
        tokenId_voterWallet: {
          tokenId: token.id,
          voterWallet: walletHash,
        },
      },
      create: {
        id: randomUUID(),
        tokenId: token.id,
        voterWallet: walletHash,
        choice: input.choice,
        signature: input.signature ?? null,
        message: input.message ?? null,
        verificationMethod: input.verificationMethod ?? "connected_only",
      },
      update: {
        choice: input.choice,
        signature: input.signature ?? null,
        message: input.message ?? null,
        verificationMethod: input.verificationMethod ?? "connected_only",
      },
    });

    await tx.voteHistory.create({
      data: {
        id: randomUUID(),
        tokenId: token.id,
        voterWallet: walletHash,
        previousChoice: previousVote?.choice ?? null,
        newChoice: input.choice,
        signature: input.signature ?? null,
        message: input.message ?? null,
        verificationMethod: input.verificationMethod ?? "connected_only",
        nonce: input.nonce ?? null,
      },
    });

    return nextVote;
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

export async function getWalletVote(input: {
  chain: Chain;
  address: string;
  wallet: string;
}) {
  const address = normalizeAddress(input.address);
  const walletHash = hashWalletAddress(input.wallet);

  const token = await prisma.token.findUnique({
    where: {
      chain_address: {
        chain: input.chain,
        address,
      },
    },
    select: {
      id: true,
    },
  });

  if (!token) {
    return null;
  }

  const vote = await prisma.vote.findUnique({
    where: {
      tokenId_voterWallet: {
        tokenId: token.id,
        voterWallet: walletHash,
      },
    },
    select: {
      choice: true,
      updatedAt: true,
    },
  });

  if (!vote) {
    return null;
  }

  return {
    choice: vote.choice as VoteChoice,
    updatedAt: vote.updatedAt.toISOString(),
  };
}

export async function getWhatsHotTokens(limitInput = 20, pageInput = 1) {
  const limit = Math.min(Math.max(1, limitInput), 20);
  const page = Math.max(1, pageInput);
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

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

  const sorted = (tokens as HotTokenQueryRow[])
    .map((token: HotTokenQueryRow): HotTokenComputedRow => ({
      chain: token.chain,
      address: token.address,
      createdAt: token.createdAt.toISOString(),
      voteCount: token._count.votes,
      isNew: token.createdAt >= since,
    }))
    .sort((a: HotTokenComputedRow, b: HotTokenComputedRow) => {
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
    items: paged.map((token: HotTokenComputedRow) => ({
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
