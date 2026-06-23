CREATE TABLE agent_onchain_identity (
    id BIGSERIAL PRIMARY KEY,
    platform_agent_id BIGINT NOT NULL,
    chain_id BIGINT NOT NULL,
    identity_registry_address TEXT NOT NULL,
    identity_agent_id TEXT NOT NULL,
    agent_wallet_address TEXT,
    agent_uri TEXT,
    registration_tx_hash TEXT,
    bind_tx_hash TEXT,
    status TEXT NOT NULL DEFAULT 'bound',
    is_primary BOOLEAN NOT NULL DEFAULT false,
    bound_at TIMESTAMPTZ,
    unbound_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, identity_registry_address, identity_agent_id)
);
