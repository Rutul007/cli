import axios, { AxiosInstance, AxiosResponse } from 'axios';
import https from 'https';
import NetworkError from '../utils/network-error';

interface ApiConfig {
    baseURL: string;
    timeout?: number;
}

class ApiService {
    private client: AxiosInstance;

    constructor(config: ApiConfig) {
        this.client = axios.create({
            baseURL: config.baseURL,
            timeout: config.timeout || 0,
            headers: {
                'Content-Type': 'application/json',
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
            }),
        });
    }

    async post<T = any>(endpoint: string, data?: any): Promise<T> {
        try {
            const response: AxiosResponse<T> = await this.client.post(endpoint, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async get<T = any>(endpoint: string): Promise<T> {
        try {
            const response: AxiosResponse<T> = await this.client.get(endpoint);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    async put<T = any>(endpoint: string, data?: any): Promise<T> {
        try {
            const response: AxiosResponse<T> = await this.client.put(endpoint, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    private handleError(error: any): Error {
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.message;
            if (status === 401 || status === 403) {
                return new Error(message || 'Access denied. Your license key or credentials may be invalid.');
            }
            if (status === 404) {
                return new Error(message || 'The requested resource was not found on the server.');
            }
            if (status >= 500) {
                return new Error(message || 'The ZeroThreat server / container encountered an error. Please try again later or contact support.');
            }
            return new Error(message || `Unexpected server response (HTTP ${status}). Please try again.`);
        }
        if (error.request) {
            return new NetworkError(
                'Unable to reach ZeroThreat servers.\n' +
                '  • Check your internet connection\n' +
                '  • Ensure no firewall or proxy is blocking outbound HTTPS\n' +
                '  • Verify the ZeroThreat service is reachable'
            );
        }
        return new Error(`Failed to send request: ${error.message}`);
    }
}

export default ApiService;