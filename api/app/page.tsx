"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { env } from "@/lib/env";
import Image from "next/image";

type Chain = "eth" | "bsc";
type VoteChoice = "valid" | "risky" | "unknown";
type Consensus = {
  total: number;
  valid: number;
  risky: number;
  unknown: number;
  label: "VALID" | "RISKY" | "UNKNOWN";
};
type HotItem = {
  chain: Chain;
  address: string;
  createdAt: string;
  voteCount: number;
  badge?: "NEW";
};

const EMPTY_CONSENSUS: Consensus = {
  total: 0,
  valid: 0,
  risky: 0,
  unknown: 0,
  label: "UNKNOWN",
};

const CHAIN_ID_BY_KEY: Record<Chain, number> = {
  eth: 1,
  bsc: 56,
};

const CHAIN_ICON_BY_KEY: Record<Chain, string> = {
  eth: "/chains/eth.svg",
  bsc: "/chains/bsc.svg",
};

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function clearWalletConnectStorage() {
  if (typeof window === "undefined") return;

  const removeByPattern = (storage: Storage, key: string) =>
    key.startsWith("wc@2") ||
    key.startsWith("walletconnect") ||
    key.includes("walletconnect");

  for (const key of Object.keys(window.localStorage)) {
    if (removeByPattern(window.localStorage, key)) {
      window.localStorage.removeItem(key);
    }
  }

  for (const key of Object.keys(window.sessionStorage)) {
    if (removeByPattern(window.sessionStorage, key)) {
      window.sessionStorage.removeItem(key);
    }
  }
}

