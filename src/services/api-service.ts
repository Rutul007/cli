import axios, { AxiosInstance } from 'axios';
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

    private isRetryable(error: any): boolean {
        return !!error.request && !error.response;
    }

    private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (!this.isRetryable(error) || attempt === maxAttempts) throw this.handleError(error);
                await new Promise(res => setTimeout(res, 2000));
            }
        }
        throw new Error('Unexpected retry exit');
    }

    async post<T = any>(endpoint: string, data?: any): Promise<T> {
        return this.withRetry(() => this.client.post<T>(endpoint, data).then(r => r.data));
    }

    async get<T = any>(endpoint: string): Promise<T> {
        return this.withRetry(() => this.client.get<T>(endpoint).then(r => r.data));
    }

    async put<T = any>(endpoint: string, data?: any): Promise<T> {
        return this.withRetry(() => this.client.put<T>(endpoint, data).then(r => r.data));
    }

    private handleError(error: any): Error {
        if (error.response) {
            const status = error.response.status;
            const message = error.response.data?.message || error.response.data?.json?.message || error.response.data?.error;
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