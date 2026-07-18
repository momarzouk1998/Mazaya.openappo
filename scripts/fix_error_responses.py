#!/usr/bin/env python3
"""Fix error responses in route files to use e.code."""
import re
import glob

# Match various error response patterns
PATTERNS = [
    # Double-quoted version
    re.compile(
        r"if\s*\(\s*e\.status\s*\)\s*return\s+NextResponse\.json\(\s*\{\s*ok:\s*false,\s*error:\s*\{\s*code:\s*['\"]UNAUTHORIZED['\"]\s*,\s*message:\s*['\"][^'\"]*['\"]\s*\}\s*\}\s*,\s*\{\s*status:\s*e\.status\s*\}\s*\);"
    ),
]

# Also match a more flexible pattern for code value
GENERIC = re.compile(
    r"if\s*\(\s*e\.status\s*\)\s*return\s+NextResponse\.json\(\s*\{\s*ok:\s*false,\s*error:\s*\{\s*code:\s*['\"]UNAUTHORIZED['\"][^}]*?\}\s*\}\s*,\s*\{\s*status:\s*e\.status\s*\}\s*\);"
)

REPLACEMENT = (
    "if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });"
)

modified = []
for f in glob.glob("src/app/api/**/route.ts", recursive=True):
    with open(f, "r", encoding="utf-8-sig") as fp:
        content = fp.read()
    new = GENERIC.sub(REPLACEMENT, content)
    if new != content:
        with open(f, "w", encoding="utf-8") as fp:
            fp.write(new)
        modified.append(f)

print(f"Fixed error responses in {len(modified)} files:")
for m in modified:
    print(f"  {m}")