export default function Home() {
  const [chain, setChain] = useState<Chain>("eth");
  const [tokenAddress, setTokenAddress] = useState("");
  const [consensus, setConsensus] = useState<Consensus>(EMPTY_CONSENSUS);
  const [isWorking, setIsWorking] = useState(false);
  const [hotItems, setHotItems] = useState<HotItem[]>([]);
  const [hotPage, setHotPage] = useState(1);
  const [hotTotalPages, setHotTotalPages] = useState(1);
  const [activeHotKey, setActiveHotKey] = useState<string | null>(null);
  const [loadingHotKey, setLoadingHotKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const { address: connectedWallet, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const normalizedAddress = useMemo(
    () => tokenAddress.trim().toLowerCase(),
    [tokenAddress],
  );
  const projectId = env("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");

  useEffect(() => {
    setConsensus(EMPTY_CONSENSUS);
  }, [chain, normalizedAddress]);

  useEffect(() => {
    console.log("[page.tsx] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", {
      exists: Boolean(projectId),
      length: projectId?.length ?? 0,
      preview: projectId ? `${projectId.slice(0, 4)}...` : null,
    });
  }, [projectId]);

  const loadWhatsHot = useCallback(async (pageInput: number) => {
    try {
      const res = await fetch(`/api/tokens/hot?limit=20&page=${pageInput}`);
      const data = (await res.json()) as {
        items?: HotItem[];
        page?: number;
        totalPages?: number;
      };
      if (!res.ok) throw new Error("Failed to load What's Hot");
      setHotItems(data.items ?? []);
      setHotPage(data.page ?? pageInput);
      setHotTotalPages(Math.max(1, data.totalPages ?? 1));
    } catch {
      setHotItems([]);
      setHotPage(1);
      setHotTotalPages(1);
    }
  }, []);

  useEffect(() => {
    void loadWhatsHot(1);
  }, [loadWhatsHot]);

  async function connectWallet() {
    setIsWorking(true);
    setStatus("Connecting wallet...");
    const targetChainId = CHAIN_ID_BY_KEY[chain];
    try {
      console.log("[page.tsx] connectors before connect", {
        projectIdExists: Boolean(projectId),
        connectors: connectors.map((connector) => ({
          id: connector.id,
          name: connector.name,
          type: connector.type,
        })),
      });

      const walletConnectConnector = connectors.find(
        (connector) =>
          connector.id === "walletConnect" ||
          connector.name.toLowerCase().includes("walletconnect"),
      );

      const connectWithFallback = async (
        connector: (typeof connectors)[number],
      ) => {
        try {
          return await connectAsync({ connector, chainId: targetChainId });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const isChainSwitchIssue =
            message.includes("Chain not configured") ||
            message.includes("attempting to switch chain");

          if (!isChainSwitchIssue) throw error;
          return await connectAsync({ connector });
        }
      };

      const injectedConnector = connectors.find((connector) => connector.id === "injected");
      if (injectedConnector) {
        const result = await connectWithFallback(injectedConnector);
        setStatus(`Injected wallet connected: ${shortAddress(result.accounts[0])}`);
        return;
      }

      if (projectId && walletConnectConnector) {
        const result = await connectWithFallback(walletConnectConnector);
        setStatus(`WalletConnect connected: ${shortAddress(result.accounts[0])}`);
        return;
      }

      throw new Error(
        "No compatible connector found. Install wallet extension or set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet connection failed.";
      setStatus(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function registerToken() {
    setIsWorking(true);
    setStatus("Registering token...");
    try {
      const res = await fetch("/api/tokens/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          address: normalizedAddress,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Register failed");
      setStatus("Token registered.");
      await loadWhatsHot();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Register failed.";
      setStatus(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function checkToken() {
    setIsWorking(true);
    setStatus("Loading consensus...");
    try {
      const res = await fetch(`/api/tokens/${chain}/${normalizedAddress}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check failed");
      setConsensus(data.consensus as Consensus);
      setStatus("Consensus updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check failed.";
      setConsensus(EMPTY_CONSENSUS);
      setStatus(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function selectHotTokenAndCheck(nextChain: Chain, nextAddress: string) {
    const hotKey = `${nextChain}:${nextAddress}`;
    setActiveHotKey(hotKey);
    setLoadingHotKey(hotKey);
    setChain(nextChain);
    setTokenAddress(nextAddress);
    setIsWorking(true);
    setStatus(`Loading consensus for ${nextChain.toUpperCase()} ${shortAddress(nextAddress)}...`);
    try {
      const res = await fetch(`/api/tokens/${nextChain}/${nextAddress}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Check failed");
      setConsensus(data.consensus as Consensus);
      setStatus("Consensus updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check failed.";
      setConsensus(EMPTY_CONSENSUS);
      setStatus(message);
    } finally {
      setLoadingHotKey(null);
      setIsWorking(false);
    }
  }

  async function vote(choice: VoteChoice) {
    if (!connectedWallet) {
      setStatus("Connect wallet first.");
      return;
    }

    setIsWorking(true);
    setStatus(`Signing ${choice} vote...`);
    try {
      const nonce = crypto.randomUUID();
      const issuedAt = new Date().toISOString();
      const message =
        "ValidToken Vote\n\n" +
        `Token: ${chain}:${normalizedAddress}\n` +
        `Choice: ${choice}\n` +
        `Wallet: ${connectedWallet.toLowerCase()}\n` +
        `Nonce: ${nonce}\n` +
        `IssuedAt: ${issuedAt}`;

      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          address: normalizedAddress,
          wallet: connectedWallet.toLowerCase(),
          choice,
          nonce,
          issuedAt,
          signature,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Vote failed");

      setStatus(`Vote submitted: ${choice}`);
      await loadWhatsHot();
      await checkToken();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vote failed.";
      setStatus(message);
    } finally {
      setIsWorking(false);
    }
  }

  const voteTotal = Math.max(consensus.total, 1);
  const voteRows = [
    {
      key: "valid" as const,
      label: "VALID",
      count: consensus.valid,
      barClass: "bg-emerald-500",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      key: "risky" as const,
      label: "RISKY",
      count: consensus.risky,
      barClass: "bg-rose-500",
      buttonClass: "bg-rose-600 hover:bg-rose-700",
    },
    {
      key: "unknown" as const,
      label: "UNKNOWN",
      count: consensus.unknown,
      barClass: "bg-sky-600",
      buttonClass: "bg-sky-700 hover:bg-sky-800",
    },
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7efe2_0%,#f0f4f8_55%,#e6efff_100%)] px-4 py-10 text-zinc-900">
      <main className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-8">
        <section className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Check The Crowd</h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={connectWallet}
              disabled={isWorking || isPending}
              className="rounded-xl bg-amber-600 px-4 py-2 text-white disabled:opacity-50"
            >
              Connect Wallet (QR)
            </button>
            {isConnected && (
              <button
                onClick={() => {
                  disconnect();
                  clearWalletConnectStorage();
                  setStatus("Wallet disconnected.");
                }}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-zinc-800"
              >
                Disconnect
              </button>
            )}
            <span className="text-sm text-zinc-700">
              {connectedWallet
                ? `Wallet: ${shortAddress(connectedWallet)}`
                : "Wallet not connected"}
            </span>
          </div>
        </section>
        <p className="mt-2 text-sm text-zinc-600">
          Community consensus only. Not financial advice.
        </p>
        <p className="mt-2 min-h-5 text-sm text-zinc-700">{status}</p>

        <section className="mt-6 grid gap-3 sm:grid-cols-[120px_1fr_auto_auto]">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-2">
            <Image
              src={CHAIN_ICON_BY_KEY[chain]}
              alt={chain}
              width={24}
              height={24}
              className="h-6 w-6 rounded-full"
            />
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value as Chain)}
              className="w-full bg-transparent py-2 outline-none"
            >
              <option value="eth">eth</option>
              <option value="bsc">bsc</option>
            </select>
          </div>
          <input
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="0x..."
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2"
          />
          <button
            onClick={registerToken}
            disabled={isWorking}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-white disabled:opacity-50"
          >
            Register
          </button>
          <button
            onClick={checkToken}
            disabled={isWorking}
            aria-label="Check"
            title="Check"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 disabled:opacity-50"
          >
            <Image src="/icons/enter.svg" alt="Check" width={18} height={18} />
          </button>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-end">
            <button
              onClick={() => {
                void loadWhatsHot(hotPage);
              }}
              disabled={isWorking}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
          {hotItems.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No recent tokens in the last 72 hours.
            </p>
          ) : (
            <ul className="space-y-2">
              {hotItems.map((item) => (
                (() => {
                  const hotKey = `${item.chain}:${item.address}`;
                  const isActive = activeHotKey === hotKey;
                  const isLoading = loadingHotKey === hotKey;

                  return (
                <li key={hotKey}>
                  <button
                    onClick={() => {
                      void selectHotTokenAndCheck(item.chain, item.address);
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-all active:scale-[0.99] ${
                      isActive
                        ? "border-sky-300 bg-sky-50 ring-1 ring-sky-200"
                        : "border-zinc-200 bg-zinc-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
                          <Image
                            src={CHAIN_ICON_BY_KEY[item.chain]}
                            alt={item.chain}
                            width={20}
                            height={20}
                            className="h-5 w-5 rounded-full"
                          />
                          <span>
                            {item.chain.toUpperCase()} {shortAddress(item.address)}
                          </span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          Votes {item.voteCount} · {new Date(item.createdAt).toLocaleString()}
                        </div>
                      </div>
                      {(isLoading || item.badge) && (
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                            isLoading ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          {isLoading ? "Loading..." : item.badge}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
                  );
                })()
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => {
                void loadWhatsHot(Math.max(1, hotPage - 1));
              }}
              disabled={isWorking || hotPage <= 1}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-xs text-zinc-600">
              Page {hotPage} / {hotTotalPages}
            </span>
            <button
              onClick={() => {
                void loadWhatsHot(Math.min(hotTotalPages, hotPage + 1));
              }}
              disabled={isWorking || hotPage >= hotTotalPages}
              className="rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2">
            <div className="text-xs font-semibold tracking-wide text-zinc-500">VOTING TOKEN</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <Image
                src={CHAIN_ICON_BY_KEY[chain]}
                alt={chain}
                width={20}
                height={20}
                className="h-5 w-5 rounded-full"
              />
              <span>
                {chain.toUpperCase()} {normalizedAddress ? shortAddress(normalizedAddress) : "No token selected"}
              </span>
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {normalizedAddress || "Enter or select a token address to vote."}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="font-semibold text-zinc-800">Consensus</div>
            <div className="text-zinc-600">
              Total {consensus.total} · Label <span className="font-semibold">{consensus.label}</span>
            </div>
          </div>

          <div className="mt-3 space-y-3">
            {voteRows.map((row) => {
              const percent = Math.round((row.count / voteTotal) * 100);

              return (
                <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-700">
                      <span>{row.label}</span>
                      <span>
                        {row.count} ({percent}%)
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className={`h-full rounded-full transition-all ${row.barClass}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => vote(row.key)}
                    disabled={isWorking}
                    className={`h-11 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${row.buttonClass}`}
                  >
                    Vote
                  </button>
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
