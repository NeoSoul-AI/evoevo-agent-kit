import {
  bytesToHex,
  getAddress,
  keccak256,
  parseEventLogs,
  parseAbiItem,
  stringToHex,
  toBytes,
  zeroHash,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient
} from "viem";
import {
  erc8004IdentityRegistryAbi,
  erc8004ReputationRegistryAbi,
  evoBindingRegistryAbi,
  evoUserActionRouterAbi
} from "./abis";
import type {
  AgentMetadataDocument,
  BindAgentParams,
  BoundAgent,
  BuildErc8004RegistrationFileInput,
  EncodedMetadataEntry,
  Erc8004RegistrationFile,
  GiveReputationFeedbackParams,
  ListRegisteredAgentsByOwnerParams,
  MetadataEntryInput,
  MetadataValue,
  ReadReputationFeedbackParams,
  RegisterAgentParams,
  RegisteredAgent,
  RegisterAndBindParams,
  RegisterAndBindResult,
  RegisteredAgentLog,
  ReputationFeedbackRecord,
  ReputationFeedbackResult,
  TransactionLifecycleCallbacks,
  RevokeReputationFeedbackParams
} from "./types";

export {
  erc8004IdentityRegistryAbi,
  erc8004ReputationRegistryAbi,
  evoBindingRegistryAbi,
  evoUserActionRouterAbi
};
export type {
  AgentMetadataDocument,
  BindAgentParams,
  BoundAgent,
  BuildErc8004RegistrationFileInput,
  EncodedMetadataEntry,
  Erc8004RegistrationFile,
  Erc8004RegistrationEntry,
  Erc8004ServiceEndpoint,
  Erc8004SupportedTrustEntry,
  GiveReputationFeedbackParams,
  ListRegisteredAgentsByOwnerParams,
  MetadataEncoding,
  MetadataEntryInput,
  MetadataValue,
  ReadReputationFeedbackParams,
  RegisterAgentParams,
  RegisteredAgent,
  RegisterAndBindParams,
  RegisterAndBindResult,
  RegisteredAgentLog,
  ReputationFeedbackRecord,
  ReputationFeedbackResult,
  TransactionLifecycleCallbacks,
  RevokeReputationFeedbackParams
} from "./types";

export function buildAgentMetadataDocument(input: AgentMetadataDocument): AgentMetadataDocument {
  return {
    protocols: ["erc-8004", "evoevo-openclaw"],
    capabilities: ["prediction-opinion", "memory-sync", "reasoning-commitment"],
    ...input
  };
}

export function buildAgentRegistry(chainId: number | bigint | string, identityRegistry: Address): string {
  const normalizedChainId = BigInt(chainId).toString();
  return `eip155:${normalizedChainId}:${getAddress(identityRegistry)}`;
}

export function buildErc8004RegistrationFile(input: BuildErc8004RegistrationFileInput): Erc8004RegistrationFile {
  const capabilities = input.capabilities ?? ["prediction-opinion", "memory-sync", "reasoning-commitment"];
  const services = input.services ?? [
    {
      name: "EvoEvo OpenClaw Agent Client",
      type: "https",
      url: input.homepage ?? "https://github.com/NeoSoul-AI/evoevo-agent-kit",
      description: "Reference offchain client flow for EvoEvo-compatible agents."
    }
  ];
  return {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    ...(input.image ? { image: input.image } : {}),
    ...(input.homepage ? { homepage: input.homepage } : {}),
    services,
    registrations: [
      {
        ...(input.agentId !== undefined ? { agentId: input.agentId.toString() } : {}),
        agentRegistry: buildAgentRegistry(input.chainId, input.identityRegistry)
      }
    ],
    supportedTrust: input.supportedTrust ?? [
      {
        type: "erc-8004-reputation",
        ...(input.reputationRegistry ? { registry: getAddress(input.reputationRegistry) } : {}),
        description: "Application-level prediction judgements and committee settlement signals."
      }
    ],
    ...(input.source ? { source: input.source } : {}),
    capabilities,
    ...(input.extra ?? {})
  };
}

export function defaultAgentMetadataEntries(input: {
  name: string;
  description?: string;
  homepage?: string;
  source?: string;
  protocols?: string[];
  capabilities?: string[];
}): MetadataEntryInput[] {
  return [
    { key: "name", value: input.name },
    ...(input.description ? [{ key: "description", value: input.description }] : []),
    ...(input.homepage ? [{ key: "homepage", value: input.homepage }] : []),
    ...(input.source ? [{ key: "source", value: input.source }] : []),
    { key: "protocols", value: input.protocols ?? ["erc-8004", "evoevo-openclaw"], encoding: "json" },
    {
      key: "capabilities",
      value: input.capabilities ?? ["prediction-opinion", "memory-sync", "reasoning-commitment"],
      encoding: "json"
    }
  ];
}

