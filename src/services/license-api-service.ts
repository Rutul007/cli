import ApiService from './api-service';
import { API_CONFIG } from '../config/api-config';

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
            baseURL: API_CONFIG.licenseApi,
            timeout: 15000,
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
    async activateLicense(token:string): Promise<actiavteLicenseRes> {
        return this.post<actiavteLicenseRes>("/activate", { token});
    }

    async deactivateLicense(encryptedMachineId: string, deactivationToken:string): Promise<LicenseDeactivateResponse> {
        return this.post<LicenseDeactivateResponse>('/deassociate', {
            machineId: encryptedMachineId,
            token: deactivationToken,
        });
    }
}

export default LicenseApiService;