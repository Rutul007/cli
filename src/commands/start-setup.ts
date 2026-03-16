import { firstIgnition } from "../actions/license-service";
import { ask } from '../utils/ask-que';
import chalk from "chalk";
import activate from "./activate";
import AcrTokenError  from "../utils/acr-error";
import AcrTokenService from "../services/acr-token-service";
import { deleteAcrToken, fingerPrint } from "../constants/app-constants";
import onpremGeneralServices from "../services/general-api";

const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validateLicenseKey = (key: string): boolean => {
    const licenseRegex = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/;
    return licenseRegex.test(key);
};

const deleteAcr = () =>{
    // Acr token Delete
    const acrTokenService = new AcrTokenService();
    if (deleteAcrToken) acrTokenService.deleteAcrToken(deleteAcrToken).catch(()=>{})
    return;
}

const completeProcess = () =>{
    const generalService = new onpremGeneralServices()
    generalService.completeImagePullUp().catch(()=>{})
}


export async function startSetup(): Promise<void> {
    console.log("\nActivating License...\n");

    let email: string;
    do {
        email = await ask(chalk.yellow.bold("📧 Enter Email: "));
        if (!validateEmail(email)) {
            console.log(chalk.red('  ✖ Invalid email address. Please enter a valid format (e.g. user@example.com).\n'));
            console.log(chalk.red('  ✖ Invalid email address. Please enter a valid format (e.g. user@example.com).\n'));
        }
    } while (!validateEmail(email));

    let licenseKey: string;
    do {
        licenseKey = await ask(chalk.yellow.bold("🗝️ Enter License Key (XXXX-XXXX-XXXX-XXXX): "));
        if (!validateLicenseKey(licenseKey)) {
            console.log(chalk.red('  ✖ Invalid license key format.'));
            console.log(chalk.gray('    Expected format: XXXX-XXXX-XXXX-XXXX (4 groups of 4 alphanumeric characters separated by dashes)\n'));
            console.log(chalk.red('  ✖ Invalid license key format.'));
            console.log(chalk.gray('    Expected format: XXXX-XXXX-XXXX-XXXX (4 groups of 4 alphanumeric characters separated by dashes)\n'));
        }
    } while (!validateLicenseKey(licenseKey));

    // Docker Setup
    let token = ''
    try {
        token = await firstIgnition(licenseKey, email);
        completeProcess();
    } catch (err:any) {
        if (err instanceof AcrTokenError) {
            console.log(chalk.red.bold('\n✖ License Verification Failed\n'));
            console.log(chalk.gray(`  Reason: ${err.message}\n`));
            console.log(chalk.bold('  Possible Causes:'));
            console.log(chalk.magenta('  🗝️  License Key') + chalk.gray(' — Double-check that the key and email you entered are correct.'));
            console.log(chalk.magenta('  📅 Expiry') + chalk.gray(' — Your license may have expired or already been activated on another machine.'));
            console.log(chalk.magenta('  📶 Network') + chalk.gray(' — Ensure you have an active internet connection.\n'));
            console.log(chalk.gray('  If the problem persists, contact support at hello@zerothreat.ai\n'));
            return;
        }
        const msg: string = err?.message || String(err);
        console.log(chalk.red.bold('\n✖ Setup Failed\n'));
        console.log(chalk.gray(`  Reason: ${msg}\n`));
        console.log(chalk.yellow('  Please retry the setup. If this keeps happening, contact support at hello@zerothreat.ai .\n'));
        return;
    } finally {
        deleteAcr();
    }


    // License Activation call
    try {
        await activate(token, fingerPrint);
    } catch (err: any) {
        const msg: string = err?.message || String(err);
        console.log(chalk.red.bold('\n✖ License Activation Step Failed\n'));
        console.log(chalk.gray(`  Reason: ${msg}\n`));
        console.log(chalk.gray('  Your Docker containers were set up but the license activation could not complete.'));
        console.log(chalk.gray('  Please retry by selecting "Activate License & Setup" from the main menu.\n'));
        return;
    }
    try {
        await activate(token, fingerPrint);
    } catch (err: any) {
        const msg: string = err?.message || String(err);
        console.log(chalk.red.bold('\n✖ License Activation Step Failed\n'));
        console.log(chalk.gray(`  Reason: ${msg}\n`));
        console.log(chalk.gray('  Your Docker containers were set up but the license activation could not complete.'));
        console.log(chalk.gray('  Please retry by selecting "Activate License & Setup" from the main menu.\n'));
        return;
    }
};