export function encodeMetadataEntries(entries: MetadataEntryInput[] = []): EncodedMetadataEntry[] {
  return entries
    .filter((entry) => entry.key.trim() !== "")
    .map((entry) => ({
      metadataKey: entry.key.trim(),
      metadataValue: encodeMetadataValue(entry.value, entry.encoding)
    }));
}

export function encodeMetadataValue(value: MetadataValue, encoding: "utf8" | "json" | "hex" = "utf8"): Hex {
  if (value instanceof Uint8Array) {
    return bytesToHex(value);
  }
  if (encoding === "hex") {
    const raw = String(value).trim();
    if (!/^0x[0-9a-fA-F]*$/.test(raw)) {
      throw new Error("hex metadata values must start with 0x");
    }
    return raw as Hex;
  }
  if (encoding === "json" || typeof value === "object") {
    return stringToHex(JSON.stringify(value));
  }
  return stringToHex(String(value));
}

export function hashEvoUserId(userId: string): Hex {
  return keccak256(toBytes(userId));
}

const registeredEvent = parseAbiItem("event Registered(uint256 indexed agentId, string agentURI, address indexed owner)");

export async function registerErc8004Agent(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: RegisterAgentParams
): Promise<RegisteredAgent> {
  const account = resolveWalletAccount(walletClient, params.account);
  const identityRegistry = getAddress(params.identityRegistry);
  const hash = await walletClient.writeContract({
    address: identityRegistry,
    abi: erc8004IdentityRegistryAbi,
    functionName: "register",
    args: [params.agentURI, encodeMetadataEntries(params.metadata)],
    account,
    chain: walletClient.chain ?? null
  });
  await params.onTransactionHash?.(hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  await params.onReceipt?.(receipt);
  const registeredLogs = parseEventLogs({
    abi: erc8004IdentityRegistryAbi,
    eventName: "Registered",
    logs: receipt.logs
  });
  const registered = registeredLogs.find(
    (log) =>
      getAddress(log.address) === identityRegistry &&
      getAddress(log.args.owner) === account &&
      log.args.agentURI === params.agentURI
  ) ?? registeredLogs.find((log) => getAddress(log.address) === identityRegistry);

  if (!registered) {
    throw new Error("Registered event not found in transaction receipt");
  }

  return {
    agentId: registered.args.agentId,
    agentURI: registered.args.agentURI,
    owner: getAddress(registered.args.owner),
    transactionHash: hash
  };
}

export async function listRegisteredAgentsByOwner(
  publicClient: PublicClient,
  params: ListRegisteredAgentsByOwnerParams
): Promise<RegisteredAgentLog[]> {
  const identityRegistry = getAddress(params.identityRegistry);
  const owner = getAddress(params.owner);
  const logs = await publicClient.getLogs({
    address: identityRegistry,
    event: registeredEvent,
    args: { owner },
    fromBlock: params.fromBlock ?? 0n,
    toBlock: params.toBlock ?? "latest"
  });

  return logs.map((log) => {
    const { agentId, agentURI, owner: logOwner } = log.args;
    if (agentId === undefined || agentURI === undefined || logOwner === undefined) {
      throw new Error("Registered event log is missing decoded arguments");
    }
    return {
      agentId,
      agentURI,
      owner: getAddress(logOwner),
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex
    };
  });
}

export async function bindEvoEvoAgent(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: BindAgentParams
): Promise<BoundAgent> {
  const account = resolveWalletAccount(walletClient, params.account);
  const identityRegistry = getAddress(params.identityRegistry);
  const evoAccount = getAddress(params.evoAccount ?? account);
  const evoUserIdHash = params.evoUserIdHash ?? zeroHash;
  const hash = await walletClient.writeContract({
    address: getAddress(params.router),
    abi: evoUserActionRouterAbi,
    functionName: "bindExistingAgentV2",
    args: [identityRegistry, params.agentId, evoAccount, evoUserIdHash],
    account,
    chain: walletClient.chain ?? null
  });
  await params.onTransactionHash?.(hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  await params.onReceipt?.(receipt);
  return {
    identityRegistry,
    agentId: params.agentId,
    evoAccount,
    evoUserIdHash,
    transactionHash: hash
  };
}

export async function registerAndBindEvoEvoAgent(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: RegisterAndBindParams
): Promise<RegisterAndBindResult> {
  const registration = await registerErc8004Agent(publicClient, walletClient, params);
  const binding = await bindEvoEvoAgent(publicClient, walletClient, {
    router: params.router,
    identityRegistry: params.identityRegistry,
    agentId: registration.agentId,
    evoAccount: params.evoAccount,
    evoUserIdHash: params.evoUserIdHash,
    account: params.account
  });
  return { registration, binding };
}

export async function getReputationRegistryIdentityRegistry(
  publicClient: PublicClient,
  reputationRegistry: Address
): Promise<Address> {
  const identityRegistry = await publicClient.readContract({
    address: getAddress(reputationRegistry),
    abi: erc8004ReputationRegistryAbi,
    functionName: "getIdentityRegistry"
  });
  return getAddress(identityRegistry);
}

export async function giveReputationFeedback(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: GiveReputationFeedbackParams
): Promise<ReputationFeedbackResult> {
  const account = resolveWalletAccount(walletClient, params.account);
  const reputationRegistry = getAddress(params.reputationRegistry);
  const value = BigInt(params.value);
  const valueDecimals = params.valueDecimals ?? 0;
  const tag2 = params.tag2 ?? "";
  const endpoint = params.endpoint ?? "";
  const feedbackURI = params.feedbackURI ?? "";
  const feedbackHash = params.feedbackHash ?? zeroHash;

  const hash = await walletClient.writeContract({
    address: reputationRegistry,
    abi: erc8004ReputationRegistryAbi,
    functionName: "giveFeedback",
    args: [params.agentId, value, valueDecimals, params.tag1, tag2, endpoint, feedbackURI, feedbackHash],
    account,
    chain: walletClient.chain ?? null
  });
  await params.onTransactionHash?.(hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  await params.onReceipt?.(receipt);
  const feedbackLogs = parseEventLogs({
    abi: erc8004ReputationRegistryAbi,
    eventName: "NewFeedback",
    logs: receipt.logs
  });
  const feedbackLog = feedbackLogs.find(
    (log) =>
      getAddress(log.address) === reputationRegistry &&
      log.args.agentId === params.agentId &&
      getAddress(log.args.clientAddress) === account
  );

  return {
    agentId: params.agentId,
    clientAddress: account,
    feedbackIndex: feedbackLog?.args.feedbackIndex,
    value,
    valueDecimals,
    tag1: params.tag1,
    tag2,
    endpoint,
    feedbackURI,
    feedbackHash,
    transactionHash: hash
  };
}

export async function revokeReputationFeedback(
  publicClient: PublicClient,
  walletClient: WalletClient,
  params: RevokeReputationFeedbackParams
): Promise<Hex> {
  const account = resolveWalletAccount(walletClient, params.account);
  const hash = await walletClient.writeContract({
    address: getAddress(params.reputationRegistry),
    abi: erc8004ReputationRegistryAbi,
    functionName: "revokeFeedback",
    args: [params.agentId, params.feedbackIndex],
    account,
    chain: walletClient.chain ?? null
  });
  await params.onTransactionHash?.(hash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  await params.onReceipt?.(receipt);
  return hash;
}

export async function readReputationFeedback(
  publicClient: PublicClient,
  params: ReadReputationFeedbackParams
): Promise<ReputationFeedbackRecord> {
  const [value, valueDecimals, tag1, tag2, isRevoked] = await publicClient.readContract({
    address: getAddress(params.reputationRegistry),
    abi: erc8004ReputationRegistryAbi,
    functionName: "readFeedback",
    args: [params.agentId, getAddress(params.clientAddress), params.feedbackIndex]
  });

  return {
    value,
    valueDecimals,
    tag1,
    tag2,
    isRevoked
  };
}

export async function isIdentityRegistrySupported(
  publicClient: PublicClient,
  bindingRegistry: Address,
  identityRegistry: Address
): Promise<boolean> {
  return publicClient.readContract({
    address: getAddress(bindingRegistry),
    abi: evoBindingRegistryAbi,
    functionName: "isSupportedIdentityRegistry",
    args: [getAddress(identityRegistry)]
  });
}

export async function isEvoBound(
  publicClient: PublicClient,
  bindingRegistry: Address,
  identityRegistry: Address,
  agentId: bigint
): Promise<boolean> {
  return publicClient.readContract({
    address: getAddress(bindingRegistry),
    abi: evoBindingRegistryAbi,
    functionName: "isEvoBoundV2",
    args: [getAddress(identityRegistry), agentId]
  });
}

function resolveWalletAccount(walletClient: WalletClient, override?: Address): Address {
  const account = override ?? (typeof walletClient.account === "string" ? walletClient.account : walletClient.account?.address);
  if (!account) {
    throw new Error("wallet account is required; connect a wallet or pass account");
  }
  return getAddress(account);
}
