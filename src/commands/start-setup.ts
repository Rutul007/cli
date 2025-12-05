import { firstIgnition } from "../actions/license-service";
import { ask } from '../utils/ask-que';
import chalk from "chalk";
import activate from "./activate";
import AcrTokenError  from "../utils/acr-error";
import { isLicenseClaimed } from "../constants/app-constants";

const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validateLicenseKey = (key: string): boolean => {
    const licenseRegex = /^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/;
    return licenseRegex.test(key);
};

export async function startSetup(): Promise<void> {
    console.log("\nActivating License...\n");

    let email: string;
    do {
        email = await ask(chalk.yellow.bold("📧 Enter Email: "));
        if (!validateEmail(email)) {
            console.log("Invalid email format. Please try again.");
        }
    } while (!validateEmail(email));

    let licenseKey: string;
    do {
        licenseKey = await ask(chalk.yellow.bold("🗝️ Enter License Key (XXXX-XXXX-XXXX-XXXX): "));
        if (!validateLicenseKey(licenseKey)) {
            console.log("Invalid license key format. Must be XXXX-XXXX-XXXX-XXXX where X is a number.");
        }
    } while (!validateLicenseKey(licenseKey));

    // Docker Setup
    let token = ''
    try {
        token = await firstIgnition(licenseKey, email);
    } catch (err:any) {
        if (err instanceof AcrTokenError) {
            console.log(chalk.red(`Error : ${err.message}`));
            return
        }
        console.error(chalk.redBright(`Error : ${err.message}`));
        console.error(chalk.yellowBright(`Please Retry.`));
        return
    }
    // License Activation call
        try {
            console.log("Setting up your license ...")
            await activate(token)
            return
        } catch (err) {
            console.error(chalk.redBright(err));
            return
        }
};