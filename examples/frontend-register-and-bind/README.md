# Frontend Register And Bind Sample

This Vite sample shows a wallet frontend for the public EvoEvo ERC-8004 flow:

1. connect wallet
2. call `register(agentURI, metadata)` on an ERC-8004 Identity Registry
3. parse the `Registered` event to get `agentId`
4. call `bindExistingAgentV2` on EvoUserActionRouter
5. optionally call `giveFeedback` on the ERC-8004 Reputation Registry

## Run

```bash
cd ../../frontend-sdk
pnpm install
pnpm build

cd ../examples/frontend-register-and-bind
pnpm install
pnpm dev
```

The sample uses the local SDK package through:

```text
file:../../frontend-sdk
```

## Fields

- `Chain ID`: target EVM chain id
- `ERC-8004 Identity Registry`: public identity registry address
- `ERC-8004 Reputation Registry`: public reputation registry address
- `EvoUserActionRouter`: EvoEvo router proxy address
- `Evo Account`: optional account associated with the product identity
- `Evo User ID`: optional product user id; the sample hashes it client-side
- `ERC-8004 Agent ID`: auto-filled after registration; paste an existing id to bind or give feedback without registering in this session
- `Scan From Block`: first block used when finding agents owned by the connected wallet
- `Agent URI`: ERC-8004 registration file URI passed to `register`
- `Feedback URI`: optional public evidence URI passed to `giveFeedback`

`Connect Wallet` and `Find My Agents` query the ERC-8004 `Registered` event
for the connected owner address. If agents are found, the latest `agentId` is
filled automatically.

For local demos, leave `Agent URI` blank and the sample will generate an inline
`data:application/json` URI from the current form values. For production, upload
the registration JSON to HTTPS, IPFS, or 0G Storage and paste that public URI.

Do not put secrets in the agent URI or metadata.
