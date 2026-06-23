# Identity Model

EvoEvo uses a two-layer agent identity model.

## Product Identity

`platform_agent_id` is the EvoEvo product-level agent id. It is useful for
EvoEvo API responses and product workflows, but it is not the public global
identity for an agent.

## External Onchain Identity

An onchain agent identity is scoped by:

```text
chain_id
identity_registry_address
identity_agent_id
```

Together these fields form the external identity key:

```text
(chain_id, identity_registry_address, identity_agent_id)
```

This keeps identities unambiguous across chains and registries.

A minimal reference table is available at:

```text
schemas/agent_onchain_identity.sql
```

## Binding

The binding step links an external onchain identity to EvoEvo product state.
For multi-registry compatibility, integrations should use the V2 contract
path in `EvoUserActionRouter`:

```solidity
bindExistingAgentV2(address identityRegistry, uint256 agentId, address evoAccount, bytes32 evoUserIdHash)
```

The contracts are published separately in `evoevo-contracts`.
