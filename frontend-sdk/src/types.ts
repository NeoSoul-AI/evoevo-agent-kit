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

export interface Erc8004ServiceEndpoint {
  name: string;
  type: string;
  url: string;
  description?: string;
  [key: string]: unknown;
}

export interface Erc8004RegistrationEntry {
  agentId?: string;
  agentRegistry: string;
}

export interface Erc8004SupportedTrustEntry {
  type: string;
  registry?: string;
  description?: string;
  [key: string]: unknown;
}

export interface Erc8004RegistrationFile {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
  name: string;
  description?: string;
  image?: string;
  homepage?: string;
  services: Erc8004ServiceEndpoint[];
  registrations: Erc8004RegistrationEntry[];
  supportedTrust?: Erc8004SupportedTrustEntry[];
  [key: string]: unknown;
}

export interface BuildErc8004RegistrationFileInput {
  name: string;
  description?: string;
  image?: string;
  homepage?: string;
  chainId: number | bigint | string;
  identityRegistry: Address;
  reputationRegistry?: Address;
  agentId?: bigint | string;
  services?: Erc8004ServiceEndpoint[];
  supportedTrust?: Erc8004SupportedTrustEntry[];
  source?: string;
  capabilities?: string[];
  extra?: Record<string, unknown>;
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

export interface GiveReputationFeedbackParams {
  reputationRegistry: Address;
  agentId: bigint;
  value: bigint | number;
  valueDecimals?: number;
  tag1: string;
  tag2?: string;
  endpoint?: string;
  feedbackURI?: string;
  feedbackHash?: Hex;
  account?: Address;
}

export interface ReputationFeedbackResult {
  agentId: bigint;
  clientAddress: Address;
  feedbackIndex?: bigint;
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  endpoint: string;
  feedbackURI: string;
  feedbackHash: Hex;
  transactionHash: Hash;
}

export interface RevokeReputationFeedbackParams {
  reputationRegistry: Address;
  agentId: bigint;
  feedbackIndex: bigint;
  account?: Address;
}

export interface ReadReputationFeedbackParams {
  reputationRegistry: Address;
  agentId: bigint;
  clientAddress: Address;
  feedbackIndex: bigint;
}

export interface ReputationFeedbackRecord {
  value: bigint;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  isRevoked: boolean;
}
