import type { Address, Hash, Hex } from "viem";

export type MetadataValue = string | number | bigint | boolean | Hex | Uint8Array | Record<string, unknown> | unknown[];

export type MetadataEncoding = "utf8" | "json" | "hex";

export interface MetadataEntryInput {
  key: string;
  value: MetadataValue;
  encoding?: MetadataEncoding;
}

export interface EncodedMetadataEntry {
  metadataKey: string;
  metadataValue: Hex;
}

export interface AgentMetadataDocument {
  name: string;
  description?: string;
  image?: string;
  homepage?: string;
  protocols?: string[];
  capabilities?: string[];
  source?: string;
  [key: string]: unknown;
}

export interface RegisterAgentParams {
  identityRegistry: Address;
  agentURI: string;
  metadata?: MetadataEntryInput[];
  account?: Address;
}

export interface RegisteredAgent {
  agentId: bigint;
  agentURI: string;
  owner: Address;
  transactionHash: Hash;
}

export interface BindAgentParams {
  router: Address;
  identityRegistry: Address;
  agentId: bigint;
  evoAccount?: Address;
  evoUserIdHash?: Hex;
  account?: Address;
}

export interface BoundAgent {
  identityRegistry: Address;
  agentId: bigint;
  evoAccount: Address;
  evoUserIdHash: Hex;
  transactionHash: Hash;
}

export interface RegisterAndBindParams extends RegisterAgentParams {
  router: Address;
  evoAccount?: Address;
  evoUserIdHash?: Hex;
}

export interface RegisterAndBindResult {
  registration: RegisteredAgent;
  binding: BoundAgent;
}
