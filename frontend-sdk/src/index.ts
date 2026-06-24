import {
  bytesToHex,
  getAddress,
  keccak256,
  parseEventLogs,
  stringToHex,
  toBytes,
  zeroHash,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient
} from "viem";
import { erc8004IdentityRegistryAbi, evoBindingRegistryAbi, evoUserActionRouterAbi } from "./abis";
import type {
  AgentMetadataDocument,
  BindAgentParams,
  BoundAgent,
  EncodedMetadataEntry,
  MetadataEntryInput,
  MetadataValue,
  RegisterAgentParams,
  RegisteredAgent,
  RegisterAndBindParams,
  RegisterAndBindResult
} from "./types";

export { erc8004IdentityRegistryAbi, evoBindingRegistryAbi, evoUserActionRouterAbi };
export type {
  AgentMetadataDocument,
  BindAgentParams,
  BoundAgent,
  EncodedMetadataEntry,
  MetadataEncoding,
  MetadataEntryInput,
  MetadataValue,
  RegisterAgentParams,
  RegisteredAgent,
  RegisterAndBindParams,
  RegisterAndBindResult
} from "./types";

export function buildAgentMetadataDocument(input: AgentMetadataDocument): AgentMetadataDocument {
  return {
    protocols: ["erc-8004", "evoevo-openclaw"],
    capabilities: ["prediction-opinion", "memory-sync", "reasoning-commitment"],
    ...input
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

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
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

  await publicClient.waitForTransactionReceipt({ hash });
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
