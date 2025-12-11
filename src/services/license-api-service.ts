import ApiService from './api-service';
import { API_CONFIG } from '../config/api-config';
import NetworkError from '../utils/network-error';

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
    async activateLicense(token:string): Promise<actiavteLicenseRes> {
        return this.post<actiavteLicenseRes>("/activate", { token});
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
}

export default LicenseApiService;