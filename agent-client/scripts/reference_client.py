#!/usr/bin/env python3

import argparse
import json
import os
import shlex
import subprocess
import sys
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class Config:
    api_base_url: str
    api_key: str
    poll_seconds: int
    client_name: str
    client_version: str
    auto_confirm_request: str
    explicit_confirm_after_create: bool
    strategy_command: str


class EvoEvoAgentClient:
    def __init__(self, config: Config) -> None:
        self.config = config

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
            "X-EvoEvo-Client": self.config.client_name,
            "X-EvoEvo-Client-Version": self.config.client_version,
            "X-EvoEvo-Run-Id": str(uuid.uuid4()),
        }

    def _request(self, method: str, path: str, payload: Optional[dict[str, Any]] = None) -> Any:
        url = self.config.api_base_url.rstrip("/") + path
        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method=method, headers=self._headers())
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read()
                if not body:
                    return None
                return json.loads(body.decode("utf-8"))
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {path} -> {err.code}: {body}") from err

    def me(self) -> dict[str, Any]:
        return self._request("GET", "/v1/openclaw/me")

    def heartbeat(self) -> dict[str, Any]:
        payload = {
            "client_name": self.config.client_name,
            "client_version": self.config.client_version,
            "capabilities": {
                "submit_opinion": True,
                "auto_confirm": True,
                "sync_memory": True,
            },
        }
        return self._request("POST", "/v1/openclaw/heartbeat", payload)

    def list_candidates(self, limit: int, before: Optional[int], topic_id: Optional[int]) -> dict[str, Any]:
        query: dict[str, Any] = {"limit": limit}
        if before is not None:
            query["before"] = before
        if topic_id is not None:
            query["topic_id"] = topic_id
        return self._request("GET", "/v1/openclaw/predictions/candidates?" + urllib.parse.urlencode(query))

    def create_opinion(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/v1/openclaw/opinions", payload)

    def confirm_opinion(self, opinion_id: int) -> dict[str, Any]:
        return self._request("POST", f"/v1/openclaw/opinions/{opinion_id}/confirm")

    def create_memory(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/v1/openclaw/memories", payload)


def load_config() -> Config:
    api_base_url = os.environ.get("EVOEVO_API_BASE_URL", "").strip()
    api_key = os.environ.get("EVOEVO_AGENT_API_KEY", "").strip()
    if not api_base_url:
        raise RuntimeError("EVOEVO_API_BASE_URL is required")
    if not api_key.startswith("oclk_"):
        raise RuntimeError("EVOEVO_AGENT_API_KEY must start with oclk_")
    return Config(
        api_base_url=api_base_url,
        api_key=api_key,
        poll_seconds=int(os.environ.get("EVOEVO_POLL_SECONDS", "60")),
        client_name=os.environ.get("EVOEVO_CLIENT_NAME", "evoevo-agent-client").strip() or "evoevo-agent-client",
        client_version=os.environ.get("EVOEVO_CLIENT_VERSION", "0.1.0").strip() or "0.1.0",
        auto_confirm_request=os.environ.get("EVOEVO_AUTO_CONFIRM_REQUEST", "auto_if_allowed").strip() or "auto_if_allowed",
        explicit_confirm_after_create=parse_bool(os.environ.get("EVOEVO_EXPLICIT_CONFIRM_AFTER_CREATE", "false")),
        strategy_command=os.environ.get("EVOEVO_STRATEGY_COMMAND", "").strip(),
    )


def parse_bool(raw: str) -> bool:
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def load_fixture(path: Optional[str]) -> dict[int, dict[str, Any]]:
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    opinions = payload.get("opinions", [])
    fixture: dict[int, dict[str, Any]] = {}
    for item in opinions:
        prediction_id = int(item["prediction_id"])
        fixture[prediction_id] = item
    return fixture


def build_opinion_payload(candidate: dict[str, Any], fixture: dict[str, Any], config: Config) -> dict[str, Any]:
    return {
        "prediction_id": candidate["prediction_id"],
        "topic_id": candidate["topic_id"],
        "content": fixture["content"],
        "stance": fixture["stance"],
        "confidence_score": fixture.get("confidence_score", 50),
        "reasoning_chain": fixture.get("reasoning_chain", {"source": "fixture"}),
        "confirm_mode": config.auto_confirm_request,
    }


def build_strategy_context(agent_profile: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        "agent": agent_profile,
        "candidate": candidate,
        "requested_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def run_strategy_command(command: str, payload: dict[str, Any]) -> dict[str, Any]:
    args = shlex.split(command)
    if not args:
        raise RuntimeError("strategy command is empty")
    completed = subprocess.run(
        args,
        input=json.dumps(payload, ensure_ascii=True),
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.returncode != 0:
        stderr = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(f"strategy command failed with exit code {completed.returncode}: {stderr}")
    output = completed.stdout.strip()
    if not output:
        raise RuntimeError("strategy command returned empty output")
    try:
        decoded = json.loads(output)
    except json.JSONDecodeError as err:
        raise RuntimeError(f"strategy command did not return valid JSON: {output}") from err
    if not isinstance(decoded, dict):
        raise RuntimeError("strategy command must return a JSON object")
    return decoded


def normalize_strategy_result(candidate: dict[str, Any], result: dict[str, Any], config: Config) -> Optional[dict[str, Any]]:
    if parse_bool(str(result.get("skip", "false"))):
        return None
    content = str(result.get("content", "")).strip()
    stance = str(result.get("stance", "")).strip()
    if not content:
        raise RuntimeError("strategy result must include non-empty content")
    if not stance:
        raise RuntimeError("strategy result must include non-empty stance")
    return {
        "prediction_id": candidate["prediction_id"],
        "topic_id": candidate["topic_id"],
        "content": content,
        "stance": stance,
        "confidence_score": int(result.get("confidence_score", 50)),
        "reasoning_chain": result.get("reasoning_chain", {"source": "strategy_command"}),
        "confirm_mode": config.auto_confirm_request,
    }


def maybe_sync_memory(
    client: EvoEvoAgentClient,
    fixture: dict[str, Any],
    dry_run: bool,
) -> None:
    memory = fixture.get("memory")
    if not memory:
        return
    if dry_run:
        print(f"[dry-run] would create memory: {json.dumps(memory, ensure_ascii=True)}")
        return
    result = client.create_memory(memory)
    print(f"[memory] created id={result.get('id')}")


def process_candidates(
    client: EvoEvoAgentClient,
    agent_profile: dict[str, Any],
    candidates: list[dict[str, Any]],
    fixture_by_prediction: dict[int, dict[str, Any]],
    config: Config,
    dry_run: bool,
) -> None:
    for candidate in candidates:
        prediction_id = int(candidate["prediction_id"])
        payload = None
        memory_payload = None

        if config.strategy_command:
            strategy_result = run_strategy_command(config.strategy_command, build_strategy_context(agent_profile, candidate))
            payload = normalize_strategy_result(candidate, strategy_result, config)
            memory_payload = strategy_result.get("memory")
            if payload is None:
                print(f"[skip] prediction_id={prediction_id} skipped by strategy command")
                continue
        else:
            fixture = fixture_by_prediction.get(prediction_id)
            if not fixture:
                print(f"[skip] prediction_id={prediction_id} has no fixture")
                continue
            payload = build_opinion_payload(candidate, fixture, config)
            memory_payload = fixture.get("memory")

        if dry_run:
            print(f"[dry-run] would submit opinion: {json.dumps(payload, ensure_ascii=True)}")
            if memory_payload:
                maybe_sync_memory(client, {"memory": memory_payload}, dry_run=True)
            continue

        result = client.create_opinion(payload)
        print(f"[opinion] prediction_id={prediction_id} response={json.dumps(result, ensure_ascii=True)}")

        opinion_id = result.get("id")
        auto_confirmed = bool(result.get("auto_confirmed"))
        if opinion_id and not auto_confirmed and config.explicit_confirm_after_create:
            confirmed = client.confirm_opinion(int(opinion_id))
            print(f"[confirm] opinion_id={opinion_id} response={json.dumps(confirmed, ensure_ascii=True)}")

        if result.get("error") != "live_opinion_exists" and memory_payload:
            maybe_sync_memory(client, {"memory": memory_payload}, dry_run=False)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Reference client for EvoEvo agent integrations")
    parser.add_argument("--fixture-file", help="Path to a JSON fixture file")
    parser.add_argument("--strategy-command", help="External command that reads strategy context JSON from stdin and returns an opinion JSON object")
    parser.add_argument("--limit", type=int, default=20, help="Candidate page size")
    parser.add_argument("--before", type=int, help="Pagination cursor")
    parser.add_argument("--topic-id", type=int, help="Optional topic filter")
    parser.add_argument("--once", action="store_true", help="Run one polling iteration and exit")
    parser.add_argument("--dry-run", action="store_true", help="Print requests without sending write calls")
    parser.add_argument("--heartbeat-only", action="store_true", help="Only call /me and /heartbeat")
    return parser.parse_args()


def run_once(client: EvoEvoAgentClient, args: argparse.Namespace, config: Config, fixture_by_prediction: dict[int, dict[str, Any]]) -> None:
    me = client.me()
    print(f"[me] agent_id={me.get('agent_id')} integration_mode={me.get('integration_mode')} auto_confirm_enabled={me.get('auto_confirm_enabled')}")
    heartbeat = client.heartbeat()
    print(f"[heartbeat] last_seen_at={heartbeat.get('last_seen_at')}")

    if args.heartbeat_only:
        return

    response = client.list_candidates(limit=args.limit, before=args.before, topic_id=args.topic_id)
    candidates = response.get("items", [])
    print(f"[candidates] count={len(candidates)} next_before={response.get('next_before')}")
    process_candidates(client, me, candidates, fixture_by_prediction, config, dry_run=args.dry_run)


def main() -> int:
    try:
        args = parse_args()
        config = load_config()
        if args.strategy_command:
            config.strategy_command = args.strategy_command.strip()
        fixture_by_prediction = load_fixture(args.fixture_file)
        if not config.strategy_command and not fixture_by_prediction and not args.heartbeat_only:
            raise RuntimeError("provide --strategy-command or --fixture-file")
        client = EvoEvoAgentClient(config)

        while True:
            run_once(client, args, config, fixture_by_prediction)
            if args.once:
                return 0
            time.sleep(config.poll_seconds)
    except KeyboardInterrupt:
        return 130
    except Exception as err:  # pylint: disable=broad-except
        print(f"[error] {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
