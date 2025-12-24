import inquirer from "inquirer";
import chalk from "chalk";
import {startSetup} from "./commands/start-setup";
import deactivate from "./commands/deactivate";
import { installDocker } from "./commands/install-docker";
import { restartService } from "./commands/restart-service";
import { updateSystem } from "./commands/update";

export default async function showMenu(): Promise<void> {
  console.clear();
  
  // Header with description
  console.log(chalk.gray('╔' + '═'.repeat(78) + '╗'));
  console.log(chalk.gray('║') + chalk.bold.magenta('                        ZEROTHREAT ON-PREM INSTALLER                          ') + chalk.gray('║'));
  console.log(chalk.gray('╠' + '═'.repeat(78) + '╣'));
  console.log(chalk.gray('║') + ' '.repeat(78) + chalk.gray('║'));
  console.log(chalk.gray('║') + chalk.bold.white('  AppSec without Noise or Complexity                                          ') + chalk.gray('║'));
  console.log(chalk.gray('║') + chalk.white('  Continuous Pentesting for Web Apps & APIs at Dev Speed                      ') + chalk.gray('║'));
  console.log(chalk.gray('║') + ' '.repeat(78) + chalk.gray('║'));
  console.log(chalk.gray('║') + chalk.gray('  Ship 10× faster with audit-ready compliance. ZeroThreat protects            ') + chalk.gray('║'));
  console.log(chalk.gray('║') + chalk.gray('  modern web apps & APIs through continuous pentesting, actionable            ') + chalk.gray('║'));
  console.log(chalk.gray('║') + chalk.gray('  insights, and coverage for 40,000+ vulnerabilities.                         ') + chalk.gray('║'));
  console.log(chalk.gray('║') + ' '.repeat(78) + chalk.gray('║'));
  console.log(chalk.gray('║') +   chalk.bold.green('  🛡️  On-Premise Installation Tool                                             ') + chalk.gray('║'));
  console.log(chalk.gray('║') + ' '.repeat(78) + chalk.gray('║'));
  console.log(chalk.gray('╚' + '═'.repeat(78) + '╝'));
  console.log();

  // Menu options box
  console.log(chalk.gray('╔═ ' + chalk.bold.white('MAIN MENU') + ' ═' + '═'.repeat(65) + '╗'));
  console.log(chalk.gray('║  ') + ' '.repeat(76) + chalk.gray('║'));
  
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: chalk.bold.cyan("Select an action:"),
      choices: [
        { 
          name: chalk.green("⚙️  Install Prerequisite Software for Linux Environment"), 
          value: "System Check" 
        },
        { 
          name: chalk.green("🔑 Activate License & Setup"), 
          value: "Start Setup" 
        },
        { 
          name: chalk.cyan("🔄️ Start application if container shuts down"), 
          value: "Restart" 
        },
        { 
          name: chalk.redBright("⛔ Deassociate License & System"), 
          value: "Deactivate License" 
        },
        {
          name: chalk.yellow("⬆️  Update Application"),
          value: "Update System",
        },
        { 
          name: chalk.white("❌ Exit"), 
          value: "Exit" 
        },
      ],
      loop: false,
      prefix:"║",
    },
  ]);
  
  console.log(chalk.gray('║') + ' '.repeat(78) + chalk.gray('║'));
  console.log(chalk.gray('╚' + '═'.repeat(78) + '╝'));

  switch (action) {
    case "Start Setup":
      await startSetup();
      break;
    case "Deactivate License":
      await deactivate();
      break;
    case "System Check":
      await installDocker();
      break;
    case "Restart":
      await restartService();
      break;
    case "Update System":
      await updateSystem();
      break;
    default:
      console.log("Exiting...");
      console.clear();
      process.exit(0);
  }

  // Status separator
  console.log();
  console.log(chalk('-'.repeat(80)));
  console.log();

  // Navigation box
  console.log(chalk.gray('╔═ ' + chalk.bold.white('NEXT') + ' ═' + '═'.repeat(60) + '╗'));
  console.log(chalk.gray('║  ') + ' '.repeat(66) + chalk.gray('║'));
  
  const { close } = await inquirer.prompt([
    {
      type: "list",
      name: "close",
      message: " ",
      choices: [
        { name: chalk.white("🏠 Main Menu"), value: "menu" },
        { name: chalk.red("🚪 Exit Application"), value: "Exit" }
      ],
      theme: {
        style: {
          highlight: chalk.bgBlue.white
        }
      }
    },
  ]);
  
  console.log(chalk.green('└' + '─'.repeat(74) + '┘'));

  switch (close) {
    case "menu":
      await showMenu();
      break;
    default:
      console.log("Exiting...");
      console.clear();
      process.exit(0);
  }
}