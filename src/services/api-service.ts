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
            return new Error(`${error.response.data?.message || 'Unknown error'}`);
        }
        if (error.request) {
            return new NetworkError('Network Error: No response received')
        }
        return new Error(`Request Error: ${error.message}`);
    }
}

export default ApiService;