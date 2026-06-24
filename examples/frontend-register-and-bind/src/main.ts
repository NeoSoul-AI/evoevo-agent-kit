import { createPublicClient, createWalletClient, custom, getAddress, zeroHash, type Address } from "viem";
import {
  bindEvoEvoAgent,
  buildErc8004RegistrationFile,
  defaultAgentMetadataEntries,
  giveReputationFeedback,
  hashEvoUserId,
  registerErc8004Agent
} from "@evoevo/agent-kit-frontend";

declare global {
  interface Window {
    ethereum?: {
      request(args: { method: string; params?: unknown[] }): Promise<unknown>;
    };
  }
}

const ZERO_G_MAINNET = {
  chainId: "0x4115",
  chainName: "0G Mainnet",
  nativeCurrency: {
    name: "0G",
    symbol: "OG",
    decimals: 18
  },
  rpcUrls: ["https://evmrpc.0g.ai"]
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("app root not found");
}

app.innerHTML = `
  <style>
    :root {
      color: #171717;
      background: #f7f7f4;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    body { margin: 0; }
    main {
      width: min(960px, calc(100vw - 32px));
      margin: 32px auto;
    }
    h1 { font-size: 28px; margin: 0 0 8px; }
    p { color: #555; line-height: 1.5; margin: 0 0 24px; }
    form {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; }
    input, textarea {
      box-sizing: border-box;
      width: 100%;
      border: 1px solid #d8d8d0;
      border-radius: 6px;
      font: inherit;
      padding: 10px 12px;
      background: white;
    }
    textarea { min-height: 92px; resize: vertical; }
    .wide { grid-column: 1 / -1; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    button {
      border: 0;
      border-radius: 6px;
      background: #1d4ed8;
      color: white;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
      padding: 10px 14px;
    }
    button.secondary { background: #334155; }
    output {
      display: block;
      margin-top: 18px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      background: #111827;
      color: #e5e7eb;
      border-radius: 8px;
      padding: 14px;
      min-height: 120px;
      font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    @media (max-width: 720px) {
      form { grid-template-columns: 1fr; }
    }
  </style>
  <h1>EvoEvo ERC-8004 Register And Bind</h1>
  <p>Connect a wallet, register an ERC-8004 agent identity, bind it into EvoEvo, then publish reputation feedback.</p>
  <form id="form">
    <label>
      Chain ID
      <input id="chainId" value="16661" inputmode="numeric" />
    </label>
    <label>
      ERC-8004 Identity Registry
      <input id="identityRegistry" value="0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" />
    </label>
    <label>
      ERC-8004 Reputation Registry
      <input id="reputationRegistry" value="0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" />
    </label>
    <label>
      EvoUserActionRouter
      <input id="router" value="0x61bb71442749d13a4BB7257DfBFFf0452ae937f9" />
    </label>
    <label>
      Evo Account
      <input id="evoAccount" placeholder="defaults to connected wallet" />
    </label>
    <label>
      Evo User ID
      <input id="evoUserId" placeholder="optional; hashed client-side" />
    </label>
    <label>
      Agent Name
      <input id="agentName" value="Example Forecast Agent" />
    </label>
    <label class="wide">
      Agent URI
      <input id="agentURI" placeholder="optional for demo; paste HTTPS/IPFS/0G Storage URL for production" />
    </label>
    <label class="wide">
      Description
      <textarea id="description">Submits prediction opinions through EvoEvo Agent Kit.</textarea>
    </label>
    <label>
      Feedback Score
      <input id="feedbackScore" value="100" inputmode="numeric" />
    </label>
    <label>
      Feedback Tag
      <input id="feedbackTag" value="prediction-performance" />
    </label>
    <label class="wide">
      Feedback URI (optional)
      <input id="feedbackURI" placeholder="optional public evidence URL" />
    </label>
  </form>
  <div class="actions">
    <button id="connect" type="button" class="secondary">Connect Wallet</button>
    <button id="preview" type="button" class="secondary">Preview Registration JSON</button>
    <button id="register" type="button">Register ERC-8004 Agent</button>
    <button id="bind" type="button">Bind Existing Agent</button>
    <button id="feedback" type="button">Give Reputation Feedback</button>
  </div>
  <output id="log">Ready.</output>
`;

