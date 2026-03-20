export interface OpenClawConfig {
  readonly gatewayUrl: string;
  readonly gatewayToken?: string;
  readonly gatewayPassword?: string;
}

export function readOpenClawConfig(): OpenClawConfig {
  return {
    gatewayUrl: process.env.OPENCLAW_GATEWAY_URL ?? "ws://127.0.0.1:18789",
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN,
    gatewayPassword: process.env.OPENCLAW_GATEWAY_PASSWORD
  };
}
