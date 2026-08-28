#!/usr/bin/env python3
"""Build a compact semantic-heat table from GloVe 50d.

For each daily secret, store a 0-100 heat for every guess-list word
using cosine similarity of GloVe vectors (not edit distance).
Exact matches are forced to 100.
"""
from __future__ import annotations

import gzip
import json
import re
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CHAIN_PATH = ROOT / "data" / "chain.json"
WORDS_OUT = ROOT / "data" / "words.json"
HEAT_OUT = ROOT / "data" / "heat.bin"
GLOVE_PATH = Path("/tmp/drift-data/glove-wiki-gigaword-50.gz")
COMMON_PATH = Path("/tmp/drift-data/google-10k.txt")

STOP = {
    "the", "and", "for", "you", "not", "are", "from", "was", "were", "have",
    "has", "had", "this", "that", "with", "they", "their", "what", "when",
    "which", "who", "how", "why", "where", "your", "our", "all", "any", "can",
    "will", "just", "but", "or", "if", "so", "than", "then", "also", "into",
    "out", "about", "over", "after", "before", "because", "while", "through",
    "could", "would", "should", "been", "being", "its", "it's", "dont", "didn't",
    "www", "http", "https", "html", "com", "org", "net", "pdf", "xml", "css",
    "js", "php", "sql", "rss", "url", "usa", "uk", "ny", "ca", "la", "tv",
    "pm", "am", "re", "ve", "ll", "st", "rd", "th", "etc", "eg", "ie", "vs",
}

PROPERISH = {
    "john", "david", "james", "robert", "michael", "paul", "mark", "mary",
    "jennifer", "linda", "barbara", "elizabeth", "susan", "joseph", "thomas",
    "charles", "daniel", "matthew", "anthony", "donald", "steven", "andrew",
    "kenneth", "george", "joshua", "kevin", "brian", "edward", "ronald",
    "america", "american", "americans", "canada", "canadian", "mexico",
    "china", "chinese", "japan", "japanese", "india", "indian", "france",
    "french", "germany", "german", "spain", "spanish", "italy", "italian",
    "london", "paris", "york", "texas", "california", "florida", "washington",
    "google", "microsoft", "apple", "amazon", "yahoo", "ebay", "walmart",
    "january", "february", "march", "april", "june", "july", "august",
    "september", "october", "november", "december", "monday", "tuesday",
    "wednesday", "thursday", "friday", "saturday", "sunday", "jan", "feb",
    "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
    "jesus", "bible", "christian", "islam", "islamic", "muslim",
}


def load_glove(path: Path) -> dict[str, np.ndarray]:
    vecs: dict[str, np.ndarray] = {}
    with gzip.open(path, "rt", encoding="utf-8", errors="ignore") as fh:
        header = fh.readline().split()
        # word2vec format: first line is "N dim"
        if len(header) == 2 and header[0].isdigit():
            pass
        else:
            # actually a glove line
            w, *nums = header
            if re.fullmatch(r"[a-z]+", w) and len(nums) >= 10:
                vecs[w] = np.fromiter((float(x) for x in nums), dtype=np.float32)
        for line in fh:
            parts = line.split()
            if len(parts) < 10:
                continue
            w = parts[0]
            if not re.fullmatch(r"[a-z]+", w):
                continue
            if not (3 <= len(w) <= 14):
                continue
            try:
                vecs[w] = np.fromiter((float(x) for x in parts[1:]), dtype=np.float32)
            except ValueError:
                continue
    return vecs


def load_common(path: Path) -> list[str]:
    words = []
    for line in path.read_text(encoding="utf-8").splitlines():
        w = line.strip().lower()
        if re.fullmatch(r"[a-z]{3,14}", w):
            words.append(w)
    return words


def cosine_matrix(guess_vecs: np.ndarray, secret_vecs: np.ndarray) -> np.ndarray:
    g = guess_vecs / np.clip(np.linalg.norm(guess_vecs, axis=1, keepdims=True), 1e-8, None)
    s = secret_vecs / np.clip(np.linalg.norm(secret_vecs, axis=1, keepdims=True), 1e-8, None)
    return g @ s.T  # [n_guess, n_secret]


