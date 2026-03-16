import fs from "fs";
import chalk from "chalk";
import AcrTokenService from "../services/acr-token-service";
import { deleteAcrToken, dockerComposeAcr, setDeleteAcrToken, setDockerComposeAcr } from "../constants/app-constants";
import { updateSystemService } from '../actions/license-service';
import onpremGeneralServices from "../services/general-api";
import path from "path";

const deleteAcr = async () =>{
    // Acr token Delete
    const acrTokenService = new AcrTokenService();
    if (deleteAcrToken) acrTokenService.deleteAcrToken(deleteAcrToken).catch(()=>{})
    setDeleteAcrToken('')
    return;
}

const completeProcess = async () =>{
    const generalService = new onpremGeneralServices()
    await generalService.completeImagePullUp().catch(()=>{})
    return;
}

export async function updateSystem(): Promise<void> {
    console.log(chalk.greenBright("\nUpdating ZeroThreat...\n"));
    try {
        await updateSystemService();  
        await completeProcess();
    } catch (err: any) {
        const msg: string = err?.message || String(err);
        console.log(chalk.red.bold('\n✖ Update Failed\n'));
        console.log(chalk.gray(`  Reason: ${msg}\n`));
        console.log(chalk.bold('  Possible Causes:'));
        console.log(chalk.magenta('  🗝️  License') + chalk.gray(' — Your subscription may have expired or the license could not be verified.'));
        console.log(chalk.magenta('  📶 Network') + chalk.gray(' — Check that your internet connection is active and no firewall is blocking HTTPS.'));
        console.log(chalk.magenta('  🐳 Docker') + chalk.gray(' — The Docker daemon may not be running (`sudo systemctl start docker`).'));
        console.log(chalk.gray('\n  Please retry by selecting "Update Application" from the main menu.'));
        console.log(chalk.gray('  If the problem persists, contact support at hello@zerothreat.ai\n'));
        return;
    } finally {
        await deleteAcr();
        if (dockerComposeAcr) {
            const tempDir = path.dirname(dockerComposeAcr);
            fs.rmSync(tempDir, { recursive: true, force: true });
            setDockerComposeAcr('')
        }
    }
};