const logEl = document.querySelector<HTMLOutputElement>("#log")!;
let connectedAccount: Address | undefined;
let lastAgentId: bigint | undefined;

document.querySelector<HTMLButtonElement>("#connect")!.addEventListener("click", () => runAction(async () => {
  log("Requesting wallet connection...");
  const accounts = await requestAccounts();
  connectedAccount = getAddress(accounts[0]);
  await ensureWalletChain();
  log(`Connected wallet: ${connectedAccount}\nChain: ${readInput("chainId")}`);
}));

document.querySelector<HTMLButtonElement>("#preview")!.addEventListener("click", () => runAction(async () => {
  const registrationFile = buildCurrentRegistrationFile();
  const agentURI = resolveAgentUri(registrationFile);
  log(JSON.stringify({ agentURI, registrationFile }, null, 2));
}));

document.querySelector<HTMLButtonElement>("#register")!.addEventListener("click", () => runAction(async () => {
  await ensureWalletChain();
  const { publicClient, walletClient } = clients();
  const registrationFile = buildCurrentRegistrationFile();
  const agentURI = resolveAgentUri(registrationFile);
  const result = await registerErc8004Agent(publicClient, walletClient, {
    identityRegistry: readAddress("identityRegistry"),
    agentURI,
    metadata: defaultAgentMetadataEntries({
      name: readInput("agentName"),
      description: readInput("description"),
      source: "https://github.com/NeoSoul-AI/evoevo-agent-kit"
    }),
    account: connectedAccount
  });
  lastAgentId = result.agentId;
  log(JSON.stringify({ step: "registered", agentURI, registrationFile, result: stringifyBigInts(result) }, null, 2));
}));

document.querySelector<HTMLButtonElement>("#bind")!.addEventListener("click", () => runAction(async () => {
  await ensureWalletChain();
  const agentIdInput = window.prompt("ERC-8004 agentId", lastAgentId?.toString() ?? "");
  if (!agentIdInput) return;
  const { publicClient, walletClient } = clients();
  const evoUserId = readInput("evoUserId");
  const result = await bindEvoEvoAgent(publicClient, walletClient, {
    router: readAddress("router"),
    identityRegistry: readAddress("identityRegistry"),
    agentId: BigInt(agentIdInput),
    evoAccount: readOptionalAddress("evoAccount"),
    evoUserIdHash: evoUserId ? hashEvoUserId(evoUserId) : zeroHash,
    account: connectedAccount
  });
  log(JSON.stringify({ step: "bound", result: stringifyBigInts(result) }, null, 2));
}));

document.querySelector<HTMLButtonElement>("#feedback")!.addEventListener("click", () => runAction(async () => {
  await ensureWalletChain();
  const agentIdInput = window.prompt("ERC-8004 agentId", lastAgentId?.toString() ?? "");
  if (!agentIdInput) return;
  const { publicClient, walletClient } = clients();
  const result = await giveReputationFeedback(publicClient, walletClient, {
    reputationRegistry: readAddress("reputationRegistry"),
    agentId: BigInt(agentIdInput),
    value: BigInt(readInput("feedbackScore")),
    valueDecimals: 0,
    tag1: readInput("feedbackTag"),
    tag2: "evoevo-settlement",
    endpoint: "evoevo-prediction",
    feedbackURI: readOptionalPublicUrl("feedbackURI") ?? "",
    feedbackHash: zeroHash,
    account: connectedAccount
  });
  log(JSON.stringify({ step: "feedback", result: stringifyBigInts(result) }, null, 2));
}));

function clients() {
  if (!window.ethereum) {
    throw new Error("No EIP-1193 wallet found");
  }
  const transport = custom(window.ethereum);
  return {
    publicClient: createPublicClient({ transport }),
    walletClient: createWalletClient({ transport })
  };
}

