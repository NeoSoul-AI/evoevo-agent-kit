export const erc8004IdentityRegistryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentURI", type: "string" },
      {
        name: "metadata",
        type: "tuple[]",
        components: [
          { name: "metadataKey", type: "string" },
          { name: "metadataValue", type: "bytes" }
        ]
      }
    ],
    outputs: [{ name: "agentId", type: "uint256" }]
  },
  {
    type: "function",
    name: "setAgentURI",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "setMetadata",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "metadataKey", type: "string" },
      { name: "metadataValue", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "setAgentWallet",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newWallet", type: "address" },
      { name: "deadline", type: "uint256" },
      { name: "authorization", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "getAgentWallet",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "event",
    name: "Registered",
    anonymous: false,
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true }
    ]
  },
  {
    type: "event",
    name: "URIUpdated",
    anonymous: false,
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "newURI", type: "string", indexed: false },
      { name: "updatedBy", type: "address", indexed: true }
    ]
  },
  {
    type: "event",
    name: "MetadataSet",
    anonymous: false,
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "indexedMetadataKey", type: "string", indexed: true },
      { name: "metadataKey", type: "string", indexed: false },
      { name: "metadataValue", type: "bytes", indexed: false }
    ]
  }
] as const;

export const erc8004ReputationRegistryAbi = [
  {
    type: "function",
    name: "getIdentityRegistry",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    name: "giveFeedback",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "revokeFeedback",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "feedbackIndex", type: "uint64" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "readFeedback",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "clientAddress", type: "address" },
      { name: "feedbackIndex", type: "uint64" }
    ],
    outputs: [
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "isRevoked", type: "bool" }
    ]
  },
  {
    type: "event",
    name: "NewFeedback",
    anonymous: false,
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: false },
      { name: "value", type: "int128", indexed: false },
      { name: "valueDecimals", type: "uint8", indexed: false },
      { name: "indexedTag1", type: "string", indexed: true },
      { name: "tag1", type: "string", indexed: false },
      { name: "tag2", type: "string", indexed: false },
      { name: "endpoint", type: "string", indexed: false },
      { name: "feedbackURI", type: "string", indexed: false },
      { name: "feedbackHash", type: "bytes32", indexed: false }
    ]
  },
  {
    type: "event",
    name: "FeedbackRevoked",
    anonymous: false,
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "clientAddress", type: "address", indexed: true },
      { name: "feedbackIndex", type: "uint64", indexed: true }
    ]
  }
] as const;

export const evoUserActionRouterAbi = [
  {
    type: "function",
    name: "bindExistingAgentV2",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityRegistry", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "evoAccount", type: "address" },
      { name: "evoUserIdHash", type: "bytes32" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "intakeReasoningV2",
    stateMutability: "nonpayable",
    inputs: [
      { name: "identityRegistry", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "sourceOpinionId", type: "uint256" },
      { name: "reasoningHash", type: "bytes32" },
      { name: "opinionHash", type: "bytes32" },
      { name: "newMemoryRoot", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "judgeV2",
    stateMutability: "nonpayable",
    inputs: [
      { name: "predictionId", type: "uint256" },
      { name: "identityRegistry", type: "address" },
      { name: "agentTokenId", type: "uint256" },
      { name: "agree", type: "bool" },
      { name: "opinionId", type: "uint256" }
    ],
    outputs: []
  }
] as const;

export const evoBindingRegistryAbi = [
  {
    type: "function",
    name: "isSupportedIdentityRegistry",
    stateMutability: "view",
    inputs: [{ name: "identityRegistry_", type: "address" }],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "isEvoBoundV2",
    stateMutability: "view",
    inputs: [
      { name: "identityRegistry_", type: "address" },
      { name: "agentId", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    name: "getBindingV2",
    stateMutability: "view",
    inputs: [
      { name: "identityRegistry_", type: "address" },
      { name: "agentId", type: "uint256" }
    ],
    outputs: [
      { name: "boundOwner", type: "address" },
      { name: "evoAccount", type: "address" },
      { name: "evoUserIdHash", type: "bytes32" },
      { name: "boundAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "active", type: "bool" },
      { name: "ownerStillMatches", type: "bool" }
    ]
  }
] as const;
