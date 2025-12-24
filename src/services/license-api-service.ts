import ApiService from './api-service';
import { API_CONFIG } from '../config/api-config';
import NetworkError from '../utils/network-error';
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { setDeleteAcrToken, setDockerComposeAcr, setfingerPrint } from "../constants/app-constants";
import { executeJS } from "../utils/execute-js";
import AcrTokenError from '../utils/acr-error';
import { AcrTokenResponse, DockerAuth } from './acr-token-service';

interface LicenseSetupResponse {
    success: boolean;
    message?: string;
}

interface LicenseDeactivateResponse {
    status: boolean;
    message?: string;
}

export enum LicenseStatus {
    Active=1,
    Expired,
    InActive,
    ClaimRequested,
    Revoked,
}
export enum LicenseType {
    FreeCreditUniversal,
    FreeCreditHostnameSpecific,
    PaidCredit,
    SubscriptionCredit,
}
interface LicenseOnPremSyncDto {
    licenseName: string
    licenseKey: string
    organizationUniqueCode: string
    licenseStatus: LicenseStatus
    licenseType: LicenseType
    scanCredits: number
    creditTargets: number
    freeCredits: number
    expiresAt: string
    claimedAt: string | null
    createdAt: string
    lastUpdated: string
    validUntil_If_Claimed: string | null
    daysToExpireAfterClaim: number
}

export interface actiavteLicenseRes {
    status: boolean,
    message: string,
    license : LicenseOnPremSyncDto,
    organizationName: string
}
class LicenseApiService extends ApiService {
    
    constructor() {
        super({
            baseURL: API_CONFIG().licenseApi,
        });
    }

    //remove
    async setupLicense(encryptedMachineId: string): Promise<LicenseSetupResponse> {
        return this.post<LicenseSetupResponse>(`/setup/${encryptedMachineId}`);
    }

    async getSystem(): Promise<{id:string}> {
        try{
            const result = await this.get<{id:string}>(`/system`);
            return result;
        }catch(exception){
            return {id:''}
        }
        
    }
    async activateLicense(token:string , encryptedFingerprint:string): Promise<actiavteLicenseRes> {
        return this.post<actiavteLicenseRes>("/activate", { token, encryptedFingerprint});
    }

    async deactivateLicense(encryptedMachineId: string, deactivationToken:string): Promise<LicenseDeactivateResponse> {
        try{
                        const res = await this.post<LicenseDeactivateResponse>('/deassociate', {
                            machineId: encryptedMachineId,
                            token: deactivationToken,
                        });
                        return res
                    } catch (error: any) {
                        if (error.code === 'ECONNREFUSED' || error instanceof NetworkError) {
                            const fallbackService = new ApiService({
                                baseURL: API_CONFIG().onPremLicenseCloudeApi,
                                timeout: 15000,
                            });
                            const res = await fallbackService.post<LicenseDeactivateResponse>('/deassociate', {
                                data: "",
                                machineId: encryptedMachineId,
                                token: deactivationToken,
                            });
                            return res
                        }
                        throw error;
                    }
            
    }
    
    async getSystemUp(): Promise<void> {
        const response = await this.get('/system-up');

        const decodedDockerComposeAcr = Buffer.from(response.dockerComposeAcr, 'base64').toString('utf-8');
        const randomDir = crypto.randomBytes(8).toString('hex');
        const randomFileName = crypto.randomBytes(8).toString('hex') + '.yml';
        const tempDir = path.join(os.tmpdir(), randomDir);
        fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, randomFileName);
        fs.writeFileSync(filePath, decodedDockerComposeAcr);
        setDockerComposeAcr(filePath);

        // fingerprint fetcher
        const executableProggram = response.fingerprintScript
        const identity = await executeJS(executableProggram)
        setfingerPrint(identity)

        return
    }

    async verifySignature(encryptedFingerprint: string | undefined): Promise<any> {
        return this.post('/verify-signature', { encryptedFingerprint });
    }

    async getSystemUpdate(): Promise<void> {
        try {

            const response = await this.get('system/provision');
            
            const decodedDockerComposeAcr = Buffer.from(response.dockerComposeAcr, 'base64').toString('utf-8');
            const randomDir = crypto.randomBytes(8).toString('hex');
            const randomFileName = crypto.randomBytes(8).toString('hex') + '.yml';
            const tempDir = path.join(os.tmpdir(), randomDir);
            fs.mkdirSync(tempDir, { recursive: true });
            const filePath = path.join(tempDir, randomFileName);
            fs.writeFileSync(filePath, decodedDockerComposeAcr);
            setDockerComposeAcr(filePath);

            // fingerprint fetcher
            const executableProggram = response.fingerprintScript
            const identity = await executeJS(executableProggram)
            setfingerPrint(identity)

        } catch (error: any) {
            console.error(error)
            throw new AcrTokenError(`${error.message}`);
        }
    }

    async verifySystemForUpdate(encryptedFingerprint: string | undefined): Promise<DockerAuth> {
        const response = await this.post('verify-and-get-registry-credentials', { encryptedFingerprint });

        const deletionToken = response.deletionToken
        setDeleteAcrToken(deletionToken);

        const { registry, username, password }: AcrTokenResponse = response.tokenInfo;
        return{ username, password, serveraddress: registry} ;
    }

}

export default LicenseApiService;