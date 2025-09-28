const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public originalError?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiEmployee {
  id: number;
  name: string;
  surname: string;
  patronymic: string;
}

export interface ApiOrder {
  id: string;
  employee: ApiEmployee;
  description: string;
  createdAt: string;
  lastModified: string;
}

export interface ApiOrderResponse {
  content: ApiOrder[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApiJobInfo {
  id: number;
  status: string;
  createDate: string;
  lastModified: string;
}

export interface ApiJob {
  id: number;
  job: ApiJobInfo;
  actionType: 'TOOLS_ISSUANCE' | 'TOOLS_RETURN';
  order: ApiOrder;
  createDate: string;
}

export interface ApiJobsResponse {
  content: ApiJob[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApiToolInfo {
  id: number;
  name: string;
  partNumber: string;
  description?: string;
}

export interface ApiToolsResponse {
  content: ApiToolInfo[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApiToolReference {
  id: number;
  toolName: string;
}

export interface ApiTool {
  id: number;
  name: string;
  toolReference: ApiToolReference;
}

export interface ApiOrderTool {
  id: number;
  order: ApiOrder;
  tool: ApiTool;
}

export interface ApiOrderToolsResponse {
  content: ApiOrderTool[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface ApiPackageId {
  id: number;
  status: string;
  createDate: string;
  lastModified: string;
}

export interface ApiFileInfo {
  id: number;
  packageId: ApiPackageId;
  createdAt: string;
  bucketName: string;
  filePath: string;
  fileName: string;
}

export interface ApiRecognitionResult {
  toolId: number;
  toolName: string;
  partNumber: string;
  required: number;
  found: number;
  status: 'found' | 'not_found' | 'not_expected';
  confidence?: number;
}

// New interfaces for recognition results with image data
export interface ApiRecognitionResultDetailed {
  id: number;
  job: ApiJobInfo;
  tool: ApiTool;
  file: ApiFileInfo | null;
  preprocessResult: {
    id: number;
    job: ApiJobInfo;
    toolReference: ApiToolReference | null;
    file: ApiFileInfo | null;
    originalFile: ApiFileInfo;
    confidence: number | null;
    createdAt: string;
  };
  confidence: number;
  createdAt: string;
  marking: string | null;
}

export interface ApiPreprocessData {
  source_image_key: string;
  object_key: string;
  class_id: number;
  macro_class: string;
  confidence: number;
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  timestamp: string;
}

class ApiService {
  private async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      
      // Специфичные сообщения для разных статусов
      switch (response.status) {
        case 400:
          throw new ApiError(`Сервис распознавания недоступен: ${errorText}`, 400, errorText);
        case 422:
          throw new ApiError(`Не удалось распознать инструменты на фото: ${errorText}`, 422, errorText);
        case 404:
          throw new ApiError(`Ресурс не найден: ${errorText}`, 404, errorText);
        case 500:
          throw new ApiError(`Внутренняя ошибка сервера: ${errorText}`, 500, errorText);
        default:
          throw new ApiError(`HTTP ${response.status}: ${errorText}`, response.status, errorText);
      }
    }
    
    return response;
  }

  // Orders
  async getOrders(page = 0, size = 10): Promise<ApiOrder[]> {
    const response = await this.makeRequest(`${API_BASE_URL}/orders?page=${page}&size=${size}`);
    return response.json();
  }

  async getOrder(orderId: string) {
    const response = await this.makeRequest(`${API_BASE_URL}/orders/${orderId}`);
    return response.json();
  }

  async getOrderTools(orderId: string, page = 0, size = 20): Promise<ApiOrderTool[]> {
    const response = await this.makeRequest(`${API_BASE_URL}/orders/${orderId}/tools?page=${page}&size=${size}`);
    return response.json();
  }

  async createOrder(orderData: ApiOrder): Promise<string> {
    const response = await this.makeRequest(`${API_BASE_URL}/orders`, {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
    return response.text();
  }

  // Jobs
  async getJobs(query?: string, page = 0, size = 10): Promise<ApiJob[]> {
    const url = new URL(`${API_BASE_URL}/jobs`, window.location.origin);
    if (query) url.searchParams.set('query', query);
    url.searchParams.set('page', page.toString());
    url.searchParams.set('size', size.toString());
    
    const response = await this.makeRequest(url.toString());
    return response.json();
  }

  async getJobsByOrderId(orderId: string): Promise<ApiJob[]> {
    const jobs = await this.getJobs(orderId);
    return jobs || [];
  }

  async createJob(orderId: string, actionType: 'TOOLS_ISSUANCE' | 'TOOLS_RETURN'): Promise<void> {
    await this.makeRequest(`${API_BASE_URL}/jobs?orderId=${orderId}&actionType=${actionType}`, {
      method: 'POST',
    });
    // backend may return empty body; creation is asynchronous
  }

  async getJob(jobId: number) {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
    if (!response.ok) throw new Error('Failed to fetch job');
    return response.json();
  }

  async uploadFile(jobId: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/files`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      
      // Специфичные сообщения для разных статусов при загрузке файлов
      switch (response.status) {
        case 400:
          // Проверяем, является ли это ошибкой превышения лимита файлов
          if (errorText.includes('Превышен лимит файлов для Job') || 
              errorText.includes('Чтобы добавить новый файл, удалите предыдущие')) {
            throw new ApiError('Превышен лимит файлов для Job. Чтобы добавить новый файл, удалите предыдущие.', 400, errorText);
          }
          throw new ApiError(`Сервис распознавания недоступен: ${errorText}`, 400, errorText);
        case 422:
          throw new ApiError(`Не удалось распознать инструменты на фото: ${errorText}`, 422, errorText);
        case 404:
          throw new ApiError(`Задача обработки не найдена: ${errorText}`, 404, errorText);
        case 413:
          throw new ApiError(`Файл слишком большой: ${errorText}`, 413, errorText);
          case 415:
            throw new ApiError(`Неподдерживаемый формат файла. Выберите JPG, PNG или MP4: ${errorText}`, 415, errorText);
        case 500:
          throw new ApiError(`Внутренняя ошибка сервера: ${errorText}`, 500, errorText);
        default:
          throw new ApiError(`HTTP ${response.status}: ${errorText}`, response.status, errorText);
      }
    }
    
    // Some backends return empty body on successful upload
    return undefined as unknown as void;
  }

  async getJobFiles(jobId: number, type: 'RAW' | 'PROCESSED' | 'ALL' = 'ALL'): Promise<ApiFileInfo[]> {
    const response = await this.makeRequest(`${API_BASE_URL}/jobs/${jobId}/files?type=${type}`);
    return response.json();
  }

  async deleteFile(fileId: number): Promise<void> {
    const response = await this.makeRequest(`${API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
    });
    // DELETE request might not return content, so we don't call .json()
  }

  async startClassification(jobId: number): Promise<void> {
    const response = await this.makeRequest(`${API_BASE_URL}/jobs/${jobId}/classify`, {
      method: 'POST',
    });
    // Backend may return empty body on success
    return undefined;
  }

  async getCompareResults(jobId: number) {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/results/compare`);
    if (!response.ok) throw new Error('Failed to fetch compare results');
    return response.json();
  }

  async getClassificationResults(jobId: number) {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/results/classification`);
    if (!response.ok) throw new Error('Failed to fetch classification results');
    return response.json();
  }

  async getResults(jobId: number) {
    const response = await this.makeRequest(`${API_BASE_URL}/jobs/${jobId}/results`);
    return response.json();
  }

  // Job status
  async getJobStatus(jobId: number) {
    const response = await this.makeRequest(`${API_BASE_URL}/jobs/${jobId}/status`);
    return response.json();
  }

  // Preprocess results (macroclass detection results)
  async getPreprocessResults(jobId: number) {
    const response = await this.makeRequest(`${API_BASE_URL}/jobs/${jobId}/results/preprocess`);
    return response.json();
  }

  async updateJobStatus(jobId: number, jobStatus: 'STARTED' | 'PREPROCESS' | 'FINISHED' | 'MANUAL_MAPPING_IS_REQUIRED' | 'VALIDATION') {
    const url = new URL(`${API_BASE_URL}/jobs/${jobId}/status`, window.location.origin);
    url.searchParams.set('jobStatus', jobStatus);
    const response = await this.makeRequest(url.toString(), { method: 'POST' });
    return response.json();
  }

  // Tools
  async getTools(): Promise<ApiToolsResponse> {
    const response = await this.makeRequest(`${API_BASE_URL}/tools`);
    return response.json();
  }

  async getTool(toolId: number) {
    const response = await fetch(`${API_BASE_URL}/tools/${toolId}`);
    if (!response.ok) throw new Error('Failed to fetch tool');
    return response.json();
  }

  // MinIO methods for image and data retrieval using existing file endpoints
  async getFileFromMinIO(fileId: number): Promise<string> {
    // Use existing endpoint to get file from MinIO by ID
    const response = await this.makeRequest(`${API_BASE_URL}/files/${fileId}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  async getPreprocessDataFromMinIO(fileId: number): Promise<ApiPreprocessData> {
    // Get preprocess JSON data from MinIO using file ID
    const response = await this.makeRequest(`${API_BASE_URL}/files/${fileId}`);
    return response.json();
  }

  // Enhanced results method that returns detailed data
  async getDetailedResults(jobId: number): Promise<ApiRecognitionResultDetailed[]> {
    const response = await this.makeRequest(`${API_BASE_URL}/jobs/${jobId}/results`);
    return response.json();
  }

  // Test model method for uploading archive and creating TEST job
  async testModel(file: File): Promise<{ jobId: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/test/model`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      
      // Специфичные сообщения для разных статусов при загрузке архива
      switch (response.status) {
        case 400:
          throw new ApiError(`Сервис тестирования недоступен: ${errorText}`, 400, errorText);
        case 422:
          throw new ApiError(`Не удалось обработать архив: ${errorText}`, 422, errorText);
        case 404:
          throw new ApiError(`Сервис тестирования не найден: ${errorText}`, 404, errorText);
        case 413:
          throw new ApiError(`Архив слишком большой: ${errorText}`, 413, errorText);
        case 415:
          throw new ApiError(`Неподдерживаемый формат архива. Выберите ZIP архив: ${errorText}`, 415, errorText);
        case 500:
          throw new ApiError(`Внутренняя ошибка сервера: ${errorText}`, 500, errorText);
        default:
          throw new ApiError(`HTTP ${response.status}: ${errorText}`, response.status, errorText);
      }
    }
    
    const result = await response.json();
    console.log('testModel API response:', result);
    
    // Сервер возвращает просто число (jobId), а не объект
    let jobId: number;
    if (typeof result === 'number') {
      jobId = result;
    } else if (result && typeof result.jobId === 'number') {
      jobId = result.jobId;
    } else {
      throw new ApiError('Неверный формат ответа от сервера: ожидается число (jobId)', 500);
    }
    
    return { jobId };
  }
}

export const apiService = new ApiService();