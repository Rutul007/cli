import openBrowser from "../utils/open-browser";
import InstallerAppCryptoService from '../tools/crypto-service';
import LicenseApiService, { actiavteLicenseRes } from '../services/license-api-service';
import { displayLicenseTable } from '../utils/license-table';
import chalk from "chalk";
import Table from "cli-table3";

export default async (token:string): Promise<void> => {
    console.log(chalk.blue("\n🚀 Opening Activation Page...\n"));
    
        const licenseService = new LicenseApiService();
        const response : actiavteLicenseRes = await licenseService.activateLicense(token);
        
        if (response.status) {
            // Celebration header
            const table = new Table({
                style: {
                  border: ["blue"],
                  head: [],
                  compact: false,
                },
                chars: {
                  "top": chalk.green("═"),
                  "top-left": chalk.green("╔"),
                  "top-right": chalk.green("╗"),
                  "bottom": chalk.green("═"),
                  "bottom-left": chalk.green("╚"),
                  "bottom-right": chalk.green("╝"),
                  "left": chalk.green("║"),
                  "right": chalk.green("║"),
                },
              });
            table.push(
                [chalk.bold.green('  🎉 CONGRATULATIONS! LICENSE ACTIVATED! 🎉')],
            );
        
            console.log(table.toString());
        
            console.log(chalk.green.bold('\n✨ Welcome to ZeroThreatAI Web Vulnerability Scan Platform! ✨'));
            console.log(chalk.gray('Your license has been successfully activated and is ready to use.\n'));
            
            displayLicenseTable(response);
        } else {
            console.log(chalk.red.bold('\n🚫 License Activation Failed\n'));
            console.log(chalk.gray('We were unable to connect to the ZeroThreatAI servers to complete the'));
            console.log(chalk.gray('license activation. Please check the possible causes and try again.\n'));
            
            console.log(chalk.bold('Reasons'));
            console.log(chalk.red('📄 Reason'));
            console.log(chalk.gray(`   ${response.message}\n`));
            
            console.log(chalk.bold('Possible Causes'));
            console.log(chalk.magenta('📶 Internet Connection'));
            console.log(chalk.gray('   Your device may have lost its connection to the internet.\n'));
            
            console.log(chalk.magenta('💥 System Crash'));
            console.log(chalk.gray('   Your computer may have shut down unexpectedly during the process.\n'));
            
            console.log(chalk.magenta('🛡️  Firewall or Proxy'));
            console.log(chalk.gray('   Network security settings may be blocking the connection.\n'));
            
            console.log(chalk.bold('Next Steps'));
            console.log(chalk.gray('You can retry the activation process or contact our support team for assistance.\n'));
        }
}