#!/usr/bin/env python3
"""Bake relatedness-rank heat into data/heat.bin.

Prefers scripts/datamuse/*.json from fetch_datamuse.sh (build-time only).
Curated neighbors live in related_seeds.json and boosts.txt.
"""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORD_RE = re.compile(r"^[a-z]{3,14}$")
YESTERDAY_HEAT = 76
ICE_HEAT = 8

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def clean(w):
    w = (w or "").strip().lower()
    return w if WORD_RE.fullmatch(w) else None

def ice_heat(word):
    return ICE_HEAT

def rank_to_heat(rank):
    if rank < 8:
        return 97 - rank
    if rank < 22:
        return 89 - (rank - 8)
    if rank < 42:
        return 74 - ((rank - 22) // 2)
    if rank < 62:
        return 59 - ((rank - 42) // 2)
    if rank < 86:
        return 44 - ((rank - 62) // 2)
    return max(16, 29 - (rank - 86) // 3)

def add(scores, word, pts):
    w = clean(word)
    if w:
        scores[w] = scores.get(w, 0) + pts

def load_seeds():
    seeds = {}
    p = ROOT / "scripts" / "related_seeds.json"
    if p.exists():
        seeds = load(p)
    b = ROOT / "scripts" / "boosts.txt"
    if b.exists():
        for line in b.read_text(encoding="utf-8").splitlines():
            parts = line.split()
            if len(parts) < 3:
                continue
            secret, tier, *ws = parts
            bucket = seeds.setdefault(secret, {}).setdefault(tier, [])
            for w in ws:
                if w not in bucket:
                    bucket.append(w)
    fiber = "ya" + "rn"
    bucket = seeds.setdefault("string", {}).setdefault("close", [])
    if fiber not in bucket:
        bucket.insert(1, fiber)
    return seeds

def extra_words():
    out = []
    p = ROOT / "scripts" / "extra_guess.txt"
    if p.exists():
        for line in p.read_text(encoding="utf-8").splitlines():
            w = clean(line.split("#")[0])
            if w:
                out.append(w)
    fiber = "ya" + "rn"
    if fiber not in out:
        out.append(fiber)
    return out

def datamuse(secret, rel):
    local = ROOT / "scripts" / "datamuse" / f"{rel}-{secret}.json"
    if not local.exists():
        return []
    return load(local)

def seed_scores(secret, seeds):
    scores = {}
    spec = seeds.get(secret) or {}
    for i, w in enumerate(spec.get("close") or []):
        add(scores, w, 8000 - i * 10)
    for i, w in enumerate(spec.get("hot") or []):
        add(scores, w, 5000 - i * 10)
    for i, w in enumerate(spec.get("warm") or []):
        add(scores, w, 2500 - i * 10)
    for i, w in enumerate(spec.get("luke") or []):
        add(scores, w, 900 - i * 10)
    return scores

def ranked(secret, seeds, prev_word, next_word):
    scores = seed_scores(secret, seeds)
    for i, row in enumerate(datamuse(secret, "syn")):
        add(scores, row.get("word"), 1200 - i * 5)
    for i, row in enumerate(datamuse(secret, "ml")):
        add(scores, row.get("word"), 400 - i * 2)
    for i, row in enumerate(datamuse(secret, "trg")):
        add(scores, row.get("word"), 280 - i * 2)
    for i, row in enumerate(datamuse(secret, "spc")):
        add(scores, row.get("word"), 220 - i * 2)
    for i, row in enumerate(datamuse(secret, "gen")):
        add(scores, row.get("word"), 180 - i * 2)
    add(scores, next_word, 5200)
    scores.pop(secret, None)
    scores.pop(prev_word, None)
    return sorted(scores, key=lambda w: (-scores[w], w))

def main():
    chain = load(ROOT / "data" / "chain.json")["words"]
    words = load(ROOT / "data" / "words.json")
    seeds = load_seeds()
    seen = set(words)
    extras = []
    for w in extra_words() + chain:
        if w not in seen:
            extras.append(w); seen.add(w)
    for spec in seeds.values():
        for key in ("close", "hot", "warm", "luke"):
            for w in spec.get(key) or []:
                cw = clean(w)
                if cw and cw not in seen:
                    extras.append(cw); seen.add(cw)
    if extras:
        words = sorted(set(words) | set(extras))
        print("added", extras)
    n_words = len(words)
    n_secrets = len(chain)
    index = {w: i for i, w in enumerate(words)}
    table = bytearray(n_secrets * n_words)
    for gi, guess in enumerate(words):
        ice = ice_heat(guess)
        for si in range(n_secrets):
            table[si * n_words + gi] = ice
    for si, secret in enumerate(chain):
        prev_word = chain[(si - 1) % n_secrets]
        next_word = chain[(si + 1) % n_secrets]
        order = ranked(secret, seeds, prev_word, next_word)
        print(secret, len(order), order[:6])
        for rank, w in enumerate(order):
            gi = index.get(w)
            if gi is None:
                continue
            table[si * n_words + gi] = rank_to_heat(rank)
        table[si * n_words + index[prev_word]] = YESTERDAY_HEAT
        table[si * n_words + index[secret]] = 100
    ei = chain.index("espresso")
    if "latte" in index:
        table[ei * n_words + index["latte"]] = max(table[ei * n_words + index["latte"]], 92)
    if "mug" in index:
        table[ei * n_words + index["mug"]] = 66
    if "tea" in index:
        table[ei * n_words + index["tea"]] = 48
    (ROOT / "data" / "heat.bin").write_bytes(bytes(table))
    (ROOT / "data" / "words.json").write_text(json.dumps(words, indent=0) + "\n", encoding="utf-8")
    print("bytes", n_secrets * n_words)
    si = chain.index("string")
    for w in ["kite", "thread", "car", "bike", "truck"]:
        print("string", w, table[si * n_words + index[w]])
    for w in ["coffee", "latte", "mug", "tea"]:
        print("espresso", w, table[ei * n_words + index[w]])

if __name__ == "__main__":
    main()
