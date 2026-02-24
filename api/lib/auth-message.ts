export type AuthSigningMessageInput = {
  domain: string;
  wallet: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
};

export function buildAuthSigningMessage(input: AuthSigningMessageInput): string {
  return (
    "CheckTheCrowd Login Signature\n\n" +
    "Action: Login\n" +
    `Domain: ${input.domain}\n` +
    `Wallet: ${input.wallet}\n` +
    `Nonce: ${input.nonce}\n` +
    `Issued At: ${input.issuedAt}\n` +
    `Expires At: ${input.expiresAt}\n\n` +
    "Notice: No transaction will be sent. No gas fee."
  );
}
