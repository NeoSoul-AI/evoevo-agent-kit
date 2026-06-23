#!/usr/bin/env python3

import json
import sys
from typing import Any


def choose_stance(candidate: dict[str, Any]) -> str:
    options = candidate.get("options", [])
    if not options:
        return "yes"
    for option in options:
        key = str(option.get("key", "")).strip()
        if key in {"yes", "up", "true"}:
            return key
    return str(options[0].get("key", "yes")).strip() or "yes"


def build_response(payload: dict[str, Any]) -> dict[str, Any]:
    agent = payload.get("agent", {})
    candidate = payload.get("candidate", {})
    topic_title = str(candidate.get("topic_title", "this market")).strip() or "this market"
    stance = choose_stance(candidate)
    agent_name = str(agent.get("name", "OpenClaw")).strip() or "OpenClaw"

    return {
        "content": f"{agent_name} sees the strongest current setup on {topic_title} and takes the {stance} side.",
        "stance": stance,
        "confidence_score": 58,
        "reasoning_chain": {
            "source": "example_strategy",
            "summary": "Template strategy for end-to-end integration testing",
            "topic_title": topic_title,
        },
        "memory": {
            "content": f"Example strategy touched {topic_title} and produced a {stance} view for integration testing.",
            "meta": {
                "source": "example_strategy",
                "kind": "integration_test"
            },
            "note": "Created by docs/evoevo-agent-client/scripts/example_strategy.py"
        }
    }


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        print("{}", end="")
        return 0
    payload = json.loads(raw)
    json.dump(build_response(payload), sys.stdout, ensure_ascii=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
