#!/usr/bin/env python3
"""Build a dependency-light full-text index for the mirrored Recepton site."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

SKIP_DIRS = {"sources", "output", ".git", "wp-content", "wp-includes"}
DROP_SELECTORS = (
    "header", "footer", "nav", "aside", "script", "style", "noscript",
    "form", ".fusion-main-menu", ".fusion-mobile-menu-icons",
    ".fusion-sliding-bar", ".fusion-footer", ".sidebar", ".widget",
    ".breadcrumbs", ".fusion-page-title-bar",
)


def clean_text(node) -> str:
    for selector in DROP_SELECTORS:
        for item in node.select(selector):
            item.decompose()
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def page_url(path: Path, root: Path) -> str:
    rel = path.relative_to(root).as_posix()
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[:-10].rstrip("/") + "/"
    return "/" + rel


def readable_title(soup, path: Path) -> str:
    for selector in ("meta[property='og:title']", ".entry-title",
                     ".fusion-page-title-bar h1", "h1"):
        el = soup.select_one(selector)
        if el:
            value = el.get("content", "") if el.name == "meta" else el.get_text(" ", strip=True)
            if value.strip():
                return re.sub(r"\s+", " ", value).strip()
    title = soup.title.get_text(" ", strip=True) if soup.title else path.stem
    return re.sub(r"\s*[–|-]\s*(?:Recepton|recepton)\s*$", "", title).strip() or path.stem


def table_metadata(soup) -> dict:
    metadata = {}
    for table in soup.select("table"):
        rows = []
        for tr in table.select("tr"):
            cells = [re.sub(r"\s+", " ", c.get_text(" ", strip=True)) for c in tr.select("th,td")]
            if cells:
                rows.append(cells)
        if not rows:
            continue
        # Product information tables are key/value rows.
        if all(len(row) == 2 for row in rows):
            for key, value in rows:
                if key and value and key.lower() not in {"product information"}:
                    metadata[key.rstrip(":")] = value
        # Protein catalog tables have a header followed by catalog rows.
        elif len(rows[0]) >= 4 and any("catalog" in x.lower() for x in rows[0]):
            headers = rows[0]
            for row in rows[1:]:
                if len(row) != len(headers):
                    continue
                item = {headers[i]: row[i] for i in range(len(headers)) if headers[i] and row[i]}
                catalog = item.get("Catalog number") or item.get("Catalog Number")
                if catalog:
                    metadata.setdefault("catalog", []).append(item)
    return metadata


def classify(soup, text: str) -> str:
    classes = set(soup.body.get("class", [])) if soup.body else set()
    if "single-post" in classes:
        return "article"
    if "archive" in classes or "search-results" in classes:
        return "page"
    if "single-protein" in classes or "Product Information" in text:
        return "product"
    return "page"


def tags_for(soup) -> list[str]:
    tags = []
    for el in soup.select(".post-tags .single-tag, .post-tags a"):
        value = re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip()
        if value and value.lower() not in {x.lower() for x in tags}:
            tags.append(value)
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        if "/tag/" in urlparse(href).path:
            value = re.sub(r"\s+", " ", a.get_text(" ", strip=True)).strip()
            if value and value.lower() not in {x.lower() for x in tags}:
                tags.append(value)
    return tags


def local_image(soup, path: Path, root: Path) -> str | None:
    candidates = []
    og = soup.select_one("meta[property='og:image']")
    if og and og.get("content"):
        candidates.append(og["content"])
    for image in soup.select(".post-content img, #main img"):
        src = image.get("src", "")
        if src and "logo" not in src.lower():
            candidates.append(src)
    for src in candidates:
        parsed = urlparse(src)
        if parsed.scheme or parsed.netloc:
            continue
        target = (path.parent / parsed.path).resolve()
        try:
            rel = target.relative_to(root)
        except ValueError:
            continue
        if target.is_file():
            return "/" + rel.as_posix()
    return None


def entry_for(path: Path, root: Path) -> dict:
    soup = BeautifulSoup(path.read_text(encoding="utf-8", errors="ignore"), "html.parser")
    content_root = soup.select_one(".post-content") or soup.select_one("#main") or soup.body or soup
    text = clean_text(content_root)
    title = readable_title(soup, path)
    # Avoid indexing a page that only contains the shared shell.
    body = re.sub(rf"^{re.escape(title)}\s*", "", text, flags=re.I).strip()
    excerpt = body[:320].rstrip()
    kind = classify(soup, text)
    item = {
        "path": page_url(path, root),
        "title": title,
        "type": kind,
        "excerpt": excerpt,
        "body": body,
        "tags": tags_for(soup) if kind == "article" else [],
    }
    metadata = table_metadata(soup) if kind == "product" else {}
    if metadata:
        item["metadata"] = metadata
    image = local_image(soup, path, root)
    if image:
        item["image"] = image
    return item


def rank(item: dict) -> tuple:
    path = item["path"].lower()
    archive = bool(re.search(r"/(?:20\d{2})(?:/|$)|/articles/?$", path))
    return (archive, len(path), path)


def build(root: Path) -> list[dict]:
    files = sorted(
        p for p in root.rglob("*.html")
        if not any(part in SKIP_DIRS for part in p.relative_to(root).parts)
    )
    candidates = [entry_for(path, root) for path in files]
    # Exact aliases occur in mirrored archive/current routes; keep the preferred current route.
    dedup: dict[tuple[str, str], dict] = {}
    for item in candidates:
        digest = hashlib.sha1(item["body"].encode("utf-8")).hexdigest()
        key = (item["type"], digest)
        if key not in dedup or rank(item) < rank(dedup[key]):
            dedup[key] = item
    return sorted(dedup.values(), key=lambda x: x["path"])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    root = args.root.resolve()
    output = args.output or root / "assets" / "search-data.json"
    entries = build(root)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "local mirrored HTML",
        "entries": entries,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"indexed {len(entries)} pages -> {output}")
    counts = {}
    for item in entries:
        counts[item["type"]] = counts.get(item["type"], 0) + 1
    print("types:", ", ".join(f"{key}={counts[key]}" for key in sorted(counts)))


if __name__ == "__main__":
    main()
