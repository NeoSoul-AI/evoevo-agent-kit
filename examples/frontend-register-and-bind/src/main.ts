import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  zeroHash,
  type Address,
  type Hash,
  type TransactionReceipt
} from "viem";
import {
  bindEvoEvoAgent,
  buildErc8004RegistrationFile,
  defaultAgentMetadataEntries,
  giveReputationFeedback,
  getErc8004AgentOwner,
  hashEvoUserId,
  listRegisteredAgentsByOwner,
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
    .toast-root {
      position: fixed;
      top: 18px;
      right: 18px;
      z-index: 40;
      display: grid;
      gap: 10px;
      width: min(420px, calc(100vw - 36px));
      pointer-events: none;
    }
    .toast {
      border: 1px solid #d8d8d0;
      border-left: 5px solid #64748b;
      border-radius: 8px;
      background: white;
      box-shadow: 0 18px 40px rgb(15 23 42 / 18%);
      color: #171717;
      padding: 12px 14px;
      pointer-events: auto;
    }
    .toast.pending { border-left-color: #2563eb; }
    .toast.success { border-left-color: #16a34a; }
    .toast.error { border-left-color: #dc2626; }
    .toast-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-weight: 800;
      margin-bottom: 5px;
    }
    .toast-body {
      color: #525252;
      font-size: 13px;
      line-height: 1.45;
      overflow-wrap: anywhere;
    }
    .toast a { color: #1d4ed8; font-weight: 700; text-decoration: none; }
    .toast-close {
      background: transparent;
      color: #525252;
      padding: 0 2px;
      font-size: 18px;
      line-height: 1;
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
    <label>
      My ERC-8004 Agent ID
      <input id="agentId" placeholder="auto-filled after register; or paste an existing id" inputmode="numeric" />
    </label>
    <label>
      Scan From Block
      <input id="scanFromBlock" value="0" inputmode="numeric" />
    </label>
    <label class="wide">
      Explorer Tx Base URL
      <input id="explorerTxBaseUrl" value="https://chainscan.0g.ai/tx/" />
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
      Feedback Target Agent ID
      <input id="feedbackTargetAgentId" placeholder="paste another ERC-8004 agent id to rate" inputmode="numeric" />
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
    <button id="findAgents" type="button" class="secondary">Find My Agents</button>
    <button id="preview" type="button" class="secondary">Preview Registration JSON</button>
    <button id="register" type="button">Register ERC-8004 Agent</button>
    <button id="bind" type="button">Bind Existing Agent</button>
    <button id="feedback" type="button">Give Reputation Feedback</button>
  </div>
  <output id="log">Ready.</output>
  <div id="toastRoot" class="toast-root" aria-live="polite"></div>
`;

const logEl = document.querySelector<HTMLOutputElement>("#log")!;
const toastRoot = document.querySelector<HTMLDivElement>("#toastRoot")!;
let connectedAccount: Address | undefined;
let lastAgentId: bigint | undefined;

document.querySelector<HTMLButtonElement>("#connect")!.addEventListener("click", () => runAction(async () => {
  log("Requesting wallet connection...");
  const accounts = await requestAccounts();
  connectedAccount = getAddress(accounts[0]);
  await ensureWalletChain();
  const ownedAgents = await loadOwnedAgents(connectedAccount);
  log(JSON.stringify({
    step: "connected",
    wallet: connectedAccount,
    chain: readInput("chainId"),
    ownedAgents: stringifyBigInts(ownedAgents),
    note: ownedAgents.length > 0
      ? "Latest owned agentId has been filled into the My ERC-8004 Agent ID field. To give reputation feedback, paste a non-owned agent id into Feedback Target Agent ID."
      : "No ERC-8004 agents were found for this wallet in the selected block range."
  }, null, 2));
}));

document.querySelector<HTMLButtonElement>("#findAgents")!.addEventListener("click", () => runAction(async () => {
  const account = connectedAccount ?? getAddress((await requestAccounts())[0]);
  connectedAccount = account;
  await ensureWalletChain();
  const ownedAgents = await loadOwnedAgents(account);
  log(JSON.stringify({
    step: "owned-agents",
    wallet: account,
    ownedAgents: stringifyBigInts(ownedAgents)
  }, null, 2));
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
    account: connectedAccount,
    ...transactionNotifications("Register agent")
  });
  lastAgentId = result.agentId;
  document.querySelector<HTMLInputElement>("#agentId")!.value = result.agentId.toString();
  log(JSON.stringify({ step: "registered", agentURI, registrationFile, result: stringifyBigInts(result) }, null, 2));
}));

document.querySelector<HTMLButtonElement>("#bind")!.addEventListener("click", () => runAction(async () => {
  await ensureWalletChain();
  const agentId = readAgentId("Bind Existing Agent");
  const { publicClient, walletClient } = clients();
  const evoUserId = readInput("evoUserId");
  const result = await bindEvoEvoAgent(publicClient, walletClient, {
    router: readAddress("router"),
    identityRegistry: readAddress("identityRegistry"),
    agentId,
    evoAccount: readOptionalAddress("evoAccount"),
    evoUserIdHash: evoUserId ? hashEvoUserId(evoUserId) : zeroHash,
    account: connectedAccount,
    ...transactionNotifications("Bind agent")
  });
  log(JSON.stringify({ step: "bound", result: stringifyBigInts(result) }, null, 2));
}));

document.querySelector<HTMLButtonElement>("#feedback")!.addEventListener("click", () => runAction(async () => {
  await ensureWalletChain();
  const agentId = readFeedbackTargetAgentId();
  const { publicClient, walletClient } = clients();
  const account = connectedAccount ?? getAddress((await requestAccounts())[0]);
  connectedAccount = account;
  const agentOwner = await getErc8004AgentOwner(publicClient, readAddress("identityRegistry"), agentId);
  if (agentOwner === account) {
    throw new Error("Self-feedback not allowed: the connected wallet owns this ERC-8004 agent. Use a different reviewer wallet, user wallet, settlement service, or committee/oracle account to publish reputation feedback.");
  }
  const result = await giveReputationFeedback(publicClient, walletClient, {
    reputationRegistry: readAddress("reputationRegistry"),
    agentId,
    value: BigInt(readInput("feedbackScore")),
    valueDecimals: 0,
    tag1: readInput("feedbackTag"),
    tag2: "evoevo-settlement",
    endpoint: "evoevo-prediction",
    feedbackURI: readOptionalPublicUrl("feedbackURI") ?? "",
    feedbackHash: zeroHash,
    account,
    ...transactionNotifications("Reputation feedback")
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

async function loadOwnedAgents(owner: Address) {
  const { publicClient } = clients();
  const ownedAgents = await listRegisteredAgentsByOwner(publicClient, {
    identityRegistry: readAddress("identityRegistry"),
    owner,
    fromBlock: readOptionalBlock("scanFromBlock") ?? 0n
  });
  const latestAgent = ownedAgents[ownedAgents.length - 1];
  if (latestAgent) {
    lastAgentId = latestAgent.agentId;
    document.querySelector<HTMLInputElement>("#agentId")!.value = latestAgent.agentId.toString();
    if (!readInput("agentURI")) {
      document.querySelector<HTMLInputElement>("#agentURI")!.value = latestAgent.agentURI;
    }
  }
  return ownedAgents;
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

function readOptionalBlock(id: string): bigint | undefined {
  const value = readInput(id);
  if (!value) {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error("Scan From Block must be a non-negative integer.");
  }
  return BigInt(value);
}

function readAgentId(actionName: string): bigint {
  const value = readInput("agentId") || lastAgentId?.toString() || "";
  if (!value) {
    throw new Error(`${actionName} needs your ERC-8004 agentId. Register an agent first, or paste an existing id into the My ERC-8004 Agent ID field.`);
  }
  if (!/^\d+$/.test(value)) {
    throw new Error("My ERC-8004 Agent ID must be a non-negative integer.");
  }
  const agentId = BigInt(value);
  document.querySelector<HTMLInputElement>("#agentId")!.value = agentId.toString();
  return agentId;
}

function readFeedbackTargetAgentId(): bigint {
  const value = readInput("feedbackTargetAgentId");
  if (!value) {
    throw new Error("Give Reputation Feedback needs a target agentId. Paste another ERC-8004 agent id into the Feedback Target Agent ID field.");
  }
  if (!/^\d+$/.test(value)) {
    throw new Error("Feedback Target Agent ID must be a non-negative integer.");
  }
  const agentId = BigInt(value);
  document.querySelector<HTMLInputElement>("#feedbackTargetAgentId")!.value = agentId.toString();
  return agentId;
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

type ToastStatus = "pending" | "success" | "error";

interface ToastData {
  title: string;
  message: string;
  status: ToastStatus;
  hash?: Hash;
  blockNumber?: bigint;
}

function transactionNotifications(label: string) {
  let toastId: string | undefined;
  return {
    onTransactionHash(hash: Hash) {
      toastId = showToast({
        title: `${label} submitted`,
        message: "Wallet submitted the transaction. Waiting for receipt confirmation.",
        status: "pending",
        hash
      });
    },
    onReceipt(receipt: TransactionReceipt) {
      const data: ToastData = {
        title: `${label} confirmed`,
        message: "Transaction receipt confirmed.",
        status: "success",
        hash: receipt.transactionHash,
        blockNumber: receipt.blockNumber
      };
      if (toastId) {
        updateToast(toastId, data);
      } else {
        showToast(data);
      }
    }
  };
}

function showToast(data: ToastData): string {
  const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const toast = document.createElement("section");
  toast.dataset.toastId = id;
  toastRoot.appendChild(toast);
  renderToast(toast, data);
  scheduleToastRemoval(id, data.status);
  return id;
}

function updateToast(id: string, data: ToastData): void {
  const toast = toastRoot.querySelector<HTMLElement>(`[data-toast-id="${id}"]`);
  if (!toast) {
    showToast(data);
    return;
  }
  renderToast(toast, data);
  scheduleToastRemoval(id, data.status);
}

function renderToast(toast: HTMLElement, data: ToastData): void {
  toast.className = `toast ${data.status}`;
  toast.replaceChildren();

  const title = document.createElement("div");
  title.className = "toast-title";
  const titleText = document.createElement("span");
  titleText.textContent = data.title;
  const close = document.createElement("button");
  close.className = "toast-close";
  close.type = "button";
  close.textContent = "x";
  close.addEventListener("click", () => toast.remove());
  title.append(titleText, close);

  const body = document.createElement("div");
  body.className = "toast-body";
  const message = document.createElement("div");
  message.textContent = data.message;
  body.appendChild(message);

  if (data.hash) {
    const tx = document.createElement("div");
    const txUrl = buildTxUrl(data.hash);
    tx.append("Tx: ");
    if (txUrl) {
      const link = document.createElement("a");
      link.href = txUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = shortHash(data.hash);
      tx.appendChild(link);
    } else {
      tx.append(shortHash(data.hash));
    }
    body.appendChild(tx);
  }

  if (data.blockNumber !== undefined) {
    const block = document.createElement("div");
    block.textContent = `Block: ${data.blockNumber.toString()}`;
    body.appendChild(block);
  }

  toast.append(title, body);
}

function scheduleToastRemoval(id: string, status: ToastStatus): void {
  if (status === "pending") {
    return;
  }
  window.setTimeout(() => {
    toastRoot.querySelector<HTMLElement>(`[data-toast-id="${id}"]`)?.remove();
  }, status === "success" ? 15000 : 22000);
}

function buildTxUrl(hash: Hash): string | undefined {
  const baseUrl = readInput("explorerTxBaseUrl");
  if (!baseUrl) {
    return undefined;
  }
  return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}${hash}`;
}

function shortHash(hash: Hash): string {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function log(message: string) {
  logEl.value = message;
}

async function runAction(action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    const message = formatUnknownError(error);
    showToast({
      title: "Action failed",
      message,
      status: "error"
    });
    log(`Error: ${message}`);
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
