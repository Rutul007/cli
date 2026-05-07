import https from "https";
import fs from "fs";
import path from "path";
import chalk from "chalk";

const PACKAGE_NAME = "@zerothreatai/cli";
const NPM_REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME.replace("/", "%2F")}/latest`;
const TIMEOUT_MS = 5000;

/**
 * Walks up from the current file's directory to find the package.json
 * belonging to @zerothreatai/cli. Works both in local dev and global install.
 */
function findPackageJson(): Record<string, any> {
  let dir = __dirname;
  while (dir !== path.parse(dir).root) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        if (pkg.name === PACKAGE_NAME) return pkg;
      } catch {
        // ignore parse errors, keep searching
      }
    }
    dir = path.dirname(dir);
  }
  throw new Error(`Could not find package.json for ${PACKAGE_NAME}`);
}

/** Returns the currently installed version from package.json */
export function getInstalledVersion(): string {
  return findPackageJson().version;
}

/** Fetches the latest published version from the npm registry */
function fetchLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(NPM_REGISTRY_URL, { timeout: TIMEOUT_MS }, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.version) {
            resolve(json.version);
          } else {
            reject(new Error("No version field in npm registry response"));
          }
        } catch {
          reject(new Error("Failed to parse npm registry response"));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request to npm registry timed out"));
    });
  });
}

/**
 * Checks if the installed CLI version matches the latest on npm.
 * Returns `true` if up-to-date (or if the check fails due to network issues).
 * Returns `false` if outdated — the caller should block execution.
 */
export async function checkForUpdate(): Promise<boolean> {
  try {
    const installed = getInstalledVersion();
    const latest = await fetchLatestVersion();

    if (installed === latest) {
      return true;
    }

    // Build a styled update-required box
    const W = 68;
    const empty = () =>
      chalk.redBright("║") + " ".repeat(W) + chalk.redBright("║");
    const border = (c: string) =>
      chalk.redBright(c + "═".repeat(W) + (c === "╔" ? "╗" : "╝"));
    const line = (styled: string, visualLen: number) => {
      const padding = " ".repeat(Math.max(0, W - visualLen));
      return chalk.redBright("║") + styled + padding + chalk.redBright("║");
    };

    const instText = `   Installed version:  ${installed}`;
    const latText = `   Latest version:     ${latest}`;
    const cmdText = `   Run: npm install -g ${PACKAGE_NAME}@latest`;

    console.log();
    console.log(border("╔"));
    console.log(empty());
    console.log(
      line(
        chalk.bold.redBright("   ⚠ ZEROTHREAT CLI UPDATE REQUIRED"),
        "   ⚠ ZEROTHREAT CLI UPDATE REQUIRED".length
      )
    );
    console.log(empty());
    console.log(
      line(
        chalk.white("   Installed version:  ") + chalk.yellow(installed),
        instText.length
      )
    );
    console.log(
      line(
        chalk.white("   Latest version:     ") + chalk.green(latest),
        latText.length
      )
    );
    console.log(empty());
    console.log(line(chalk.cyan(cmdText), cmdText.length));
    console.log(empty());
    console.log(border("╚"));
    console.log();

    return false;
  } catch {
    // Network error, timeout, or registry unreachable — let CLI proceed
    return true;
  }
}
