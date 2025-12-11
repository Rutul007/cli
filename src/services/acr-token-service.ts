import axios from "axios";
import https from "https"
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import AcrTokenError from "../utils/acr-error";
import { setAcrTokenName, setDockerComposeAcr } from "../constants/app-constants";
import { API_CONFIG } from "../config/api-config";
import ApiService from './api-service';
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

export default class AcrTokenService extends ApiService {
    constructor() {
                super({
                    baseURL: API_CONFIG().onPremLicenseCloudeApi,
                });
            }
    async getAcrToken(licenseKey: string, emailId: string, systemId: string): Promise<{dockerAuth:DockerAuth,activationToken:string}> {
        try {
            const httpsAgent = new https.Agent({
                keepAlive: true,
                family: 4,
                rejectUnauthorized: false,
            });

            const api = axios.create({
                httpsAgent,
                headers: { "Content-Type": "application/json" },
            });

            const response = await this.post('/acr-token', {
                licenseKey,
                emailId,
                systemId
            });

            const { registry, username, password }: AcrTokenResponse = response.tokenInfo;
            
            if (response.dockerComposeAcr) {
                const decodedDockerComposeAcr = Buffer.from(response.dockerComposeAcr, 'base64').toString('utf-8');
                const randomDir = crypto.randomBytes(8).toString('hex');
                const randomFileName = crypto.randomBytes(8).toString('hex') + '.yml';
                const tempDir = path.join(os.tmpdir(), randomDir);
                fs.mkdirSync(tempDir, { recursive: true });
                const filePath = path.join(tempDir, randomFileName);
                fs.writeFileSync(filePath, decodedDockerComposeAcr);
                setDockerComposeAcr(filePath);
            }
            setAcrTokenName(username);
            return{
                dockerAuth:{
                    username,
                    password,
                    serveraddress: registry,
                },
                activationToken:response.activationToken
          
            } ;
        } catch (error: any) {
            throw new AcrTokenError(`${error.message}`);
        }
    }

    async deleteAcrToken(acrTokenName: string): Promise<void> {
        await this.put(`/acr-token/delete?acrTokenName=${acrTokenName}`, {});
    }
}