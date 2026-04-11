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
    deleteByRange: (id, start, end) => api.post(`/documents/${id}/delete-by-range`, { start, end }),
    deleteAndSwap: (id, deleteStart, deleteEnd, swapContent) => api.post(`/documents/${id}/delete-and-swap`, { 
        delete_start: deleteStart, 
        delete_end: deleteEnd, 
        swap_content: swapContent 
    }),
    insertEnd: (id, content) => api.post(`/documents/${id}/insert-end`, { content }),
    updateContent: (id, newContent) => api.post(`/documents/${id}/update-content`, { new_content: newContent }),
    search: (id, keyword, options = {}) => api.post(`/documents/${id}/search`, { 
        keyword, 
        case_sensitive: options.caseSensitive || false,
        use_regex: options.useRegex || false,
        context_lines: options.contextLines || 2
    }),
    findReplace: (id, findText, replaceText, options = {}) => api.post(`/documents/${id}/find-replace`, {
        find_text: findText,
        replace_text: replaceText,
        replace_all: options.replaceAll || false,
        case_sensitive: options.caseSensitive || false
    }),
    getOutline: (id) => api.get(`/documents/${id}/outline`),
    getSection: (id, headingText) => api.get(`/documents/${id}/section/${encodeURIComponent(headingText)}`),
    insertAfterHeading: (id, headingText, content, headingLevel = null) => api.post(`/documents/${id}/insert-after-heading`, {
        heading_text: headingText,
        content,
        heading_level: headingLevel
    }),
    insertAt: (id, positionType, positionValue, content) => api.post(`/documents/${id}/insert-at`, {
        position_type: positionType,
        position_value: positionValue,
        content
    }),
    insertParagraph: (id, content, options = {}) => api.post(`/documents/${id}/insert-paragraph`, {
        content,
        after_line: options.afterLine,
        before_line: options.beforeLine,
        add_blank_lines: options.addBlankLines !== false
    }),
    getStats: (id) => api.get(`/documents/${id}/stats`),
    extract: (id, extractType) => api.get(`/documents/${id}/extract/${extractType}`),
    batchOperations: (id, operations, stopOnError = false) => api.post(`/documents/${id}/batch`, {
        operations,
        stop_on_error: stopOnError
    }),
    moveSection: (id, fromHeading, toPosition, toPositionValue, afterHeading = null) => api.post(`/documents/${id}/move-section`, {
        from_heading: fromHeading,
        to_position: toPosition,
        to_position_value: toPositionValue,
        after_heading: afterHeading
    }),
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
    executeStream: (data, onMessage, onError, onComplete) => {
        const url = `${API_BASE_URL}/workflow/execute`;
        const contextMode = data.context_mode || 'limited';
        const eventSource = new EventSource(`${url}?user_request=${encodeURIComponent(data.user_request)}&document_id=${encodeURIComponent(data.document_id)}&model=${encodeURIComponent(data.model)}&max_iterations=${data.max_iterations}&context_mode=${contextMode}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        };

        eventSource.onerror = (error) => {
            onError(error);
            eventSource.close();
        };

        eventSource.onclose = () => {
            onComplete();
        };

        return eventSource;
    },
    executeStreamV2: (data, onMessage, onError, onComplete) => {
        const url = `${API_BASE_URL}/workflow/execute-v2`;
        const contextMode = data.context_mode || 'limited';
        const eventSource = new EventSource(`${url}?user_request=${encodeURIComponent(data.user_request)}&document_id=${encodeURIComponent(data.document_id)}&model=${encodeURIComponent(data.model)}&max_iterations=${data.max_iterations}&context_mode=${contextMode}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        };

        eventSource.onerror = (error) => {
            onError(error);
            eventSource.close();
        };

        eventSource.onclose = () => {
            onComplete();
        };

        return eventSource;
    },
    executeStreamV3: (data, onMessage, onError, onComplete) => {
        const url = `${API_BASE_URL}/workflow/execute-v3`;
        const contextMode = data.context_mode || 'limited';
        const eventSource = new EventSource(`${url}?user_request=${encodeURIComponent(data.user_request)}&document_id=${encodeURIComponent(data.document_id)}&model=${encodeURIComponent(data.model)}&max_iterations=${data.max_iterations}&context_mode=${contextMode}`);

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                onMessage(data);
            } catch (error) {
                console.error('Error parsing SSE message:', error);
            }
        };

        eventSource.onerror = (error) => {
            onError(error);
            eventSource.close();
        };

        eventSource.onclose = () => {
            onComplete();
        };

        return eventSource;
    },
};

export const tokenUsageApi = {
    getStats: () => api.get('/token-usage/stats'),
    getHistory: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/token-usage/?${query}`);
    },
    getByWorkflow: (workflowId) => api.get(`/token-usage/workflow/${workflowId}`),
    getRecentWorkflowStats: (limit = 10) => api.get(`/token-usage/workflow-stats/recent?limit=${limit}`),
    clear: () => api.delete('/token-usage/'),
};

export default api;
