import type { VoteChoice } from "@/lib/token";

export type VoteSigningMessageInput = {
  domain: string;
  chain: string;
  address: string;
  choice: VoteChoice;
  wallet: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

export function buildVoteSigningMessage(input: VoteSigningMessageInput): string {
  return (
    "CheckTheCrowd Vote Signature\n\n" +
    "Action: Vote\n" +
    `Domain: ${input.domain}\n` +
    `Token: ${input.chain}:${input.address}\n` +
    `Choice: ${input.choice}\n` +
    `Wallet: ${input.wallet}\n` +
    `Nonce: ${input.nonce}\n` +
    `Issued At: ${input.issuedAt}\n` +
    `Expires At: ${input.expiresAt}\n\n` +
    "Notice: No transaction will be sent. No gas fee."
  );
}
