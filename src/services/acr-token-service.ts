import axios from "axios";
import https from "https"
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import AcrTokenError from "../utils/acr-error";
import { setLicenseClaimed, setDockerComposeAcr } from "../constants/app-constants";
import { API_CONFIG } from "../config/api-config";
interface AcrTokenResponse {
    registry: string;
    username: string;
    password: string;
}

export interface DockerAuth {
    username: string;
    password: string;
    serveraddress: string;
}

export default class AcrTokenService {
    async getAcrToken(licenseKey: string, emailId: string, systemId: string): Promise<{dockerAuth:DockerAuth,activationToken:string}> {
        try {
            const httpsAgent = new https.Agent({
                keepAlive: true,
                family: 4,
                rejectUnauthorized: false,
            });

            const api = axios.create({
                httpsAgent,
                timeout: 15000,
                headers: { "Content-Type": "application/json" },
            });

            const response = await api.post(API_CONFIG.acrToken, {
                licenseKey,
                emailId,
                systemId
            });

            const { registry, username, password }: AcrTokenResponse = response.data.tokenInfo;
            setLicenseClaimed(response.data.isLicenseClaimed);
            
            if (response.data.dockerComposeAcr) {
                const decodedDockerComposeAcr = Buffer.from(response.data.dockerComposeAcr, 'base64').toString('utf-8');
                const randomDir = crypto.randomBytes(8).toString('hex');
                const randomFileName = crypto.randomBytes(8).toString('hex') + '.yml';
                const tempDir = path.join(os.tmpdir(), randomDir);
                fs.mkdirSync(tempDir, { recursive: true });
                const filePath = path.join(tempDir, randomFileName);
                fs.writeFileSync(filePath, decodedDockerComposeAcr);
                setDockerComposeAcr(filePath);
            }
            return{
                dockerAuth:{
                    username,
                    password,
                    serveraddress: registry,
                },
                activationToken:response.data.activationToken
          
            } ;
        } catch (error: any) {
            // console.log(error.response)
            throw new AcrTokenError(`${error.response.data.message}`);
        }
    }
}