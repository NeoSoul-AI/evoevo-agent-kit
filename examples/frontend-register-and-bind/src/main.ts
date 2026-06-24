import { createPublicClient, createWalletClient, custom, getAddress, zeroHash, type Address } from "viem";
import {
  bindEvoEvoAgent,
  buildErc8004RegistrationFile,
  defaultAgentMetadataEntries,
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
  <p>Connect a wallet, register an ERC-8004 agent identity, then bind that identity into EvoEvo.</p>
  <form id="form">
    <label>
      Chain ID
      <input id="chainId" value="16661" inputmode="numeric" />
    </label>
    <label>
      ERC-8004 Identity Registry
      <input id="identityRegistry" placeholder="0x..." />
    </label>
    <label>
      EvoUserActionRouter
      <input id="router" placeholder="0x..." />
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
      <input id="agentURI" value="https://metadata.example.com/agents/123.json" />
    </label>
    <label class="wide">
      Description
      <textarea id="description">Submits prediction opinions through EvoEvo Agent Kit.</textarea>
    </label>
  </form>
  <div class="actions">
    <button id="connect" type="button" class="secondary">Connect Wallet</button>
    <button id="register" type="button">Register ERC-8004 Agent</button>
    <button id="bind" type="button">Bind Existing Agent</button>
  </div>
  <output id="log">Ready.</output>
`;

const logEl = document.querySelector<HTMLOutputElement>("#log")!;
let connectedAccount: Address | undefined;
let lastAgentId: bigint | undefined;

document.querySelector<HTMLButtonElement>("#connect")!.addEventListener("click", () => runAction(async () => {
  await ensureWalletChain();
  const accounts = await requestAccounts();
  connectedAccount = getAddress(accounts[0]);
  log(`Connected wallet: ${connectedAccount}`);
}));

document.querySelector<HTMLButtonElement>("#register")!.addEventListener("click", () => runAction(async () => {
  await ensureWalletChain();
  const { publicClient, walletClient } = clients();
  const registrationFile = buildErc8004RegistrationFile({
    chainId: readInput("chainId"),
    identityRegistry: readAddress("identityRegistry"),
    name: readInput("agentName"),
    description: readInput("description"),
    source: "https://github.com/NeoSoul-AI/evoevo-agent-kit"
  });
  const result = await registerErc8004Agent(publicClient, walletClient, {
    identityRegistry: readAddress("identityRegistry"),
    agentURI: readInput("agentURI"),
    metadata: defaultAgentMetadataEntries({
      name: readInput("agentName"),
      description: readInput("description"),
      source: "https://github.com/NeoSoul-AI/evoevo-agent-kit"
    }),
    account: connectedAccount
  });
  lastAgentId = result.agentId;
  log(JSON.stringify({ step: "registered", registrationFile, result: stringifyBigInts(result) }, null, 2));
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
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: `0x${chainId.toString(16)}` }]
  });
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
    log(error instanceof Error ? `Error: ${error.message}` : `Error: ${String(error)}`);
  }
}
