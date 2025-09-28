import { useState, useEffect, useCallback } from "react";
import { OrdersList, Order } from "@/components/OrdersList";
import { OrderDetails } from "@/components/OrderDetails";
import { FileUpload } from "@/components/FileUpload";
import { RecognitionResults } from "@/components/RecognitionResults";
import { TestModelUpload } from "@/components/TestModelUpload";
import { TestModelResults } from "@/components/TestModelResults";
import { useToast } from "@/hooks/use-toast";
import { apiService, ApiError } from "@/lib/api";

type ViewState = "orders" | "details" | "upload" | "results" | "testModel" | "testResults";
type ActionType = "issue" | "return";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadDate: Date;
  status: "uploaded" | "processing" | "processed";
}

interface JobData {
  jobId: number;
  orderId: string;
  actionType: "TOOLS_ISSUANCE" | "TOOLS_RETURN";
}

interface TestJobData {
  jobId: number;
}

// Empty initial orders - will be loaded from API
const initialOrders: Order[] = [];

const Index = () => {
  const [currentView, setCurrentView] = useState<ViewState>("orders");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType>("issue");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [testJobData, setTestJobData] = useState<TestJobData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selectedOrder = orders.find(order => order.id === selectedOrderId);

  // paging state
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Load orders on component mount
  useEffect(() => {
    loadOrders(0, false);
  }, []);

  // Restore view state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('afl-tools-ui-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        
        // Проверяем валидность состояний перед восстановлением
        if (parsed.currentView && ['orders', 'details', 'upload', 'results', 'testModel', 'testResults'].includes(parsed.currentView)) {
          // Если это testResults, проверяем что testJobData валидный
          if (parsed.currentView === 'testResults') {
            if (parsed.testJobData && typeof parsed.testJobData.jobId === 'number') {
              setCurrentView(parsed.currentView);
              setTestJobData(parsed.testJobData);
            } else {
              console.log('Invalid testJobData, staying on orders view');
              setCurrentView("orders");
            }
          } else {
            setCurrentView(parsed.currentView);
          }
        }
        
        if (parsed.selectedOrderId) setSelectedOrderId(parsed.selectedOrderId);
        if (parsed.actionType) setActionType(parsed.actionType);
        if (parsed.jobData) setJobData(parsed.jobData);
        if (parsed.testJobData && parsed.currentView !== 'testResults') setTestJobData(parsed.testJobData);
      }
    } catch (error) {
      console.error('Error restoring state from localStorage:', error);
      // Очищаем поврежденное состояние
      localStorage.removeItem('afl-tools-ui-state');
    }
  }, []);

  // Persist view state to localStorage
  useEffect(() => {
    const data = {
      currentView,
      selectedOrderId,
      actionType,
      jobData,
      testJobData,
    };
    try {
      localStorage.setItem('afl-tools-ui-state', JSON.stringify(data));
    } catch {}
  }, [currentView, selectedOrderId, actionType, jobData, testJobData]);

  const loadOrders = async (targetPage = 0, append = false) => {
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      const apiOrders = await apiService.getOrders(targetPage, pageSize);
      console.log('Loaded orders from API:', apiOrders);
      
      // Transform API response to match our Order interface
      const transformedOrders = await Promise.all(
        apiOrders.map(async (apiOrder) => {
          let itemsCount = 0;
          let computedStatus: "awaiting_issue" | "awaiting_return" | "completed" = "awaiting_issue";

          await Promise.all([
            (async () => {
              try {
                const toolsResponse = await apiService.getOrderTools(apiOrder.id);
                itemsCount = toolsResponse?.length || 0;
              } catch (error) {
                console.error(`Failed to load tools for order ${apiOrder.id}:`, error);
                itemsCount = 0;
              }
            })(),
            (async () => {
              try {
                const jobs = await apiService.getJobsByOrderId(apiOrder.id);
                const issueJob = jobs.find(j => j.actionType === 'TOOLS_ISSUANCE');
                const returnJob = jobs.find(j => j.actionType === 'TOOLS_RETURN');
                const isIssueFinished = issueJob ? (issueJob.job?.status?.includes('FINISHED') || issueJob.job?.status === 'FINISHED') : false;
                const isReturnFinished = returnJob ? (returnJob.job?.status?.includes('FINISHED') || returnJob.job?.status === 'FINISHED') : false;
                if (isIssueFinished && isReturnFinished) computedStatus = 'completed';
                else if (isIssueFinished) computedStatus = 'awaiting_return';
                else computedStatus = 'awaiting_issue';
              } catch (error) {
                console.error(`Failed to load jobs for order ${apiOrder.id}:`, error);
                computedStatus = 'awaiting_issue';
              }
            })(),
          ]);

          return {
            id: apiOrder.id,
            orderNumber: apiOrder.id,
            aircraft: apiOrder.description || "Описание не указано",
        department: "Техническое обслуживание",
            requestedDate: apiOrder.createdAt,
            status: computedStatus,
            itemsCount,
            requester: `${apiOrder.employee.surname} ${apiOrder.employee.name} ${apiOrder.employee.patronymic}`
          };
        })
      );
      
      console.log('Transformed orders with tools count:', transformedOrders);
      if (append) {
        const existingIds = new Set(orders.map(o => o.id));
        const toAdd = transformedOrders.filter(o => !existingIds.has(o.id));
        setOrders(prev => [...prev, ...toAdd]);
      } else {
        setOrders(transformedOrders);
      }
      setPage(targetPage);
      setHasMore(apiOrders.length === pageSize);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setOrders([]); // No fallback to mock data
      
      let errorMessage = "Не удалось загрузить заказы из системы ТОиР";
      
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            errorMessage = "Сервис распознавания недоступен. Попробуйте позже.";
            break;
          case 404:
            errorMessage = "Сервис распознавания не найден. Проверьте подключение.";
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      toast({
        title: "Ошибка загрузки",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  };

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    await loadOrders(page + 1, true);
  }, [loadingMore, hasMore, page, pageSize, orders]);

  const handleIssueOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setActionType("issue");
    setCurrentView("details");
  };

  const handleReturnOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setActionType("return");
    setCurrentView("details");
  };

  const handleBackToOrders = () => {
    setCurrentView("orders");
    setSelectedOrderId(null);
    setUploadedFiles([]);
    setJobData(null);
    setTestJobData(null);
    try { localStorage.removeItem('afl-tools-ui-state'); } catch {}
  };

  const handleTestModel = () => {
    setCurrentView("testModel");
  };

  const handleBackFromTestModel = () => {
    setCurrentView("orders");
  };

  const handleNextFromTestModel = (jobId: number) => {
    console.log('Setting testJobData with jobId:', jobId);
    setTestJobData({ jobId });
    setCurrentView("testResults");
  };

  const handleBackFromTestResults = () => {
    setCurrentView("testModel");
  };

  const handleCompleteTestModel = () => {
    toast({
      title: "Тестирование завершено",
      description: "Результаты тестирования модели получены",
    });
    handleBackToOrders();
  };

  const handleNextFromDetails = async () => {
    if (!selectedOrder) return;
    
    try {
      setLoading(true);
      const apiActionType = actionType === "issue" ? "TOOLS_ISSUANCE" : "TOOLS_RETURN";
      
      // First, try to find existing job for this order and action type
      const existingJobs = await apiService.getJobsByOrderId(selectedOrder.id);
      console.log('Found existing jobs:', existingJobs);
      
      const existingJob = existingJobs.find(job => job.actionType === apiActionType);
      
      let jobIdToUse: number | null = null;
      if (existingJob) {
        jobIdToUse = existingJob.job?.id ?? existingJob.id;
      } else {
        // Create new job and then re-fetch jobs to obtain its id immediately
        await apiService.createJob(selectedOrder.id, apiActionType);
        const refreshedJobs = await apiService.getJobsByOrderId(selectedOrder.id);
        const created = refreshedJobs.find(j => j.actionType === apiActionType);
        jobIdToUse = created?.job?.id ?? created?.id ?? null;
      }

      if (!jobIdToUse) {
        throw new Error('Job was not created');
      }
      
      setJobData({
        jobId: jobIdToUse,
        orderId: selectedOrder.id,
        actionType: apiActionType
      });
      
      setCurrentView("upload");
    } catch (error) {
      console.error('Failed to get or create job:', error);
      
      let errorMessage = "Не удалось получить или создать задачу обработки";
      
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            errorMessage = "Сервис обработки недоступен. Попробуйте позже.";
            break;
          case 422:
            errorMessage = "Не удалось распознать инструменты на фото. Проверьте качество изображения.";
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackFromUpload = () => {
    setCurrentView("details");
  };

  const handleNextFromUpload = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    // Set status to VALIDATION and open results immediately
    if (jobData) {
      apiService.updateJobStatus(jobData.jobId, 'VALIDATION').catch(() => {});
    }
    setCurrentView("results");
  };

  const handleBackFromResults = () => {
    setCurrentView("upload");
  };

  const handleCompleteProcess = () => {
    if (!selectedOrder) return;
    
    const actionText = actionType === "issue" ? "выдан" : "принят";
    
    // Update order status based on action
    const newStatus = actionType === "issue" ? "awaiting_return" : "completed";
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === selectedOrder.id 
          ? { ...order, status: newStatus }
          : order
      )
    );
    
    toast({
      title: "Операция завершена",
      description: `Заказ ${selectedOrder?.orderNumber} успешно ${actionText}`,
    });

    // Reset state and go back to orders list
    // Update job status to FINISHED
    if (jobData) {
      apiService.updateJobStatus(jobData.jobId, 'FINISHED').catch(() => {});
      // If we just finished issue, ensure return job existence is reflected on next load
    }
    handleBackToOrders();
  };

  const handleRequestOrders = async () => {
    try {
      setLoading(true);
      
      // Reload orders to get the updated list from ТОиР
      await loadOrders();
      
      toast({
        title: "Заказы обновлены",
        description: `Заказы загружены из системы ТОиР`,
      });
    } catch (error) {
      console.error('Failed to load orders:', error);
      
      let errorMessage = "Не удалось загрузить заказы";
      
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            errorMessage = "Сервис распознавания недоступен. Попробуйте позже.";
            break;
          case 404:
            errorMessage = "Сервис распознавания не найден. Проверьте подключение.";
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentView = () => {
    console.log('Current view state:', currentView);
    console.log('Selected order ID:', selectedOrderId);
    console.log('Job data:', jobData);
    console.log('Test job data:', testJobData);
    
    switch (currentView) {
      case "orders":
        return (
          <OrdersList
            onIssue={handleIssueOrder}
            onReturn={handleReturnOrder}
            onRequestOrders={handleRequestOrders}
            onTestModel={handleTestModel}
            orders={orders}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={handleLoadMore}
          />
        );

      case "details":
        if (!selectedOrder) return null;
        return (
          <OrderDetails
            order={selectedOrder}
            actionType={actionType}
            onBack={handleBackToOrders}
            onNext={handleNextFromDetails}
          />
        );

      case "upload":
        if (!selectedOrder || !jobData) return null;
        return (
          <FileUpload
            orderNumber={selectedOrder.orderNumber}
            actionType={actionType}
            jobId={jobData.jobId}
            onBack={handleBackFromUpload}
            onNext={handleNextFromUpload}
          />
        );

      case "results":
        if (!selectedOrder || !jobData) return null;
        return (
          <RecognitionResults
            orderNumber={selectedOrder.orderNumber}
            orderId={selectedOrder.id}
            actionType={actionType}
            jobId={jobData.jobId}
            onBack={handleBackFromResults}
            onComplete={handleCompleteProcess}
          />
        );

      case "testModel":
        return (
          <TestModelUpload
            onBack={handleBackFromTestModel}
            onNext={handleNextFromTestModel}
          />
        );

      case "testResults":
        if (!testJobData || testJobData.jobId === undefined) {
          console.error('TestJobData is missing or jobId is undefined:', testJobData);
          // Fallback to orders view if testJobData is invalid
          setCurrentView("orders");
          return null;
        }
        return (
          <TestModelResults
            jobId={testJobData.jobId}
            onBack={handleBackFromTestResults}
            onComplete={handleCompleteTestModel}
          />
        );

      default:
        console.error('Unknown view state:', currentView);
        // Fallback to orders view for unknown states
        setCurrentView("orders");
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      
      {/* Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black/80 text-white p-2 rounded text-xs z-50">
          <div>View: {currentView}</div>
          <div>Order: {selectedOrderId || 'none'}</div>
          <div>TestJob: {testJobData?.jobId || 'none'}</div>
          <button 
            onClick={() => {
              setCurrentView("orders");
              setSelectedOrderId(null);
              setJobData(null);
              setTestJobData(null);
            }}
            className="bg-red-500 px-2 py-1 rounded mt-1 mr-1"
          >
            Reset
          </button>
          <button 
            onClick={() => {
              localStorage.removeItem('afl-tools-ui-state');
              window.location.reload();
            }}
            className="bg-orange-500 px-2 py-1 rounded mt-1"
          >
            Clear Storage
          </button>
        </div>
      )}
      
      {renderCurrentView()}
    </div>
  );
};

export default Index;