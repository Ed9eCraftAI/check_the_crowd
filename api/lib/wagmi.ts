import { createConfig, http } from "wagmi";
import { bsc, mainnet } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { env } from "@/lib/env";

const projectId = env("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");

if (env("NODE_ENV") !== "production") {
  console.log("[wagmi.ts] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", {
    exists: Boolean(projectId),
    length: projectId?.length ?? 0,
    preview: projectId ? `${projectId.slice(0, 4)}...` : null,
  });
}

function buildConnectors() {
  const base = [injected()];

  if (typeof window === "undefined") {
    return base;
  }

  if (!projectId) return base;

  try {
    base.push(
      walletConnect({
        projectId,
        showQrModal: true,
        metadata: {
          name: "ValidToken MVP",
          description: "Community consensus voting app",
          url: "http://localhost:3000",
          icons: [],
        },
      }),
    );
  } catch (error) {
    if (env("NODE_ENV") !== "production") {
      console.warn(
        "[wagmi.ts] walletConnect connector disabled:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  return base;
}

const connectors = buildConnectors();

export const wagmiConfig = createConfig({
  chains: [mainnet, bsc],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
});
