"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSignMessage } from "wagmi";
import { env } from "@/lib/env";
import Image from "next/image";
import { buildAuthSigningMessage } from "@/lib/auth-message";
import type { VoteChoice } from "@/lib/token";

type Chain = "eth" | "bsc" | "sol";
type Consensus = {
  total: number;
  appearsLegit: number;
  suspicious: number;
  unclear: number;
  label: VoteChoice;
};
type HotItem = {
  chain: Chain;
  address: string;
  createdAt: string;
  voteCount: number;
  badge?: "NEW";
};
type TokenMetadata = {
  symbol: string;
  name: string;
};

const EMPTY_CONSENSUS: Consensus = {
  total: 0,
  appearsLegit: 0,
  suspicious: 0,
  unclear: 0,
  label: "unclear",
};

const CHAIN_ICON_BY_KEY: Record<Chain, string> = {
  eth: "/chains/eth.svg",
  bsc: "/chains/bsc.svg",
  sol: "/chains/sol.svg",
};

function isAddressValidForChain(chain: Chain, value: string): boolean {
  if (chain === "sol") {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  }
  return /^0x[a-f0-9]{40}$/i.test(value);
}

const VOTE_UI: Record<
  VoteChoice,
  {
    label: string;
    icon: string;
    emoji: string;
  }
> = {
  appears_legit: {
    label: "Appears Legit",
    icon: "/icons/vote-appears-legit.svg",
    emoji: "🟢",
  },
  suspicious: {
    label: "Suspicious",
    icon: "/icons/vote-suspicious.svg",
    emoji: "🟠",
  },
  unclear: {
    label: "Unclear",
    icon: "/icons/vote-unclear.svg",
    emoji: "⚪",
  },
};

