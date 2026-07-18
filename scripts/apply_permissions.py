#!/usr/bin/env python3
"""
Apply permission checks to all API route files.
For each HTTP method handler (GET/POST/PUT/PATCH/DELETE):
  - Replace `const user = await requireAuth()` with `const user = await requirePermission(MODULE, ACTION)`
  - Replace import: `requireAuth` -> `requirePermission`
  - Replace the error response to use the actual error code

Module key is derived from the file path.
"""
import os
import re
import glob

PATH_TO_MODULE = {
    "accessories": "accessories_inventory",
    "boards": "boards_inventory",
    "branches": "branches",
    "budget": "budget",
    "contractors": "contractors",
    "customer-payments": "payments",
    "customers": "customers",
    "journal": "journal",
    "material-types": "material_types",
    "orders": "orders",
    "overhead": "overhead",
    "suppliers": "suppliers",
    "workers": "workers",
    "inventory": "boards_inventory",  # inventory/[id]/usage → boards usage
    "reports": "reports",
}

SKIP_PREFIXES = ["admin/", "auth/", "audit-log", "health", "fix-inventory"]

METHOD_TO_ACTION = {
    "GET": "view",
    "POST": "add",
    "PUT": "edit",
    "PATCH": "edit",
    "DELETE": "delete",
}


def get_module_for_path(filepath: str) -> str | None:
    rel = filepath.replace("\\", "/")
    if "src/app/api/" not in rel:
        return None
    rel = rel.split("src/app/api/", 1)[1]
    rel = rel.removesuffix("/route.ts")
    for skip in SKIP_PREFIXES:
        if rel == skip or rel.startswith(skip + "/") or rel.startswith(skip + "["):
            return None
    for key in sorted(PATH_TO_MODULE.keys(), key=len, reverse=True):
        if rel == key or rel.startswith(key + "/") or rel.startswith(key + "["):
            return PATH_TO_MODULE[key]
    return None


def process_file(filepath: str) -> bool:
    with open(filepath, "r", encoding="utf-8-sig") as f:
        content = f.read()

    module = get_module_for_path(filepath)
    if module is None:
        return False
    if "requirePermission(" in content:
        return False
    if "requireAuth" not in content:
        return False

    # 1. Replace the import line
    content = re.sub(
        r"import\s*\{([^}]*?)\}\s*from\s*['\"]@/lib/auth-server['\"]",
        lambda m: "import {" + m.group(1).replace("requireAuth", "requirePermission") + "} from '@/lib/auth-server'",
        content,
    )

    # 2. For each HTTP method handler, replace the FIRST `const user = await requireAuth()`
    #    with `const user = await requirePermission(MODULE, ACTION)`.
    # We process the file handler-by-handler to ensure we only modify the right calls.

    def replace_in_method(method_name, action, source):
        # Find the handler block
        pattern = re.compile(
            r"(export\s+async\s+function\s+" + method_name + r"\s*\([^)]*\)\s*\{)(.*?)(\n\})",
            re.DOTALL,
        )

        def sub(m):
            header, body, footer = m.group(1), m.group(2), m.group(3)
            if "requirePermission" in body and "requirePermission(" in body:
                # Already partially migrated? Skip this handler.
                return m.group(0)
            # Find first `const user = await requireAuth()`
            new_body, count = re.subn(
                r"const\s+user\s*=\s*await\s+requireAuth\s*\(\s*\)",
                f"const user = await requirePermission({module!r}, {action!r})",
                body,
                count=1,
            )
            if count == 0:
                # Not present — insert right after `try {`
                new_body = re.sub(
                    r"(try\s*\{\s*\n)",
                    rf"\1    const user = await requirePermission({module!r}, {action!r});\n",
                    body,
                    count=1,
                )
            return header + new_body + footer

        return pattern.sub(sub, source)

    for method, action in METHOD_TO_ACTION.items():
        content = replace_in_method(method, action, content)

    # 3. Replace the error response to use e.code (so 403 is propagated)
    content = re.sub(
        r"if\s*\(\s*e\.status\s*\)\s*return\s+NextResponse\.json\(\s*\{\s*ok:\s*false,\s*error:\s*\{\s*code:\s*['\"]UNAUTHORIZED['\"]\s*,\s*message:\s*['\"][^'\"]*['\"]\s*\}\s*\}\s*,\s*\{\s*status:\s*e\.status\s*\}\s*\);",
        "if (e.status) return NextResponse.json({ ok: false, error: { code: e.code || 'FORBIDDEN', message: e?.message || 'غير مسجل الدخول' } }, { status: e.status });",
        content,
    )

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def main():
    files = glob.glob("src/app/api/**/route.ts", recursive=True)
    modified = []
    for f in files:
        try:
            if process_file(f):
                modified.append(f)
        except Exception as e:
            print(f"ERROR processing {f}: {e}")
            import traceback
            traceback.print_exc()
    print(f"Modified {len(modified)} files:")
    for m in modified:
        print(f"  {m}")


if __name__ == "__main__":
    main()