def sim_to_heat(sim: np.ndarray) -> np.ndarray:
    """Map cosine similarity into a 0-99 scale; identity is applied later as 100.

    GloVe 50d typical: unrelated ~0.05-0.25, related ~0.35-0.6, near-synonym ~0.7+.
    Stretch that range so the thermometer is usable.
    """
    lo, hi = 0.02, 0.82
    x = (sim - lo) / (hi - lo)
    heat = np.rint(np.clip(x, 0.0, 0.99) * 100.0).astype(np.uint8)
    heat = np.clip(heat, 0, 99)
    return heat


def main() -> None:
    chain = json.loads(CHAIN_PATH.read_text())["words"]
    print("loading glove...")
    glove = load_glove(GLOVE_PATH)
    print("glove words kept", len(glove), "dim", next(iter(glove.values())).shape)

    missing = [w for w in chain if w not in glove]
    if missing:
        raise SystemExit(f"chain words missing from GloVe: {missing}")

    common = load_common(COMMON_PATH)
    guess = []
    seen = set()
    for w in common:
        if w in seen or w in STOP or w in PROPERISH:
            continue
        if w not in glove:
            continue
        seen.add(w)
        guess.append(w)

    extra = [
        "espresso", "latte", "mug", "cappuccino", "mocha", "kettle", "pasture",
        "chimney", "ceramic", "grape", "vine", "toast", "bulb", "wax", "kite",
        "sail", "honeycomb", "saucer", "thermos", "barista", "brew", "pantry", "flour", "icing", "saddle", "ivy", "soil",
    ]
    for w in chain + extra:
        if w in glove and w not in seen:
            seen.add(w)
            guess.append(w)

    # Keep a compact 2k-8k list: most common remaining, plus extras already added.
    # common list is frequency-sorted; we already skipped stop/proper.
    if len(guess) > 7500:
        # preserve chain + extras at the end; trim from the long tail of common
        must = set(chain + extra)
        head = [w for w in guess if w not in must][:7000]
        tail = [w for w in guess if w in must]
        guess = head + [w for w in tail if w not in head]
    guess = sorted(set(guess))
    print("guess list", len(guess))
    assert 2000 <= len(guess) <= 8000, len(guess)

    dim = next(iter(glove.values())).shape[0]
    gmat = np.stack([glove[w] for w in guess]).astype(np.float32)
    smat = np.stack([glove[w] for w in chain]).astype(np.float32)
    sims = cosine_matrix(gmat, smat)
    heat = sim_to_heat(sims)  # [n_guess, n_secret]

    index = {w: i for i, w in enumerate(guess)}
    for si, secret in enumerate(chain):
        heat[index[secret], si] = 100

    # layout for JS: secret-major, C order uint8 [n_secret * n_guess]
    table = np.ascontiguousarray(heat.T, dtype=np.uint8)
    HEAT_OUT.write_bytes(table.tobytes())
    WORDS_OUT.write_text(json.dumps(guess, indent=0) + "\n", encoding="utf-8")
    print("wrote", HEAT_OUT, "bytes", HEAT_OUT.stat().st_size)
    print("wrote", WORDS_OUT)

    # Fixture diagnostics for espresso (chain index 1)
    ei = chain.index("espresso")
    samples = ["coffee", "espresso", "latte", "mug", "tea", "milk", "cup",
               "library", "saddle", "bicycle", "mountain", "brew", "caffeine"]
    print("\nheat vs espresso:")
    for w in samples:
        if w in index:
            print(f"  {w:12s} {int(heat[index[w], ei]):3d}  sim={sims[index[w], ei]:.3f}")
        else:
            print(f"  {w:12s} NOT IN LIST")

    print("\nchain neighbor heats (word -> next):")
    for i, w in enumerate(chain):
        nxt = chain[(i + 1) % len(chain)]
        h = int(heat[index[w], chain.index(nxt)])
        print(f"  {w:12s} -> {nxt:12s}  {h}")


if __name__ == "__main__":
    main()
