import json
import os
import re
from pathlib import Path

TOKEN_FIELDS = {
    "input_tokens": ["input_tokens", "inputTokens"],
    "output_tokens": ["output_tokens", "outputTokens"],
    "cache_read_tokens": ["cache_read_input_tokens", "cacheReadInputTokens"],
    "cache_write_tokens": ["cache_creation_input_tokens", "cacheCreationInputTokens"],
}

def first(obj, keys, default=None):
    if not isinstance(obj, dict):
        return default
    for k in keys:
        if obj.get(k) is not None:
            return obj[k]
    return default

def text_of_content(content):
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    out = []
    for b in content:
        if not isinstance(b, dict):
            continue
        if b.get("type") == "text" and isinstance(b.get("text"), str):
            out.append(b["text"])
        elif b.get("type") == "tool_result":
            c = b.get("content")
            if isinstance(c, str):
                out.append(c)
            elif isinstance(c, list):
                out.extend(x["text"] for x in c if isinstance(x, dict) and isinstance(x.get("text"), str))
    return "\n".join(out)

def extract_usage(obj):
    msg = obj.get("message") if isinstance(obj.get("message"), dict) else obj
    usage = msg.get("usage") if isinstance(msg, dict) and isinstance(msg.get("usage"), dict) else {}
    vals = {name: int(first(usage, keys, 0) or 0) for name, keys in TOKEN_FIELDS.items()}
    vals["total_tokens"] = sum(vals.values())
    vals["cost_usd"] = float(first(usage, ["cost_usd", "costUSD"], 0) or 0)
    vals["model"] = first(msg, ["model", "canonicalModel"], "") or ""
    vals["context_window"] = int(first(usage, ["context_window", "contextWindow"], 0) or 0)
    vals["max_output_tokens"] = int(first(usage, ["max_output_tokens", "maxOutputTokens"], 0) or 0)
    vals["provider"] = first(msg, ["provider"], "") or ""
    return vals

def _walk_strings(value):
    if isinstance(value, dict):
        for k, v in value.items():
            yield str(k), v
            yield from _walk_strings(v)
    elif isinstance(value, list):
        for x in value:
            yield from _walk_strings(x)

def detect_client(path="", obj=None):
    # Best-effort classification. Claude Code does not always expose a canonical IDE field.
    s = (str(path) + " " + json.dumps(obj or {}, ensure_ascii=False)[:12000]).lower()
    if "windsurf" in s:
        return "Windsurf · Claude Code"
    if "cursor" in s:
        return "Cursor · Claude Code"
    if "jetbrains" in s or "idea.properties" in s or "intellij" in s:
        return "JetBrains · Claude Code"
    if "visual studio code" in s or "vscode" in s or "code.exe" in s:
        return "VS Code · Claude Code"
    if os.name == "nt" and ("terminal" in s or "cmd.exe" in s or "powershell" in s):
        return "Claude Code · Windows Terminal"
    return "Claude Code · Terminal/CLI"

PATH_KEYS = {
    "file_path", "filepath", "path", "file", "filename", "notebook_path",
    "directory", "dir", "folder", "cwd", "working_directory"
}

def normalize_path(v, cwd=None):
    if not isinstance(v, str) or not v.strip():
        return None
    v = v.strip()
    if v.startswith("file://"):
        v = v[7:]
    try:
        p = Path(v).expanduser()
        if not p.is_absolute() and cwd:
            p = Path(cwd) / p
        return str(p.resolve(strict=False))
    except Exception:
        return v

def extract_paths(value, cwd=None):
    found = []
    if isinstance(value, dict):
        for k, v in value.items():
            kl = str(k).lower()
            if kl in PATH_KEYS and isinstance(v, str):
                p = normalize_path(v, cwd)
                if p:
                    found.append(p)
            found.extend(extract_paths(v, cwd))
    elif isinstance(value, list):
        for x in value:
            found.extend(extract_paths(x, cwd))
    return list(dict.fromkeys(found))

def classify_path(path):
    if not path:
        return "[unattributed]"
    parts = [p.lower() for p in Path(path).parts]
    for item in ["node_modules", ".next", ".git", "dist", "build", "coverage", ".venv", "venv", "__pycache__"]:
        if item in parts:
            return item
    return Path(path).suffix.lower() or "[no extension]"

def project_key(cwd=None, transcript_path=None, projects_dir=None):
    if cwd:
        try:
            return str(Path(cwd).resolve(strict=False))
        except Exception:
            return str(cwd)
    if transcript_path and projects_dir:
        try:
            return str(Path(transcript_path).relative_to(Path(projects_dir)).parts[0])
        except Exception:
            pass
    return "unknown"

def project_name(cwd=None, transcript_path=None, projects_dir=None):
    key = project_key(cwd, transcript_path, projects_dir)
    if key == "unknown":
        return key
    return Path(key).name or key

def safe_preview(text, limit=1200):
    return re.sub(r"\s+", " ", text or "").strip()[:limit]
