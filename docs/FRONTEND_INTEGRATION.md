# Frontend Integration

This is the public part of the EvoEvo ERC-8004 flow that a developer frontend
can copy.

## How EvoEvo Uses ERC-8004

EvoEvo uses the public ERC-8004 Identity Registry as the agent identity layer.
The product and contract layers then reference the agent by:

```text
(chain_id, identity_registry_address, identity_agent_id)
```

In the product flow:

1. The frontend prepares an ERC-8004 registration file and publishes it as
   `agentURI`.
2. The user wallet calls `register(agentURI, metadata)` on the ERC-8004
   Identity Registry.
3. The frontend reads `agentId` from the `Registered` event.
4. The frontend calls EvoEvo's `bindExistingAgentV2` entrypoint through
   `EvoUserActionRouter`.
5. EvoEvo stores the external identity key and can safely associate product
   actions with that onchain identity.

## 0G Mainnet Addresses

Current EvoEvo production addresses on 0G mainnet:

| Contract | Address |
| --- | --- |
| ERC-8004 Identity Registry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| EvoBindingRegistry | `0x1C00a704f9Ca2629F720573B98F97428a33f29eF` |
| EvoEvolutionRegistry | `0xA0987Bdef2f2C6CC32C462eF3E1C67a8d094253b` |
| EvoUserActionRouter | `0x61bb71442749d13a4BB7257DfBFFf0452ae937f9` |
| EvoPredictionRegistry | `0xe1345E13b3E3A11d2351DbF0E257f145f25e32aE` |
| EvoCommitteeOracle | `0x5fF602FDFEB87de4D5B8fdF3999DFEeb4C794414` |

The legacy self-hosted 0G identity registry is still supported for existing
agents:

```text
0x8004Ae533a0301CbD7508373b663756D26DfB028
```

## Frontend Fields

Ask the developer or user for:

| Field | Meaning |
| --- | --- |
| `chainId` | EVM chain id where the ERC-8004 identity lives |
| `identityRegistry` | ERC-8004 Identity Registry contract address |
| `router` | EvoUserActionRouter proxy address |
| `agentURI` | Public metadata URI for the agent |
| `metadata` | Optional key/value metadata written to ERC-8004 |
| `evoAccount` | Optional EvoEvo account address; defaults to connected wallet |
| `evoUserIdHash` | Optional product user id hash; defaults to `bytes32(0)` |

Do not put secrets in `agentURI` or metadata.

## Suggested ERC-8004 `agentURI` Document

The URI can point to HTTPS, IPFS, or another durable public location.

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Example Forecast Agent",
  "description": "Submits prediction opinions through EvoEvo Agent Kit.",
  "image": "https://example.com/agent.png",
  "homepage": "https://example.com",
  "services": [
    {
      "name": "Agent Card",
      "type": "A2A",
      "url": "https://example.com/.well-known/agent-card.json"
    },
    {
      "name": "EvoEvo OpenClaw Adapter",
      "type": "https",
      "url": "https://example.com/evoevo/openclaw"
    }
  ],
  "registrations": [
    {
      "agentId": "123",
      "agentRegistry": "eip155:16661:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    }
  ],
  "supportedTrust": [
    {
      "type": "evoevo-prediction-performance",
      "description": "Prediction judgements and committee settlement signals from EvoEvo."
    }
  ],
  "capabilities": [
    "prediction-opinion",
    "memory-sync",
    "reasoning-commitment"
  ],
  "source": "https://github.com/NeoSoul-AI/evoevo-agent-kit"
}
```

If the final registration file needs to include the assigned `agentId`, use a
two-step flow:

1. publish a provisional registration file and call `register`
2. read `agentId` from the `Registered` event
3. publish the final registration file with `registrations[0].agentId`
4. call `setAgentURI(agentId, finalURI)` on the ERC-8004 Identity Registry

## Contract Calls

Register the agent on the ERC-8004 Identity Registry:

```solidity
register(string agentURI, MetadataEntry[] metadata)
```

Bind the registered identity into EvoEvo:

```solidity
bindExistingAgentV2(
  address identityRegistry,
  uint256 agentId,
  address evoAccount,
  bytes32 evoUserIdHash
)
```

The connected wallet must own the ERC-8004 agent or be approved by the owner.

## Sample

See:

```text
examples/frontend-register-and-bind
```

The sample uses the SDK in:

```text
frontend-sdk
```
