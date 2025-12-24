import chalk from "chalk";
import AcrTokenError  from "../utils/acr-error";
import AcrTokenService from "../services/acr-token-service";
import { deleteAcrToken, setDeleteAcrToken } from "../constants/app-constants";
import { updateSystemService } from '../actions/license-service';
import onpremGeneralServices from "../services/general-api";

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
    console.log(chalk.greenBright("\nUpdating Zero Threat...\n"));
    try {
        await updateSystemService();  
        await completeProcess();
    } catch (err:any) {
        if (err instanceof AcrTokenError) {
            console.log(chalk.red(`Error : ${err.message}`));
            return
        }
        console.error(chalk.redBright(`Error : ${err.message}`));
        console.error(chalk.yellowBright(`Please Retry.`));
        return
    } finally {
        await deleteAcr();
    }
};