const WALLET_CONNECTED_AT_KEY = "check_the_crowd.wallet_connected_at";
const WALLET_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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
  const setStatus: (message: string) => void = () => {};
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false);
  const [isConnectVoteModalOpen, setIsConnectVoteModalOpen] = useState(false);
  const [isRegisterSuggestionModalOpen, setIsRegisterSuggestionModalOpen] = useState(false);
  const [isChangeVoteModalOpen, setIsChangeVoteModalOpen] = useState(false);
  const [connectErrorMessage, setConnectErrorMessage] = useState<string | null>(null);
  const [voteErrorMessage, setVoteErrorMessage] = useState<string | null>(null);
  const [checkErrorMessage, setCheckErrorMessage] = useState<string | null>(null);
  const [isAddressInputFocused, setIsAddressInputFocused] = useState(false);
  const [pendingVoteChoice, setPendingVoteChoice] = useState<VoteChoice | null>(null);
  const [existingVoteChoice, setExistingVoteChoice] = useState<VoteChoice | null>(null);
  const [isCopiedToastVisible, setIsCopiedToastVisible] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [tokenMetadata, setTokenMetadata] = useState<TokenMetadata | null>(null);
  const walletMenuRef = useRef<HTMLDivElement | null>(null);
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { address: connectedWallet, isConnected } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const normalizedAddress = useMemo(
    () => tokenAddress.trim(),
    [tokenAddress],
  );
  const projectId = env("CHECK_THE_CROWD_WALLETCONNECT_PROJECT_ID");
  const xAccount = env("CHECK_THE_CROWD_X_ACCOUNT");
  const xProfileUrl = useMemo(() => {
    if (!xAccount) return null;
    const normalized = xAccount.trim().replace(/^@/, "");
    if (!normalized) return null;
    return `https://x.com/${normalized}`;
  }, [xAccount]);

  const hasAuthSession = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/session", { method: "GET" });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const ensureAuthSession = useCallback(
    async (walletInput: string) => {
      const wallet = walletInput.toLowerCase();
      if (await hasAuthSession()) return;

      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const nonceData = (await nonceRes.json()) as {
        nonce?: string;
        issuedAt?: string;
        expiresAt?: string;
        error?: string;
      };
      if (!nonceRes.ok) {
        throw new Error(nonceData.error ?? "Failed to issue auth nonce.");
      }

      const nonce = String(nonceData.nonce ?? "");
      const issuedAt = String(nonceData.issuedAt ?? "");
      const expiresAt = String(nonceData.expiresAt ?? "");
      if (!nonce || !issuedAt || !expiresAt) {
        throw new Error("Nonce response is invalid.");
      }

      const message = buildAuthSigningMessage({
        domain: window.location.host,
        wallet,
        nonce,
        issuedAt,
        expiresAt,
      });
      const signature = await signMessageAsync({ message });

      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, signature, message, nonce }),
      });
      const verifyData = (await verifyRes.json()) as { error?: string };
      if (!verifyRes.ok) {
        throw new Error(verifyData.error ?? "Wallet sign-in failed.");
      }
    },
    [hasAuthSession, signMessageAsync],
  );

  useEffect(() => {
    setConsensus(EMPTY_CONSENSUS);
    setLastUpdatedAt(null);
    setIsRegisterSuggestionModalOpen(false);
    setTokenMetadata(null);
  }, [chain, normalizedAddress]);

  useEffect(() => {
    if (!isConnected) {
      setIsWalletMenuOpen(false);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(WALLET_CONNECTED_AT_KEY);
      }
      return;
    }

    if (typeof window !== "undefined") {
      const now = Date.now();
      const saved = window.localStorage.getItem(WALLET_CONNECTED_AT_KEY);
      const connectedAt = saved ? Number(saved) : NaN;

      if (!Number.isFinite(connectedAt)) {
        window.localStorage.setItem(WALLET_CONNECTED_AT_KEY, String(now));
      } else if (now - connectedAt >= WALLET_SESSION_TTL_MS) {
        disconnect();
        void fetch("/api/auth/session", { method: "DELETE" });
        clearWalletConnectStorage();
        window.localStorage.removeItem(WALLET_CONNECTED_AT_KEY);
        setIsWalletMenuOpen(false);
        setConnectErrorMessage("Wallet session expired after 24 hours. Please reconnect.");
        return;
      }
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!walletMenuRef.current) return;
      if (!walletMenuRef.current.contains(event.target as Node)) {
        setIsWalletMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    const intervalId = window.setInterval(() => {
      const saved = window.localStorage.getItem(WALLET_CONNECTED_AT_KEY);
      const connectedAt = saved ? Number(saved) : NaN;
      if (!Number.isFinite(connectedAt)) return;
      if (Date.now() - connectedAt >= WALLET_SESSION_TTL_MS) {
        disconnect();
        void fetch("/api/auth/session", { method: "DELETE" });
        clearWalletConnectStorage();
        window.localStorage.removeItem(WALLET_CONNECTED_AT_KEY);
        setIsWalletMenuOpen(false);
        setConnectErrorMessage("Wallet session expired after 24 hours. Please reconnect.");
      }
    }, 60_000);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.clearInterval(intervalId);
    };
  }, [isConnected, disconnect]);

  const loadWhatsHot = useCallback(async (pageInput = 1) => {
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
    try {
      const hasInjectedProvider =
        typeof window !== "undefined" &&
        typeof (window as Window & { ethereum?: unknown }).ethereum !== "undefined";
      const noWalletDetectedMessage =
        "No wallet detected.\nPlease install MetaMask or open this page in a wallet browser.";

      const walletConnectConnector = connectors.find(
        (connector) =>
          connector.id === "walletConnect" ||
          connector.name.toLowerCase().includes("walletconnect"),
      );
      if (!hasInjectedProvider && !projectId && !walletConnectConnector) {
        throw new Error(noWalletDetectedMessage);
      }

      const injectedConnector = connectors.find((connector) => connector.id === "injected");
      if (injectedConnector) {
        try {
          const result = await connectAsync({ connector: injectedConnector });
          await ensureAuthSession(result.accounts[0]);
          setStatus(`Injected wallet connected: ${shortAddress(result.accounts[0])}`);
          return;
        } catch {
          // If injected wallet is unavailable, try WalletConnect next.
        }
      }

      if (projectId && walletConnectConnector) {
        const result = await connectAsync({ connector: walletConnectConnector });
        await ensureAuthSession(result.accounts[0]);
        setStatus(`WalletConnect connected: ${shortAddress(result.accounts[0])}`);
        return;
      }

      throw new Error(noWalletDetectedMessage);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Wallet connection failed.";
      const message = rawMessage.includes('@walletconnect/ethereum-provider')
        ? "No wallet detected.\nPlease install MetaMask or open this page in a wallet browser."
        : rawMessage;
      disconnect();
      void fetch("/api/auth/session", { method: "DELETE" });
      clearWalletConnectStorage();
      setStatus(message);
      setConnectErrorMessage(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function checkToken() {
    if (!normalizedAddress) {
      setCheckErrorMessage("Enter token address first.");
      return;
    }

    if (!isAddressValidForChain(chain, normalizedAddress)) {
      setCheckErrorMessage("Invalid token address format for selected chain.");
      return;
    }

    setIsWorking(true);
    setStatus("Loading consensus...");
    try {
      const res = await fetch(`/api/tokens/${chain}/${normalizedAddress}`);
      const data = (await res.json()) as {
        exists?: boolean;
        consensus: Consensus;
        metadata?: TokenMetadata | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Check failed");
      setConsensus(data.consensus);
      setTokenMetadata(data.metadata ?? null);
      setLastUpdatedAt(new Date());
      if (data.exists === false) {
        setIsRegisterSuggestionModalOpen(true);
      }
      setStatus("Consensus updated.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Check failed.";
      setConsensus(EMPTY_CONSENSUS);
      setStatus(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function registerCurrentToken() {
    if (!connectedWallet) {
      setIsRegisterSuggestionModalOpen(false);
      setIsConnectVoteModalOpen(true);
      return;
    }

    setIsWorking(true);
    try {
      const res = await fetch("/api/tokens/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          address: normalizedAddress,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Register failed");

      setIsRegisterSuggestionModalOpen(false);
      await loadWhatsHot();
      await checkToken();
    } catch {
      setIsRegisterSuggestionModalOpen(false);
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
      setTokenMetadata((data.metadata as TokenMetadata | null | undefined) ?? null);
      setLastUpdatedAt(new Date());
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

  useEffect(() => {
    if (!isAddressValidForChain(chain, normalizedAddress)) return;

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/tokens/${chain}/${normalizedAddress}`);
          const data = await res.json();
          if (!res.ok) return;
          setConsensus(data.consensus as Consensus);
          setTokenMetadata((data.metadata as TokenMetadata | null | undefined) ?? null);
          setLastUpdatedAt(new Date());
        } catch {
          // Ignore polling failures and keep last successful state.
        }
      })();
    }, 120000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [chain, normalizedAddress]);

  const getExistingVoteChoice = useCallback(async (): Promise<VoteChoice | null> => {
    if (!connectedWallet || !normalizedAddress) return null;

    const res = await fetch(
      `/api/votes?chain=${chain}&address=${normalizedAddress}&wallet=${connectedWallet.toLowerCase()}`,
    );
    const data = (await res.json()) as {
      vote?: {
        choice?: VoteChoice;
      } | null;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to load existing vote.");
    }

    return data.vote?.choice ?? null;
  }, [chain, connectedWallet, normalizedAddress]);

  useEffect(() => {
    if (!connectedWallet || !normalizedAddress) {
      setExistingVoteChoice(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const choice = await getExistingVoteChoice();
        if (!cancelled) {
          setExistingVoteChoice(choice);
        }
      } catch {
        if (!cancelled) {
          setExistingVoteChoice(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connectedWallet, normalizedAddress, getExistingVoteChoice]);

  async function submitVote(choice: VoteChoice) {
    if (!connectedWallet) {
      setVoteErrorMessage("Connect wallet first.");
      return;
    }

    setIsWorking(true);
    setStatus(`Submitting ${choice} vote...`);
    try {
      await ensureAuthSession(connectedWallet);

      let res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          address: normalizedAddress,
          choice,
        }),
      });
      let data = (await res.json()) as { error?: string };

      if (res.status === 401) {
        await ensureAuthSession(connectedWallet);
        res = await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chain,
            address: normalizedAddress,
            choice,
          }),
        });
        data = (await res.json()) as { error?: string };
      }

      if (!res.ok) throw new Error(data.error ?? "Vote failed");

      setStatus(`Vote submitted: ${VOTE_UI[choice].label}`);
      await loadWhatsHot();
      await checkToken();
      setExistingVoteChoice(choice);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vote failed.";
      setVoteErrorMessage(message);
    } finally {
      setIsWorking(false);
    }
  }

  async function copyTokenAddress() {
    if (!normalizedAddress) return;

    await navigator.clipboard.writeText(normalizedAddress);
    setIsCopiedToastVisible(true);

    if (copyToastTimerRef.current) {
      clearTimeout(copyToastTimerRef.current);
    }
    copyToastTimerRef.current = setTimeout(() => {
      setIsCopiedToastVisible(false);
    }, 1500);
  }

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        clearTimeout(copyToastTimerRef.current);
      }
    };
  }, []);

  async function vote(choice: VoteChoice) {
    if (!connectedWallet) {
      setIsConnectVoteModalOpen(true);
      return;
    }

    if (!normalizedAddress) {
      setVoteErrorMessage("Enter token address first.");
      return;
    }

    try {
      const existingChoice = await getExistingVoteChoice();
      if (existingChoice && existingChoice !== choice) {
        setPendingVoteChoice(choice);
        setIsChangeVoteModalOpen(true);
        return;
      }
    } catch {
      // Ignore lookup failures and proceed with vote flow.
    }

    await submitVote(choice);
  }

  const voteTotal = Math.max(consensus.total, 1);
  const voteRows = [
    {
      key: "appears_legit" as const,
      label: VOTE_UI.appears_legit.label,
      icon: VOTE_UI.appears_legit.icon,
      count: consensus.appearsLegit,
      barClass: "bg-emerald-500",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      key: "suspicious" as const,
      label: VOTE_UI.suspicious.label,
      icon: VOTE_UI.suspicious.icon,
      count: consensus.suspicious,
      barClass: "bg-orange-500",
      buttonClass: "bg-orange-600 hover:bg-orange-700",
    },
    {
      key: "unclear" as const,
      label: VOTE_UI.unclear.label,
      icon: VOTE_UI.unclear.icon,
      count: consensus.unclear,
      barClass: "bg-zinc-500",
      buttonClass: "bg-zinc-600 hover:bg-zinc-700",
    },
  ];
  const consensusChoice = consensus.label;
  const consensusUi = VOTE_UI[consensusChoice];
  const dominantCountByChoice: Record<VoteChoice, number> = {
    appears_legit: consensus.appearsLegit,
    suspicious: consensus.suspicious,
    unclear: consensus.unclear,
  };
  const calcPercent = (count: number) =>
    consensus.total > 0 ? Math.round((count / consensus.total) * 100) : 0;
  const dominantPercent = calcPercent(dominantCountByChoice[consensusChoice]);
  const appearsLegitPercent = calcPercent(consensus.appearsLegit);
  const suspiciousPercent = calcPercent(consensus.suspicious);
  const unclearPercent = calcPercent(consensus.unclear);
  const voteCountLabel = `${consensus.total} ${consensus.total === 1 ? "vote" : "votes"}`;
  const communitySignalText =
    consensus.total > 5
      ? dominantPercent >= 70
        ? `Community leaning: ${consensusUi.emoji} ${consensusUi.label} (${dominantPercent}%, ${voteCountLabel})`
        : `Community split (🟢 ${appearsLegitPercent}% · 🟠 ${suspiciousPercent}% · ⚪ ${unclearPercent}%, ${voteCountLabel})`
      : `Not enough data yet (${voteCountLabel})`;

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#f7efe2_0%,#f0f4f8_55%,#e6efff_100%)] px-4 py-10 text-zinc-900">
      <main className="mx-auto max-w-3xl rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-8">
        <section className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Check The Crowd</h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!isConnected ? (
              <button
                onClick={connectWallet}
                disabled={isWorking || isPending}
                className="rounded-xl bg-amber-600 px-4 py-2 text-white disabled:opacity-50"
              >
                Connect Wallet (QR)
              </button>
            ) : (
              <div ref={walletMenuRef} className="relative">
                <button
                  onClick={() => setIsWalletMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700"
                >
                  <Image src="/icons/wallet.svg" alt="Wallet" width={16} height={16} />
                  {connectedWallet ? shortAddress(connectedWallet) : "-"}
                </button>
                {isWalletMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-10 w-36 rounded-lg border border-zinc-200 bg-white p-2 shadow-lg">
                    <button
                      onClick={() => {
                        disconnect();
                        void fetch("/api/auth/session", { method: "DELETE" });
                        clearWalletConnectStorage();
                        if (typeof window !== "undefined") {
                          window.localStorage.removeItem(WALLET_CONNECTED_AT_KEY);
                        }
                        setIsWalletMenuOpen(false);
                        setStatus("Wallet disconnected.");
                      }}
                      className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-white"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        <p className="mt-2 text-[16px] font-bold text-zinc-600">
          Community consensus only. Not financial advice.
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-[120px_1fr_auto]">
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
              <option value="sol">sol</option>
            </select>
          </div>
          <div className="relative">
            <input
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
              onFocus={() => setIsAddressInputFocused(true)}
              onBlur={() => setIsAddressInputFocused(false)}
              placeholder="Paste contract address (not token name)"
              className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 pr-10"
            />
            {isAddressInputFocused && tokenAddress.length > 0 && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setTokenAddress("")}
                aria-label="Clear address input"
                className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md border border-zinc-300 bg-white text-sm text-zinc-600"
              >
                x
              </button>
            )}
          </div>
          <button
            onClick={checkToken}
            disabled={isWorking}
            aria-label="Enter"
            title="Enter"
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 disabled:opacity-50"
          >
            <Image src="/icons/enter.svg" alt="Enter" width={18} height={18} />
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
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold tracking-wide text-zinc-500">VOTING TOKEN</div>
              <button
                onClick={() => {
                  void copyTokenAddress();
                }}
                disabled={!normalizedAddress}
                aria-label="Copy token address"
                title="Copy token address"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 disabled:opacity-40"
              >
                <Image src="/icons/copy.svg" alt="Copy" width={14} height={14} />
              </button>
            </div>
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
            {tokenMetadata && (
              <div className="mt-1 text-xs text-zinc-600">
                {tokenMetadata.symbol} · {tokenMetadata.name}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="font-semibold text-zinc-800">Consensus</div>
            <div className="text-zinc-700">{communitySignalText}</div>
          </div>

          <div className="mt-3 space-y-3">
            {voteRows.map((row) => {
              const percent = Math.round((row.count / voteTotal) * 100);

              return (
                <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs font-medium text-zinc-700">
                      <span className="inline-flex items-center gap-1">
                        <Image src={row.icon} alt={row.label} width={12} height={12} />
                        {row.label}
                      </span>
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
                    disabled={isWorking || existingVoteChoice === row.key}
                    className={`h-11 w-24 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${row.buttonClass}`}
                  >
                    {existingVoteChoice === row.key ? (
                      <span className="inline-flex items-center gap-1">
                        <Image src="/icons/check.svg" alt="Voted" width={14} height={14} />
                        Voted
                      </span>
                    ) : (
                      "Vote"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-zinc-600">
            <span className="font-semibold">One wallet, one vote. </span>Signature-based verification.
          </p>
          <div className="mt-2 flex justify-end">
            <span className="text-xs text-zinc-500">
              Last updated:{" "}
              {lastUpdatedAt
                ? lastUpdatedAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "-"}
            </span>
          </div>
        </section>

      </main>
      {xProfileUrl && (
        <a
          href={xProfileUrl}
          target="_blank"
          rel="noreferrer"
          className="group fixed bottom-6 left-1/2 z-20 inline-flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-xl border border-zinc-300 bg-white text-zinc-900 shadow"
          title={`X: @${xAccount?.replace(/^@/, "")}`}
          aria-label="Open X profile"
        >
          <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            Follow updates on X
          </span>
          <Image src="/icons/x-logo.svg" alt="X" width={16} height={16} />
        </a>
      )}
      {isCopiedToastVisible && (
        <div className="fixed left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white shadow-lg">
          Copied
        </div>
      )}
      {connectErrorMessage && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">Wallet connection failed</h2>
            <p className="mt-2 text-sm text-zinc-600">{connectErrorMessage}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setConnectErrorMessage(null)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {voteErrorMessage && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">Vote failed</h2>
            <p className="mt-2 text-sm text-zinc-600">{voteErrorMessage}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setVoteErrorMessage(null)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {checkErrorMessage && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">Invalid Address</h2>
            <p className="mt-2 text-sm text-zinc-600">{checkErrorMessage}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setCheckErrorMessage(null)}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isConnectVoteModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">Connect wallet to vote.</h2>
            <p className="mt-2 text-sm text-zinc-600">One wallet = one vote.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsConnectVoteModalOpen(false)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsConnectVoteModalOpen(false);
                  void connectWallet();
                }}
                disabled={isWorking || isPending}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
      {isRegisterSuggestionModalOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">Token not listed yet</h2>
            <p className="mt-2 text-sm text-zinc-600">
              No token record was found. Would you like to register it now?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setIsRegisterSuggestionModalOpen(false)}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void registerCurrentToken();
                }}
                disabled={isWorking}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Register
              </button>
            </div>
          </div>
        </div>
      )}
      {isChangeVoteModalOpen && pendingVoteChoice && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-zinc-900">Change vote?</h2>
            <p className="mt-2 text-sm text-zinc-600">
              You already voted for this token. Confirm to replace your vote with{" "}
              <span className="font-semibold">{VOTE_UI[pendingVoteChoice].label}</span>.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsChangeVoteModalOpen(false);
                  setPendingVoteChoice(null);
                }}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setIsChangeVoteModalOpen(false);
                  const nextChoice = pendingVoteChoice;
                  setPendingVoteChoice(null);
                  void submitVote(nextChoice);
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
