export interface ApiEndpoints {
  licenseApi: string;
  onPremLicenseCloudeApi: string;
}

export const API_CONFIG = (): ApiEndpoints => {
  if (!process.env.WORKING_ENVIRONMENT) {
    return {
      licenseApi: `http://localhost:3201/api/license`,
      onPremLicenseCloudeApi: `https://zt-rc1-1-app-containerapps.agreeablestone-ae5e635a.centralus.azurecontainerapps.io/api/on-prem/license`,
    };
  } else {
    return {
      licenseApi: process.env.LICENSE_API as string,
      onPremLicenseCloudeApi: process.env.CLOUD_API as string,
    };
  }
};
