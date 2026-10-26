"""Decision log in ChromaDB (store: .kb/). Usage:
  python scripts/kb.py add "<title>" "<what and why>" [--date YYYY-MM-DD]
  python scripts/kb.py search "<question>" [-n 5]
  python scripts/kb.py ingest   # (re)load every '###' entry of KNOWLEDGE.md
"""
import re
import sys
from datetime import date
from pathlib import Path

import chromadb

ROOT = Path(__file__).resolve().parent.parent
col = chromadb.PersistentClient(path=str(ROOT / ".kb")).get_or_create_collection("decisions")


def add(title, text, day):
    col.upsert(ids=[f"{day}:{title}"], documents=[f"{title}\n{text}"], metadatas=[{"title": title, "date": day}])
    print(f"saved: {day} {title}")


def ingest():
    day, n = None, 0
    parts = re.split(r"^(## .+|### .+)$", (ROOT / "KNOWLEDGE.md").read_text(encoding="utf-8"), flags=re.M)
    for head, body in zip(parts[1::2], parts[2::2]):
        if head.startswith("### "):
            add(head[4:].strip(), body.strip(), day or str(date.today()))
            n += 1
        else:
            day = head[3:].strip()
    print(f"ingested {n} entries")


def main(argv):
    if not argv:
        return print(__doc__)
    cmd, args = argv[0], argv[1:]
    if cmd == "add" and len(args) >= 2:
        day = args[args.index("--date") + 1] if "--date" in args else str(date.today())
        add(args[0], args[1], day)
    elif cmd == "search" and args:
        n = int(args[args.index("-n") + 1]) if "-n" in args else 5
        r = col.query(query_texts=[args[0]], n_results=n)
        for meta, doc in zip(r["metadatas"][0], r["documents"][0]):
            print(f"[{meta['date']}] {meta['title']}\n{doc}\n")
    elif cmd == "ingest":
        ingest()
    else:
        print(__doc__)


main(sys.argv[1:])
