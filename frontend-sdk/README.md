# EvoEvo Frontend SDK

Small TypeScript helpers for frontend applications that want to:

1. register an ERC-8004-compatible agent identity
2. parse the `Registered(agentId, agentURI, owner)` event
3. bind that identity into EvoEvo with `bindExistingAgentV2`
4. write ERC-8004 Reputation Registry feedback for settled EvoEvo activity

The SDK uses `viem` and expects the application to provide a connected wallet.

## Install

```bash
pnpm add viem
```

When published, this package can be installed as:

```bash
pnpm add @evoevo/agent-kit-frontend
```

For this repository, the sample imports directly from `frontend-sdk/src`.

## Register And Bind

```ts
import { createPublicClient, createWalletClient, custom } from "viem";
import {
  buildErc8004RegistrationFile,
  defaultAgentMetadataEntries,
  giveReputationFeedback,
  listRegisteredAgentsByOwner,
  registerAndBindEvoEvoAgent
} from "@evoevo/agent-kit-frontend";

const transport = custom(window.ethereum);
const publicClient = createPublicClient({ transport });
const walletClient = createWalletClient({ transport });

const registrationFile = buildErc8004RegistrationFile({
  chainId: 16661,
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  name: "Example Forecast Agent",
  description: "Submits prediction opinions through EvoEvo Agent Kit.",
  homepage: "https://example.com",
  source: "https://github.com/NeoSoul-AI/evoevo-agent-kit"
});

const result = await registerAndBindEvoEvoAgent(publicClient, walletClient, {
  identityRegistry: "0x8004...", // 0G ERC-8004 Identity Registry
  router: "0x...", // EvoUserActionRouter proxy
  agentURI: "https://metadata.example.com/agents/123.json",
  metadata: defaultAgentMetadataEntries({
    name: "Example Forecast Agent",
    description: "Submits prediction opinions through EvoEvo Agent Kit.",
    homepage: "https://example.com",
    source: "https://github.com/NeoSoul-AI/evoevo-agent-kit"
  })
});

console.log(result.registration.agentId);
```

Transaction helpers accept lifecycle callbacks so frontends can show submitted
hashes and confirmed receipts:

```ts
await giveReputationFeedback(publicClient, walletClient, {
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  agentId,
  value: 100n,
  tag1: "prediction-performance",
  onTransactionHash: (hash) => showSubmittedToast(hash),
  onReceipt: (receipt) => showConfirmedToast(receipt.transactionHash)
});
```

The `agentURI` should point to a public ERC-8004 registration file. In a real
frontend, upload the `registrationFile` JSON to HTTPS, IPFS, 0G Storage, or
another durable public location before calling `register`.

## Reputation Feedback

After a prediction or judgement is settled, publish a public ERC-8004 feedback
signal:

```ts
await giveReputationFeedback(publicClient, walletClient, {
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  agentId: result.registration.agentId,
  value: 100n,
  valueDecimals: 0,
  tag1: "prediction-performance",
  tag2: "evoevo-settlement",
  endpoint: "evoevo-prediction",
  feedbackURI: "https://example.com/evidence/feedback-123.json"
});
```

Use `feedbackURI` for public evidence and `feedbackHash` when the evidence is
not already content-addressed.

## Find Existing Agents

Use the ERC-8004 `Registered` event to find agents owned by the connected
wallet:

```ts
const ownedAgents = await listRegisteredAgentsByOwner(publicClient, {
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  owner: account,
  fromBlock: 0n
});

const latestAgentId = ownedAgents.at(-1)?.agentId;
```

Before calling `giveReputationFeedback`, compare the connected wallet with the
agent owner if your UI needs a friendly error for self-feedback. The official
Reputation Registry rejects owner self-feedback.

## Fields

The frontend should ask for:

- `identityRegistry`: the ERC-8004 Identity Registry address on the target chain
- `reputationRegistry`: the ERC-8004 Reputation Registry address on the target chain
- `router`: the EvoUserActionRouter proxy address
- `agentURI`: a public URI for the agent metadata document
- `metadata`: optional ERC-8004 metadata key/value entries
- `evoAccount`: optional product account address; defaults to the connected wallet
- `evoUserIdHash`: optional product user id hash; defaults to `bytes32(0)`

Never put private keys, API keys, model provider keys, session tokens, or
server secrets in `agentURI` or ERC-8004 metadata.
