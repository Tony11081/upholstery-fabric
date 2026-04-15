#!/usr/bin/env python3
"""Build a repeatable FabricViva catalog snapshot for the isolated Woo site."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from urllib.request import Request, urlopen


SHOP_BASE = "https://fabricviva.store/"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "catalog" / "fabricviva-catalog.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; Codex FabricViva Snapshot/1.0)",
    "Accept": "application/json,text/plain,*/*",
}

COLLECTION_ORDER = [
    "frontpage",
    "fabrics",
    "gucci-fabric",
    "lv-fabric",
    "dior-fabric",
    "fendi-fabric",
    "other-logo-fabrics",
    "jacquard-fabric",
    "accessories",
]


def fetch_json(path: str) -> Any:
    request = Request(urljoin(SHOP_BASE, path), headers=HEADERS)
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def build_category_map() -> dict[str, dict[str, str | None]]:
    return {
        "all-fabrics": {"name": "All Fabrics", "parent": None},
        "new-arrivals": {"name": "New Arrivals", "parent": None},
        "accessories": {"name": "Accessories", "parent": None},
        "gucci-fabric": {"name": "Gucci Fabric", "parent": "all-fabrics"},
        "lv-fabric": {"name": "LV Fabric", "parent": "all-fabrics"},
        "dior-fabric": {"name": "Dior Fabric", "parent": "all-fabrics"},
        "fendi-fabric": {"name": "Fendi Fabric", "parent": "all-fabrics"},
        "other-logo-fabrics": {"name": "Other Fabrics", "parent": "all-fabrics"},
        "jacquard-fabric": {"name": "Jacquard Fabric", "parent": "all-fabrics"},
    }


def normalize_option_name(name: str, values: list[str]) -> str:
    cleaned = (name or "").strip()
    if cleaned.lower() == "title" and values and values != ["Default Title"]:
        return "Option"
    if not cleaned:
        return "Option"
    return cleaned


def main() -> None:
    catalog_dir = OUTPUT_PATH.parent
    catalog_dir.mkdir(parents=True, exist_ok=True)

    products = fetch_json("products.json?limit=250&page=1").get("products", [])
    collections = fetch_json("collections.json?limit=250").get("collections", [])

    collection_meta: dict[str, dict[str, Any]] = {
        item["handle"]: {
            "title": item.get("title", item["handle"]),
            "products_count": item.get("products_count", 0),
            "description": item.get("description") or "",
            "source_url": urljoin(SHOP_BASE, f"collections/{item['handle']}"),
        }
        for item in collections
    }

    membership: dict[str, list[str]] = {product["handle"]: [] for product in products}

    for handle in COLLECTION_ORDER:
        collection_products = fetch_json(f"collections/{handle}/products.json?limit=250").get("products", [])
        for product in collection_products:
            membership.setdefault(product["handle"], []).append(handle)

    snapshot_products: list[dict[str, Any]] = []

    for product in products:
        handle = product["handle"]
        option_defs = []

        for option in product.get("options", []):
            option_defs.append(
                {
                    "name": normalize_option_name(option.get("name", ""), option.get("values", [])),
                    "position": option.get("position", 0),
                    "values": option.get("values", []),
                }
            )

        variants = []
        for variant in product.get("variants", []):
            variants.append(
                {
                    "id": variant["id"],
                    "title": variant.get("title") or "",
                    "sku": variant.get("sku") or "",
                    "price": variant.get("price") or "",
                    "compare_at_price": variant.get("compare_at_price") or "",
                    "available": bool(variant.get("available", True)),
                    "inventory_quantity": variant.get("inventory_quantity"),
                    "option1": variant.get("option1") or "",
                    "option2": variant.get("option2") or "",
                    "option3": variant.get("option3") or "",
                    "source_url": urljoin(SHOP_BASE, f"products/{handle}?variant={variant['id']}"),
                }
            )

        collection_handles = list(dict.fromkeys(membership.get(handle, [])))
        if any(
            collection in collection_handles
            for collection in (
                "gucci-fabric",
                "lv-fabric",
                "dior-fabric",
                "fendi-fabric",
                "other-logo-fabrics",
                "jacquard-fabric",
            )
        ):
            collection_handles = list(dict.fromkeys(["fabrics", *collection_handles]))

        images = [
            {
                "id": image["id"],
                "src": image["src"],
                "position": image.get("position", 0),
                "alt": image.get("alt") or product.get("title") or "",
            }
            for image in product.get("images", [])
        ]

        snapshot_products.append(
            {
                "id": product["id"],
                "title": product.get("title") or handle,
                "handle": handle,
                "status": product.get("status", "active"),
                "published_at": product.get("published_at"),
                "body_html": product.get("body_html") or "",
                "vendor": product.get("vendor") or "",
                "product_type": product.get("product_type") or "",
                "tags": product.get("tags") or [],
                "source_url": urljoin(SHOP_BASE, f"products/{handle}"),
                "collections": collection_handles,
                "options": option_defs,
                "variants": variants,
                "images": images,
            }
        )

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_shop": SHOP_BASE,
        "product_count": len(snapshot_products),
        "category_map": build_category_map(),
        "navigation": [
            {"label": "Home", "type": "page", "slug": "home"},
            {"label": "Shop", "type": "page", "slug": "shop"},
            {"label": "New Arrivals", "type": "product_cat", "slug": "new-arrivals"},
            {"label": "All Fabrics", "type": "product_cat", "slug": "all-fabrics"},
            {"label": "Gucci Fabric", "type": "product_cat", "slug": "gucci-fabric"},
            {"label": "LV Fabric", "type": "product_cat", "slug": "lv-fabric"},
            {"label": "Dior Fabric", "type": "product_cat", "slug": "dior-fabric"},
            {"label": "Fendi Fabric", "type": "product_cat", "slug": "fendi-fabric"},
            {"label": "Other Fabrics", "type": "product_cat", "slug": "other-logo-fabrics"},
            {"label": "Jacquard Fabric", "type": "product_cat", "slug": "jacquard-fabric"},
            {"label": "Accessories", "type": "product_cat", "slug": "accessories"},
        ],
        "collections": collection_meta,
        "products": snapshot_products,
    }

    OUTPUT_PATH.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    print(f"Wrote {len(snapshot_products)} products to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
