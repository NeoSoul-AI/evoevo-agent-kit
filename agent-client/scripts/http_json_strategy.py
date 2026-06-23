#!/usr/bin/env python3

import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any


def getenv_required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def getenv_int(name: str, default: int) -> int:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    return int(raw)


def load_input() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        raise RuntimeError("strategy context is empty")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise RuntimeError("strategy context must be a JSON object")
    return payload


def render_prompt_template(payload: dict[str, Any]) -> str:
    template_file = os.environ.get("HTTP_JSON_STRATEGY_PROMPT_FILE", "").strip()
    if not template_file:
        return json.dumps(payload, ensure_ascii=True, indent=2)
    with open(template_file, "r", encoding="utf-8") as fh:
        template = fh.read()
    return apply_text_placeholders(template, payload)


def apply_text_placeholders(template: str, payload: dict[str, Any]) -> str:
    replacements = {
        "{{CONTEXT_JSON}}": json.dumps(payload, ensure_ascii=True, indent=2),
        "{{AGENT_JSON}}": json.dumps(payload.get("agent", {}), ensure_ascii=True, indent=2),
        "{{CANDIDATE_JSON}}": json.dumps(payload.get("candidate", {}), ensure_ascii=True, indent=2),
    }
    rendered = template
    for key, value in replacements.items():
        rendered = rendered.replace(key, value)
    return rendered


def build_request_body(payload: dict[str, Any]) -> Any:
    template_file = os.environ.get("HTTP_JSON_STRATEGY_TEMPLATE_FILE", "").strip()
    if not template_file:
        return payload

    with open(template_file, "r", encoding="utf-8") as fh:
        template = fh.read()

    compact_context = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    compact_agent = json.dumps(payload.get("agent", {}), ensure_ascii=True, separators=(",", ":"))
    compact_candidate = json.dumps(payload.get("candidate", {}), ensure_ascii=True, separators=(",", ":"))
    prompt_string = json.dumps(render_prompt_template(payload), ensure_ascii=True)

    rendered = (
        template.replace("__INPUT_JSON__", compact_context)
        .replace("__AGENT_JSON__", compact_agent)
        .replace("__CANDIDATE_JSON__", compact_candidate)
        .replace("__INPUT_PROMPT_JSON_STRING__", prompt_string)
    )
    return json.loads(rendered)


def build_headers() -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    raw_headers = os.environ.get("HTTP_JSON_STRATEGY_HEADERS_JSON", "").strip()
    if raw_headers:
        decoded = json.loads(raw_headers)
        if not isinstance(decoded, dict):
            raise RuntimeError("HTTP_JSON_STRATEGY_HEADERS_JSON must be a JSON object")
        for key, value in decoded.items():
            headers[str(key)] = str(value)

    bearer_token = os.environ.get("HTTP_JSON_STRATEGY_BEARER_TOKEN", "").strip()
    if bearer_token:
        headers["Authorization"] = f"Bearer {bearer_token}"
    return headers


def call_http_strategy(payload: dict[str, Any]) -> Any:
    url = getenv_required("HTTP_JSON_STRATEGY_URL")
    method = os.environ.get("HTTP_JSON_STRATEGY_METHOD", "POST").strip().upper() or "POST"
    timeout = getenv_int("HTTP_JSON_STRATEGY_TIMEOUT_SECONDS", 60)

    body = json.dumps(build_request_body(payload), ensure_ascii=True).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method, headers=build_headers())
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"http json strategy request failed with {err.code}: {detail}") from err


def extract_by_path(payload: Any, path: str) -> Any:
    current = payload
    if not path:
        return current
    for part in path.split("."):
        if isinstance(current, list):
            current = current[int(part)]
            continue
        if not isinstance(current, dict):
            raise RuntimeError(f"response path {path!r} is invalid at {part!r}")
        current = current[part]
    return current


def parse_json_object(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    if not raw:
        raise RuntimeError("strategy response is empty")
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise RuntimeError(f"strategy response is not JSON: {raw}")
        decoded = json.loads(match.group(0))
    if not isinstance(decoded, dict):
        raise RuntimeError("strategy response must be a JSON object")
    return decoded


def decode_result_node(response: Any) -> dict[str, Any]:
    path = os.environ.get("HTTP_JSON_STRATEGY_RESPONSE_PATH", "").strip()
    node = extract_by_path(response, path)
    if isinstance(node, dict):
        return node
    if isinstance(node, str):
        return parse_json_object(node)
    raise RuntimeError("strategy response node must be a JSON object or JSON string")


def valid_option_keys(candidate: dict[str, Any]) -> set[str]:
    keys: set[str] = set()
    for option in candidate.get("options", []):
        if isinstance(option, dict):
            key = str(option.get("key", "")).strip()
            if key:
                keys.add(key)
    return keys


def normalize_result(candidate: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    if bool(result.get("skip")):
        return {"skip": True}

    content = str(result.get("content", "")).strip()
    stance = str(result.get("stance", "")).strip()
    if not content:
        raise RuntimeError("strategy result missing content")
    if not stance:
        raise RuntimeError("strategy result missing stance")

    allowed = valid_option_keys(candidate)
    if allowed and stance not in allowed:
        raise RuntimeError(f"strategy returned invalid stance {stance!r}; allowed: {sorted(allowed)}")

    confidence = int(result.get("confidence_score", 50))
    if confidence < 0 or confidence > 100:
        raise RuntimeError("confidence_score must be between 0 and 100")

    normalized = {
        "content": content,
        "stance": stance,
        "confidence_score": confidence,
        "reasoning_chain": result.get("reasoning_chain", {"source": "http_json_strategy"}),
    }
    memory = result.get("memory")
    if isinstance(memory, dict) and str(memory.get("content", "")).strip():
        normalized["memory"] = memory
    return normalized


def main() -> int:
    try:
        payload = load_input()
        candidate = payload.get("candidate", {})
        response = call_http_strategy(payload)
        result = decode_result_node(response)
        normalized = normalize_result(candidate, result)
        json.dump(normalized, sys.stdout, ensure_ascii=True)
        return 0
    except Exception as err:  # pylint: disable=broad-except
        print(f"[error] {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
