# Frontend Register And Bind Sample

This Vite sample shows a wallet frontend for the public EvoEvo ERC-8004 flow:

1. connect wallet
2. call `register(agentURI, metadata)` on an ERC-8004 Identity Registry
3. parse the `Registered` event to get `agentId`
4. call `bindExistingAgentV2` on EvoUserActionRouter

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
- `EvoUserActionRouter`: EvoEvo router proxy address
- `Evo Account`: optional account associated with the product identity
- `Evo User ID`: optional product user id; the sample hashes it client-side
- `Agent URI`: public metadata URI passed to ERC-8004

Do not put secrets in the agent URI or metadata.
