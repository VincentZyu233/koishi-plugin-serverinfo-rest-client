#!/usr/bin/env python3
"""Export validated live Typst previews into docs and refresh the README gallery."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import struct
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


GALLERY_START = "<!-- TYPST_PREVIEW_GALLERY_START -->"
GALLERY_END = "<!-- TYPST_PREVIEW_GALLERY_END -->"
README_INSERT_ANCHOR = "## 配置表格"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


@dataclass(frozen=True)
class PreviewDescription:
    id: str
    note: str


PREVIEWS = (
    PreviewDescription("healthStatus", "展示服务健康状态、时间戳和持续运行时间。"),
    PreviewDescription("onlineStatus", "展示在线人数、TPS、查询延迟及服务端版本概览。"),
    PreviewDescription("playerHistory", "展示历史玩家、累计游玩时间和最后在线时间。"),
    PreviewDescription("playerActivity", "展示在线人数折线、进入次数柱形和单日活动统计。"),
    PreviewDescription("playerStats", "展示指定玩家的历史游玩、挖掘、击杀和进入次数。"),
    PreviewDescription("playerDetail", "展示在线玩家的身份、状态、环境和网络快照。"),
    PreviewDescription("playersList", "展示当前在线玩家列表。"),
    PreviewDescription("playersCount", "展示当前在线玩家数量。"),
    PreviewDescription("playerNames", "展示当前在线玩家名称列表。"),
    PreviewDescription("serverInfo", "展示存档、在线人数以及 BDS、LeviLamina 和插件版本。"),
    PreviewDescription("serverStatus", "展示服务端与客户端版本、在线人数和协议状态。"),
)


class ExportError(RuntimeError):
    pass


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="校验并导出 live Typst 预览图片，同时更新 README 非折叠画廊。",
    )
    parser.add_argument(
        "--instance",
        default="",
        help="实例键或 commandPrefix；只有一个 live 实例时可以省略。",
    )
    return parser.parse_args()


def resolve_paths() -> tuple[Path, Path, Path, Path]:
    script_path = Path(__file__).resolve()
    plugin_root = script_path.parent.parent
    koishi_root = plugin_root.parent.parent
    readme_path = plugin_root / "readme.md"
    preview_cache_root = (
        koishi_root
        / "cache"
        / "ll-serverinfo-rest-client"
        / "typst-preview"
    )
    destination = plugin_root / "docs" / "images" / "preview"

    if not (plugin_root / "package.json").is_file():
        raise ExportError(f"无法从脚本位置识别插件根目录: {plugin_root}")
    if not readme_path.is_file():
        raise ExportError(f"README 不存在: {readme_path}")
    return preview_cache_root, destination, readme_path, plugin_root


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ExportError(f"无法读取 JSON {path}: {error}") from error
    if not isinstance(value, dict):
        raise ExportError(f"JSON 根节点必须是对象: {path}")
    return value


def discover_live_metadata(cache_root: Path, requested_instance: str) -> tuple[Path, dict[str, Any]]:
    candidates: list[tuple[Path, dict[str, Any]]] = []
    if cache_root.is_dir():
        for metadata_path in sorted(cache_root.glob("*/live/metadata.json")):
            metadata = load_json(metadata_path)
            if metadata.get("mode") != "live":
                continue
            candidates.append((metadata_path, metadata))

    if requested_instance:
        candidates = [
            candidate
            for candidate in candidates
            if candidate[1].get("instanceKey") == requested_instance
            or candidate[1].get("commandPrefix") == requested_instance
        ]

    if not candidates:
        suffix = f"（筛选条件: {requested_instance}）" if requested_instance else ""
        raise ExportError(f"没有找到 live Typst 预览 metadata.json{suffix}: {cache_root}")
    if len(candidates) > 1:
        labels = ", ".join(
            f"{metadata.get('instanceKey', '?')}[{metadata.get('commandPrefix', '?')}]"
            for _, metadata in candidates
        )
        raise ExportError(f"发现多个 live 实例，请使用 --instance 指定其中一个: {labels}")
    return candidates[0]


def read_png_dimensions(path: Path) -> tuple[int, int]:
    try:
        with path.open("rb") as stream:
            header = stream.read(24)
    except OSError as error:
        raise ExportError(f"无法读取 PNG: {path}: {error}") from error
    if len(header) < 24 or header[:8] != PNG_SIGNATURE:
        raise ExportError(f"文件不是有效的 PNG: {path}")
    width, height = struct.unpack(">II", header[16:24])
    if width < 1 or height < 1:
        raise ExportError(f"PNG 尺寸无效: {path}: {width}x{height}")
    return width, height


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    try:
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
    except OSError as error:
        raise ExportError(f"无法计算 SHA-256: {path}: {error}") from error
    return digest.hexdigest()


def validate_previews(metadata_path: Path, metadata: dict[str, Any]) -> list[dict[str, Any]]:
    source_directory = metadata_path.parent.resolve()
    items = metadata.get("items")
    if not isinstance(items, list):
        raise ExportError("metadata.json 缺少 items 数组")

    by_id: dict[str, dict[str, Any]] = {}
    for value in items:
        if not isinstance(value, dict) or not isinstance(value.get("id"), str):
            raise ExportError("metadata.json 包含无效的图片项目")
        item_id = value["id"]
        if item_id in by_id:
            raise ExportError(f"metadata.json 包含重复图片 ID: {item_id}")
        by_id[item_id] = value

    expected_ids = [preview.id for preview in PREVIEWS]
    missing = [item_id for item_id in expected_ids if item_id not in by_id]
    extra = [item_id for item_id in by_id if item_id not in expected_ids]
    if missing or extra:
        raise ExportError(f"预览项目集合不匹配，缺失={missing}，额外={extra}")

    validated: list[dict[str, Any]] = []
    for preview in PREVIEWS:
        item = by_id[preview.id]
        if item.get("status") != "success":
            raise ExportError(
                f"预览未成功生成: {preview.id}: {item.get('message') or item.get('status')}",
            )
        filename = item.get("fileName")
        if not isinstance(filename, str) or not filename.endswith(".png"):
            raise ExportError(f"预览文件名无效: {preview.id}: {filename!r}")
        if Path(filename).name != filename:
            raise ExportError(f"预览文件名不能包含目录: {filename}")

        source_path = (source_directory / filename).resolve()
        if source_path.parent != source_directory or not source_path.is_file():
            raise ExportError(f"预览文件不存在或越出 live 目录: {source_path}")

        actual_size = source_path.stat().st_size
        width, height = read_png_dimensions(source_path)
        actual_sha256 = sha256_file(source_path)
        if item.get("mimeType") != "image/png":
            raise ExportError(f"MIME 不匹配: {filename}: {item.get('mimeType')!r}")
        if item.get("sizeBytes") != actual_size:
            raise ExportError(f"文件大小不匹配: {filename}: {item.get('sizeBytes')} != {actual_size}")
        if item.get("width") != width or item.get("height") != height:
            raise ExportError(
                f"图片尺寸不匹配: {filename}: metadata={item.get('width')}x{item.get('height')} "
                f"file={width}x{height}",
            )
        if item.get("sha256") != actual_sha256:
            raise ExportError(f"SHA-256 不匹配: {filename}")

        validated.append({
            **item,
            "sourcePath": source_path,
            "note": preview.note,
        })
    return validated


def replace_preview_directory(destination: Path, items: list[dict[str, Any]]) -> None:
    destination_parent = destination.parent
    destination_parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".preview-staging-", dir=destination_parent))
    backup = destination_parent / f".preview-backup-{uuid.uuid4().hex}"
    moved_existing = False
    try:
        for item in items:
            copied_path = staging / item["fileName"]
            shutil.copy2(item["sourcePath"], copied_path)
            if sha256_file(copied_path) != item["sha256"]:
                raise ExportError(f"导出后的 SHA-256 不匹配: {item['fileName']}")

        if destination.exists():
            destination.rename(backup)
            moved_existing = True
        staging.rename(destination)
        if moved_existing:
            shutil.rmtree(backup, ignore_errors=True)
    except Exception:
        if not destination.exists() and moved_existing and backup.exists():
            backup.rename(destination)
        raise
    finally:
        if staging.exists():
            shutil.rmtree(staging, ignore_errors=True)


def escape_table_text(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def build_gallery(metadata: dict[str, Any], items: list[dict[str, Any]]) -> str:
    instance_key = escape_table_text(metadata.get("instanceKey", "未知实例"))
    server_label = escape_table_text(metadata.get("serverLabel", "未知服务器"))
    generated_at = escape_table_text(metadata.get("generatedAt", "未知时间"))
    lines = [
        GALLERY_START,
        "## Typst 图片预览",
        "",
        (
            f"以下图片由真实服务端数据生成，实例 `{instance_key}`，"
            f"服务器标记为 **{server_label}**，生成时间为 `{generated_at}`。"
        ),
        "",
        "| 说明 | 图片 |",
        "| --- | --- |",
    ]
    for item in items:
        primary = escape_table_text(item.get("primary", item["id"]))
        alias = escape_table_text(item.get("alias", ""))
        note = escape_table_text(item["note"])
        filename = item["fileName"]
        relative_path = f"docs/images/preview/{filename}"
        description = f"**{primary}**<br>`{alias}`<br>{note}"
        image = f"[![{primary}]({relative_path})]({relative_path})"
        lines.append(f"| {description} | {image} |")
    lines.extend(["", GALLERY_END])
    return "\n".join(lines)


def update_readme(readme_path: Path, gallery: str) -> bool:
    original_bytes = readme_path.read_bytes()
    newline = "\r\n" if original_bytes.count(b"\r\n") > original_bytes.count(b"\n") / 2 else "\n"
    original = original_bytes.decode("utf-8")
    normalized = original.replace("\r\n", "\n")

    start_count = normalized.count(GALLERY_START)
    end_count = normalized.count(GALLERY_END)
    if start_count != end_count or start_count > 1:
        raise ExportError("README 画廊标记不完整或重复")

    if start_count == 1:
        start = normalized.index(GALLERY_START)
        end = normalized.index(GALLERY_END, start) + len(GALLERY_END)
        updated = normalized[:start] + gallery + normalized[end:]
    else:
        anchor = f"\n{README_INSERT_ANCHOR}\n"
        if anchor not in normalized:
            raise ExportError(f"README 中找不到插入位置: {README_INSERT_ANCHOR}")
        updated = normalized.replace(anchor, f"\n{gallery}\n\n{README_INSERT_ANCHOR}\n", 1)

    updated_bytes = updated.replace("\n", newline).encode("utf-8")
    if updated_bytes == original_bytes:
        return False

    temporary = readme_path.with_name(f".{readme_path.name}.tmp-{os.getpid()}-{uuid.uuid4().hex}")
    try:
        temporary.write_bytes(updated_bytes)
        os.replace(temporary, readme_path)
    finally:
        temporary.unlink(missing_ok=True)
    return True


def main() -> int:
    args = parse_args()
    cache_root, destination, readme_path, plugin_root = resolve_paths()
    metadata_path, metadata = discover_live_metadata(cache_root, args.instance.strip())
    items = validate_previews(metadata_path, metadata)
    gallery = build_gallery(metadata, items)

    replace_preview_directory(destination, items)
    readme_changed = update_readme(readme_path, gallery)

    print(f"Source: {metadata_path.parent.relative_to(plugin_root.parent.parent)}")
    print(f"Exported: {len(items)} PNG files -> {destination.relative_to(plugin_root)}")
    print(f"README: {'updated' if readme_changed else 'unchanged'} -> {readme_path.name}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ExportError as error:
        raise SystemExit(f"error: {error}") from error
