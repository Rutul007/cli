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
    } catch (err:any) {
        console.error(chalk.redBright(`Error : ${err.message}`));
        console.error(chalk.yellowBright(`Please Retry.`));
        return
    } finally {
        await deleteAcr();
        if (dockerComposeAcr) {
            const tempDir = path.dirname(dockerComposeAcr);
            fs.rmSync(tempDir, { recursive: true, force: true });
            setDockerComposeAcr('')
        }
    }
};