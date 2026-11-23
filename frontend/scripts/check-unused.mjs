#!/usr/bin/env node
/**
 * AST-backed unused production file and export detector using TypeScript's Compiler API.
 * Accounts for Next.js App Router conventions and Node/Playwright test imports.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const frontendDir = path.resolve(import.meta.dirname, "..");
const srcDir = path.join(frontendDir, "src");
const testsDir = path.join(frontendDir, "tests");

const NEXT_ENTRY_BASENAMES = new Set([
  "page.tsx",
  "page.ts",
  "layout.tsx",
  "layout.ts",
  "loading.tsx",
  "error.tsx",
  "not-found.tsx",
  "template.tsx",
  "default.tsx",
  "route.ts",
  "proxy.ts",
]);

function walkFiles(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkFiles(full, exts, out);
    } else if (exts.some((ext) => entry.name.endsWith(ext)) && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function resolveImportSpecifier(specifier, fromFile) {
  let targetBase = null;
  if (specifier.startsWith("@/")) {
    targetBase = path.join(srcDir, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    targetBase = path.resolve(path.dirname(fromFile), specifier);
  }
  if (!targetBase) return null;

  const candidates = [
    targetBase,
    `${targetBase}.ts`,
    `${targetBase}.tsx`,
    `${targetBase}.js`,
    `${targetBase}.jsx`,
    `${targetBase}.mjs`,
    path.join(targetBase, "index.ts"),
    path.join(targetBase, "index.tsx"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return path.normalize(candidate);
    }
  }
  return null;
}

const sourceFiles = walkFiles(srcDir, [".ts", ".tsx"]);
const testFiles = walkFiles(testsDir, [".mjs", ".ts", ".tsx"]);
const allFiles = [...sourceFiles, ...testFiles];

// Map normalized file path -> { importedNames: Set<string>, namespaceOrDefault: boolean }
const importedBy = new Map();
const referencedFiles = new Set();

function recordRef(targetFile, names, allUsed = false) {
  const norm = path.normalize(targetFile);
  referencedFiles.add(norm);
  let entry = importedBy.get(norm);
  if (!entry) {
    entry = { names: new Set(), allUsed: false };
    importedBy.set(norm, entry);
  }
  if (allUsed) entry.allUsed = true;
  for (const n of names) entry.names.add(n);
}

for (const file of allFiles) {
  const content = fs.readFileSync(file, "utf8");
  const isMjs = file.endsWith(".mjs");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : isMjs ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, content, ts.ScriptTarget.ES2022, true, kind);

  function visit(node) {
    // ES imports & re-exports
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const resolved = resolveImportSpecifier(node.moduleSpecifier.text, file);
      if (resolved) {
        if (ts.isImportDeclaration(node) && node.importClause) {
          const names = [];
          let star = false;
          if (node.importClause.name) names.push("default");
          if (node.importClause.namedBindings) {
            if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              star = true;
            } else {
              for (const el of node.importClause.namedBindings.elements) {
                names.push((el.propertyName ?? el.name).text);
              }
            }
          }
          recordRef(resolved, names, star);
        } else if (ts.isExportDeclaration(node)) {
          const names = [];
          let star = !node.exportClause;
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const el of node.exportClause.elements) {
              names.push((el.propertyName ?? el.name).text);
            }
          }
          recordRef(resolved, names, star);
        } else {
          recordRef(resolved, [], true);
        }
      }
    }
    // dynamic import('./...') or require('...')
    if (ts.isCallExpression(node) && node.arguments.length >= 1 && ts.isStringLiteral(node.arguments[0])) {
      const calleeText = node.expression.getText(sf);
      if (calleeText === "import" || calleeText === "require") {
        const resolved = resolveImportSpecifier(node.arguments[0].text, file);
        if (resolved) recordRef(resolved, ["default"], true);
      }
    }
    // string literal references to src/... in Node test vm loaders (loadModule('src/...'))
    if (isMjs && ts.isStringLiteral(node)) {
      const txt = node.text.replace(/^\.\//, "");
      if (txt.startsWith("src/")) {
        const resolved = resolveImportSpecifier(`@/${txt.slice(4)}`, file);
        if (resolved) recordRef(resolved, [], true);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
}

const unusedFiles = [];
const unusedExports = [];

for (const file of sourceFiles) {
  const norm = path.normalize(file);
  const rel = path.relative(frontendDir, norm).replace(/\\/g, "/");
  const base = path.basename(norm);
  const isNextEntry =
    NEXT_ENTRY_BASENAMES.has(base) && (rel.startsWith("src/app/") || rel === "src/proxy.ts");

  if (!isNextEntry && !referencedFiles.has(norm)) {
    unusedFiles.push(rel);
    continue;
  }

  const refInfo = importedBy.get(norm);
  if (refInfo?.allUsed) continue;

  const content = fs.readFileSync(norm, "utf8");
  const sf = ts.createSourceFile(
    norm,
    content,
    ts.ScriptTarget.ES2022,
    true,
    norm.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  const exportedNames = new Set();
  for (const stmt of sf.statements) {
    const mods = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    const isExported = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (isDefault) {
      exportedNames.add("default");
    } else if (isExported) {
      if (ts.isFunctionDeclaration(stmt) || ts.isClassDeclaration(stmt) || ts.isInterfaceDeclaration(stmt) || ts.isTypeAliasDeclaration(stmt) || ts.isEnumDeclaration(stmt)) {
        if (stmt.name) exportedNames.add(stmt.name.text);
      } else if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) exportedNames.add(decl.name.text);
        }
      }
    } else if (ts.isExportAssignment(stmt)) {
      exportedNames.add("default");
    } else if (ts.isExportDeclaration(stmt) && stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
      for (const el of stmt.exportClause.elements) exportedNames.add(el.name.text);
    }
  }

  const ALLOWED_NEXT_EXPORTS = new Set(["default", "metadata", "viewport", "generateMetadata", "dynamic"]);
  const ALLOWED_PROXY_EXPORTS = new Set(["default", "config"]);

  for (const name of exportedNames) {
    if (isNextEntry && rel === "src/proxy.ts" && ALLOWED_PROXY_EXPORTS.has(name)) continue;
    if (isNextEntry && rel.startsWith("src/app/") && ALLOWED_NEXT_EXPORTS.has(name)) continue;
    if (!refInfo?.names.has(name)) {
      unusedExports.push(`${rel}: ${name}`);
    }
  }
}

if (unusedFiles.length || unusedExports.length) {
  if (unusedFiles.length) {
    console.error("Unused source files:");
    for (const f of unusedFiles) console.error(`  - ${f}`);
  }
  if (unusedExports.length) {
    console.error("Unused exports:");
    for (const e of unusedExports) console.error(`  - ${e}`);
  }
  process.exit(1);
}

console.log(`Checked ${sourceFiles.length} source files and ${testFiles.length} test files: 0 unused files, 0 unused exports.`);
