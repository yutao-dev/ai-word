const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

class ApiService {
    constructor(baseUrl = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        const response = await fetch(url, config);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || `HTTP error! status: ${response.status}`);
        }

        return response.json();
    }

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

export const api = new ApiService();

export const documentApi = {
    getAll: () => api.get('/documents/'),
    getById: (id) => api.get(`/documents/${id}`),
    create: (data) => api.post('/documents/', data),
    update: (id, data) => api.put(`/documents/${id}`, data),
    delete: (id) => api.delete(`/documents/${id}`),
};

export const aiApi = {
    getConfigs: () => api.get('/ai/configs'),
    createConfig: (data) => api.post('/ai/configs', data),
    updateConfig: (id, data) => api.put(`/ai/configs/${id}`, data),
    deleteConfig: (id) => api.delete(`/ai/configs/${id}`),
    chat: (data) => api.post('/ai/chat', data),
};

export const workflowApi = {
    execute: (data) => api.post('/workflow/execute', data),
};

export default api;
