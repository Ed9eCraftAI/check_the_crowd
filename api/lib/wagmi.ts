import { createConfig, http } from "wagmi";
import { bsc, mainnet } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { env } from "@/lib/env";

const projectId = env("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");

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
  } catch {
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
