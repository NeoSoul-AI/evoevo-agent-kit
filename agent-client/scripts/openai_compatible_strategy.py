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


def getenv_float(name: str, default: float) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    return float(raw)


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


def load_system_prompt() -> str:
    prompt_file = os.environ.get("OPENAI_COMPAT_SYSTEM_PROMPT_FILE", "").strip()
    if prompt_file:
        with open(prompt_file, "r", encoding="utf-8") as fh:
            return fh.read().strip()
    return (
        "You are an EvoEvo agent strategy adapter. "
        "Given an agent profile and a prediction candidate, return one compact JSON object only. "
        "Choose exactly one valid stance from the candidate options. "
        "Return fields: content (string), stance (string), confidence_score (integer 0-100), "
        "reasoning_chain (object), optional memory (object with content/meta/note), optional skip (boolean). "
        "Do not return markdown or prose outside JSON."
    )


def build_user_prompt(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=True, indent=2)


def build_request_body(payload: dict[str, Any]) -> dict[str, Any]:
    model = getenv_required("OPENAI_COMPAT_MODEL")
    temperature = getenv_float("OPENAI_COMPAT_TEMPERATURE", 0.2)
    max_tokens = getenv_int("OPENAI_COMPAT_MAX_TOKENS", 700)
    return {
        "model": model,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": load_system_prompt()},
            {"role": "user", "content": build_user_prompt(payload)},
        ],
    }


def call_openai_compatible_api(payload: dict[str, Any]) -> dict[str, Any]:
    base_url = getenv_required("OPENAI_COMPAT_BASE_URL").rstrip("/")
    api_path = os.environ.get("OPENAI_COMPAT_PATH", "/v1/chat/completions").strip() or "/v1/chat/completions"
    timeout = getenv_int("OPENAI_COMPAT_TIMEOUT_SECONDS", 60)
    api_key = os.environ.get("OPENAI_COMPAT_API_KEY", "").strip()

    body = json.dumps(build_request_body(payload)).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(base_url + api_path, data=body, method="POST", headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"openai-compatible request failed with {err.code}: {detail}") from err


def extract_text_content(response: dict[str, Any]) -> str:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("openai-compatible response missing choices")
    message = choices[0].get("message", {})
    content = message.get("content")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_parts.append(str(item.get("text", "")))
        if text_parts:
            return "\n".join(text_parts).strip()
    raise RuntimeError("openai-compatible response missing message content")


def parse_json_object(raw: str) -> dict[str, Any]:
    raw = raw.strip()
    if not raw:
        raise RuntimeError("model returned empty content")
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise RuntimeError(f"model did not return JSON: {raw}")
        decoded = json.loads(match.group(0))
    if not isinstance(decoded, dict):
        raise RuntimeError("model output must be a JSON object")
    return decoded


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
        raise RuntimeError("model output missing content")
    if not stance:
        raise RuntimeError("model output missing stance")

    allowed = valid_option_keys(candidate)
    if allowed and stance not in allowed:
        raise RuntimeError(f"model returned invalid stance {stance!r}; allowed: {sorted(allowed)}")

    confidence = int(result.get("confidence_score", 50))
    if confidence < 0 or confidence > 100:
        raise RuntimeError("confidence_score must be between 0 and 100")

    normalized = {
        "content": content,
        "stance": stance,
        "confidence_score": confidence,
        "reasoning_chain": result.get("reasoning_chain", {"source": "openai_compatible_strategy"}),
    }
    memory = result.get("memory")
    if isinstance(memory, dict) and str(memory.get("content", "")).strip():
        normalized["memory"] = memory
    return normalized


def main() -> int:
    try:
        payload = load_input()
        candidate = payload.get("candidate", {})
        response = call_openai_compatible_api(payload)
        content = extract_text_content(response)
        result = parse_json_object(content)
        normalized = normalize_result(candidate, result)
        json.dump(normalized, sys.stdout, ensure_ascii=True)
        return 0
    except Exception as err:  # pylint: disable=broad-except
        print(f"[error] {err}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
