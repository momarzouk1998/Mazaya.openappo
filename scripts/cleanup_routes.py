#!/usr/bin/env python3
"""
Cleanup pass:
1. Remove leftover bare `await requireAuth();` calls (without `const user =`)
2. Remove duplicate `await requirePermission(...)` calls
3. Remove duplicate `await requireAuth();` calls
"""
import re
import glob

cleaned = []
for f in glob.glob("src/app/api/**/route.ts", recursive=True):
    with open(f, "r", encoding="utf-8-sig") as fp:
        content = fp.read()
    new = content

    # 1. Remove `await requireAuth();` and `await requirePermission(...);` that appear alone on a line
    #    (not part of `const user = await ...`)
    new = re.sub(
        r"^[ \t]*await\s+requireAuth\s*\(\s*\)\s*;?\s*\n",
        "",
        new,
        flags=re.MULTILINE,
    )
    new = re.sub(
        r"^[ \t]*await\s+requirePermission\s*\([^)]*\)\s*;?\s*\n",
        "",
        new,
        flags=re.MULTILINE,
    )

    # 2. Remove duplicate `const user = await requirePermission(...)` — keep only the first
    seen_perm = False
    lines = new.split("\n")
    out = []
    for line in lines:
        if re.match(r"\s*const\s+user\s*=\s*await\s+requirePermission\s*\(", line):
            if seen_perm:
                continue
            seen_perm = True
        out.append(line)
    new = "\n".join(out)

    if new != content:
        with open(f, "w", encoding="utf-8") as fp:
            fp.write(new)
        cleaned.append(f)

print(f"Cleaned {len(cleaned)} files:")
for f in cleaned:
    print(f"  {f}")
