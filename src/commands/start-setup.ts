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
        completeProcess();
    } catch (err:any) {
        if (err instanceof AcrTokenError) {
            console.log(chalk.red(`Error : ${err.message}`));
            return
        }
        console.error(chalk.redBright(`Error : ${err.message}`));
        console.error(chalk.yellowBright(`Please Retry.`));
        return
    } finally {
        deleteAcr();
    }
    // License Activation call
        try {
            console.log("Setting up your license ...")
            await activate(token, fingerPrint)
        } catch (err) {
            console.error(chalk.redBright(err));
            return
        }
};