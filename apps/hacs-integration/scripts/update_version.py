#!/usr/bin/env python3
"""Update the version in manifest.json."""
import json
import sys
from pathlib import Path


def update_version(version: str) -> None:
    """Update the version in manifest.json."""
    manifest_path = Path(__file__).parent.parent / "custom_components" / "hofor_water" / "manifest.json"

    with open(manifest_path) as f:
        manifest = json.load(f)

    old_version = manifest.get("version", "unknown")
    manifest["version"] = version

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    print(f"✅ Updated manifest.json version: {old_version} → {version}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: update_version.py <version>")
        sys.exit(1)

    update_version(sys.argv[1])
