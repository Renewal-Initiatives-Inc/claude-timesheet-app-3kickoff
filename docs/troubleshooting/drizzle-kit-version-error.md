# Troubleshooting: drizzle-kit "Please install latest version of drizzle-orm"

## Error Message

```
No config path provided, using default 'drizzle.config.ts'
Reading config file '/Users/jefftakle/Desktop/Claude/test-of-kickoff-skill/packages/backend/drizzle.config.ts'
Please install latest version of drizzle-orm
```

## Context

- **Project structure**: npm workspaces monorepo
- **drizzle-orm version**: 0.45.1 (latest)
- **drizzle-kit version**: 0.31.8 (latest)
- **Package location**: `packages/backend/`
- **Root package manager**: npm workspaces

---

## Hypotheses (Prioritized by Likelihood)

### H1: npm workspaces dependency hoisting issue ⭐ HIGH PRIORITY

**Justification**: Multiple GitHub issues (#2699, #3248) confirm this is the most common cause. drizzle-kit uses `import('drizzle-orm/version')` to check the version, but in monorepos, if drizzle-orm is not hoisted to root node_modules, the import fails.

**Test**: Check where drizzle-orm is actually installed

```bash
ls -la node_modules/drizzle-orm  # root
ls -la packages/backend/node_modules/drizzle-orm  # workspace
```

**Fix options**:

1. Install drizzle-orm at monorepo root
2. Use `npm exec drizzle-kit generate` instead of npx
3. Run via npm scripts which resolve locally

**Status**: [ ] Not tested

---

### H2: Running from wrong directory

**Justification**: npx may resolve drizzle-kit from a different location than where drizzle-orm is installed.

**Test**: Run command from within packages/backend directory using local npm script

```bash
cd packages/backend
npm run db:generate
```

**Status**: [ ] Not tested

---

### H3: Version incompatibility between drizzle-kit and drizzle-orm

**Justification**: Some version combinations are known to fail. GitHub issues suggest drizzle-kit 0.30.4 + drizzle-orm 0.39.0 work together.

**Test**:

```bash
npm ls drizzle-orm drizzle-kit
```

**Fix**: Try downgrading to known working versions:

```bash
npm install drizzle-orm@0.39.0 drizzle-kit@0.30.4 -w @renewal/backend
```

**Status**: [ ] Not tested

---

### H4: Using npx instead of package manager exec

**Justification**: npx downloads fresh copies and may not respect workspace dependencies. `npm exec` or running via scripts uses local resolution.

**Test**:

```bash
# Instead of: npx drizzle-kit generate
# Try:
npm exec --workspace=@renewal/backend -- drizzle-kit generate
```

**Status**: [ ] Not tested

---

### H5: drizzle-kit needs to be at root level

**Justification**: Issue #2699 suggests installing at monorepo root resolves the issue.

**Test**: Install drizzle packages at root

```bash
npm install drizzle-orm drizzle-kit --save-dev  # at root
```

**Status**: [ ] Not tested

---

### H6: Missing peer dependency or corrupted node_modules

**Justification**: Sometimes npm doesn't properly link workspace dependencies.

**Test**: Clean reinstall

```bash
rm -rf node_modules packages/*/node_modules
npm install
```

**Status**: [ ] Not tested

---

## Test Results Log

| Hypothesis  | Date       | Result   | Notes                                                                                                      |
| ----------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| H1          | 2026-01-21 | ✅ FIXED | Installing drizzle-orm at root resolved the version error. New error: module resolution for .js extensions |
| ESM .js ext | 2026-01-21 | ✅ FIXED | Removed .js extensions from schema imports, updated tsconfig to use `moduleResolution: Bundler`            |
| Relations   | 2026-01-21 | ✅ FIXED | Added `relationName` to disambiguate multiple FK relations to same table                                   |

---

## Final Solution

Two issues needed to be resolved:

### Issue 1: npm workspaces dependency hoisting

**Problem**: drizzle-kit couldn't find drizzle-orm because it was only installed in the workspace, not hoisted to root.

**Solution**: Install drizzle-orm and drizzle-kit at the monorepo root:

```bash
npm install drizzle-orm drizzle-kit --save-dev  # at root level
```

### Issue 2: ESM .js extension imports and moduleResolution conflict

**Problem**: Schema files used `.js` extensions for ESM imports (e.g., `import { x } from './enums.js'`), but drizzle-kit uses CommonJS internally and couldn't resolve them. However, TypeScript with `moduleResolution: NodeNext` requires `.js` extensions.

**Solution**: Two-part fix:

1. Remove `.js` extensions from all schema file imports:

```typescript
// Before (ESM style)
import { employeeStatusEnum } from './enums.js';

// After (drizzle-kit compatible)
import { employeeStatusEnum } from './enums';
```

2. Update `packages/backend/tsconfig.json` to use `Bundler` module resolution:

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

This allows imports without `.js` extensions while still supporting ESM output.

Files modified:

- `packages/backend/tsconfig.json` (module resolution)
- `src/db/schema/index.ts`
- `src/db/schema/employee.ts`
- `src/db/schema/task-code.ts`
- `src/db/schema/timesheet.ts`
- `src/db/schema/compliance.ts`
- `src/db/schema/payroll.ts`

**Note**: The `Bundler` moduleResolution is designed for modern tooling (Vite, esbuild, drizzle-kit, etc.) and provides the best compatibility for projects using these tools.

---

## References

- https://github.com/drizzle-team/drizzle-orm/issues/2699
- https://github.com/drizzle-team/drizzle-orm/issues/3248
- https://github.com/drizzle-team/drizzle-orm/issues/4981
