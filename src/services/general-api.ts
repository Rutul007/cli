import ApiService from './api-service';
import { API_CONFIG } from '../config/api-config';


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
class onpremGeneralServices extends ApiService {
    
    constructor() {
        super({
            baseURL: new URL(API_CONFIG().licenseApi).origin,
        });
    }

    //remove
    async completeImagePullUp(): Promise<void> {
        return this.post<void>(`/api/on-prem/release/update/completed`);
    }

}

export default onpremGeneralServices;