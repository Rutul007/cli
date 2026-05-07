#!/usr/bin/env node
import { program } from "commander";
import showMenu from "./src/menu.js";
import { startSetup } from "./src/commands/start-setup.js";
import { config } from "dotenv";
import { checkForUpdate, getInstalledVersion } from "./src/utils/version-check.js";

if (process.env.WORKING_ENVIRONMENT)
  config({
    path: `.env`,
  });

program.name("zt").description("ZEROTHREAT AI CLI").version(getInstalledVersion());

program.command("menu").description("Show main menu").action(showMenu);

program.command("start-setup").action(startSetup);

async function main() {
  const args = process.argv.slice(2);

  // Allow --help and --version to bypass the update check
  const bypassArgs = ["--version", "-V", "--help", "-h"];
  const shouldBypass = args.some((arg) => bypassArgs.includes(arg));

  if (!shouldBypass) {
    const isUpToDate = await checkForUpdate();
    if (!isUpToDate) {
      process.exit(1);
    }
  }

  if (!args.length) {
    await showMenu();
  } else {
    program.parse(process.argv);
  }
}

main();
