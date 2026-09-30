#!/usr/bin/env python3
"""Собирает catalog.json для читальни. Запускать из любой директории."""

import json
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
skip = {"scripts", "assets", ".git"}


def read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8").splitlines()


def first_heading(path: Path) -> str:
    for line in read_lines(path):
        if line.startswith("# "):
            return line[2:].strip()
    return path.stem


def title_author(path: Path) -> tuple[str, str]:
    lines = read_lines(path)
    heading = ""
    rest = ""
    for index, line in enumerate(lines):
        if not line.startswith("# "):
            continue
        heading = line[2:].strip()
        for nxt in lines[index + 1 :]:
            if nxt.strip():
                rest = nxt.strip()
                break
        break
    title = heading.split(". ", 1)[1] if ". " in heading else (heading or path.stem)
    author = ""
    if rest:
        author = rest.split(".")[0].split(",")[0].strip()
    return title, author


def chapter_title(path: Path) -> str:
    heading = first_heading(path)
    return heading.split(". ", 1)[1] if ". " in heading else heading


def sort_key(path: Path) -> tuple[int, str]:
    match = re.search(r"-(\d+)-", path.name)
    return (int(match.group(1)) if match else 999, path.name)


books = []
for folder in sorted(root.iterdir()):
    if not folder.is_dir() or folder.name in skip or folder.name.startswith("."):
        continue
    if folder.name == "Боль":
        continue
    indexes = sorted(folder.glob("*выжимка.md"))
    if not indexes:
        continue
    index = indexes[0]
    title, author = title_author(index)
    shpora = sorted(folder.glob("*шпора-автор.md"))
    shpora_path = shpora[0] if shpora else None
    chapters = [
        path
        for path in folder.glob("*.md")
        if path != index and path != shpora_path
    ]
    chapters.sort(key=sort_key)
    entry = {
        "id": folder.name,
        "title": title,
        "author": author,
        "index": index.relative_to(root).as_posix(),
        "chapters": [
            {"title": chapter_title(path), "path": path.relative_to(root).as_posix()}
            for path in chapters
        ],
    }
    if shpora_path:
        entry["authorCheatsheet"] = {
            "title": "Шпора автора",
            "path": shpora_path.relative_to(root).as_posix(),
            "pages": 17,
        }
    books.append(entry)

pains = []
pain_dir = root / "Боль"
if pain_dir.is_dir():
    for path in sorted(pain_dir.glob("*.md")):
        heading = first_heading(path)
        title = heading.split(":", 1)[1].strip() if heading.lower().startswith("боль:") else heading
        if title:
            title = title[0].upper() + title[1:]
        pains.append({"title": title, "path": path.relative_to(root).as_posix()})

catalog = root / "catalog.json"
catalog.write_text(
    json.dumps({"books": books, "pains": pains}, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(f"wrote {catalog.name}: books={len(books)} pains={len(pains)}")