function buildCurrentRegistrationFile() {
  return buildErc8004RegistrationFile({
    chainId: readInput("chainId"),
    identityRegistry: readAddress("identityRegistry"),
    reputationRegistry: readAddress("reputationRegistry"),
    name: readInput("agentName"),
    description: readInput("description"),
    source: "https://github.com/NeoSoul-AI/evoevo-agent-kit"
  });
}

async function requestAccounts(): Promise<Address[]> {
  if (!window.ethereum) {
    throw new Error("No EIP-1193 wallet found");
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("Wallet did not return any accounts");
  }
  return accounts.map((account) => getAddress(String(account)));
}

async function ensureWalletChain(): Promise<void> {
  if (!window.ethereum) {
    throw new Error("No EIP-1193 wallet found");
  }
  const chainId = Number(readInput("chainId"));
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new Error("Chain ID must be a positive integer");
  }
  const hexChainId = `0x${chainId.toString(16)}`;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexChainId }]
    });
    return;
  } catch (error) {
    if (chainId === 16661 && isMissingWalletChainError(error)) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [ZERO_G_MAINNET]
      });
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexChainId }]
      });
      return;
    }

    throw new Error(`Could not switch wallet to chain ${chainId}: ${formatUnknownError(error)}`);
  }
}

function readInput(id: string): string {
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!.value.trim();
}

function readAddress(id: string): Address {
  return getAddress(readInput(id));
}

function readOptionalAddress(id: string): Address | undefined {
  const value = readInput(id);
  return value ? getAddress(value) : undefined;
}

function resolveAgentUri(registrationFile: unknown): string {
  const value = readInput("agentURI");
  if (!value) {
    const demoURI = buildDataJsonUri(registrationFile);
    document.querySelector<HTMLInputElement>("#agentURI")!.value = demoURI;
    return demoURI;
  }
  assertAgentUri(value);
  if (isExampleUrl(value)) {
    throw new Error("Agent URI is still an example URL. Replace it with your uploaded ERC-8004 registration file URL or leave it blank to use the generated demo URI.");
  }
  return value;
}

function readOptionalPublicUrl(id: string): string | undefined {
  const value = readInput(id);
  if (!value) {
    return undefined;
  }
  assertPublicUrl(value, "Feedback URI");
  return value;
}

function buildDataJsonUri(value: unknown): string {
  return `data:application/json,${encodeURIComponent(JSON.stringify(value))}`;
}

function assertAgentUri(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Agent URI must be a valid URL.");
  }
  if (!["https:", "ipfs:", "data:"].includes(parsed.protocol)) {
    throw new Error("Agent URI must use https://, ipfs://, or data: for the local demo.");
  }
}

function assertPublicUrl(value: string, label: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (!["https:", "ipfs:"].includes(parsed.protocol)) {
    throw new Error(`${label} must use https:// or ipfs://.`);
  }
}

function isExampleUrl(value: string): boolean {
  const host = new URL(value).hostname.toLowerCase();
  return host === "example.com" || host.endsWith(".example.com");
}

function stringifyBigInts(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item))
  ) as unknown;
}

function log(message: string) {
  logEl.value = message;
}

async function runAction(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    log(`Error: ${formatUnknownError(error)}`);
  }
}

function isMissingWalletChainError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  const code = typeof error.code === "number" ? error.code : undefined;
  const message = typeof error.message === "string" ? error.message : "";
  return code === 4902 || /unrecognized chain|unknown chain|not been added/i.test(message);
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (isRecord(error)) {
    const parts: string[] = [];
    if (error.code !== undefined) {
      parts.push(`code=${String(error.code)}`);
    }
    if (typeof error.message === "string" && error.message) {
      parts.push(error.message);
    }
    if (error.data !== undefined) {
      parts.push(`data=${JSON.stringify(stringifyBigInts(error.data), null, 2)}`);
    }
    if (parts.length > 0) {
      return parts.join("\n");
    }
    return JSON.stringify(stringifyBigInts(error), null, 2);
  }
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
