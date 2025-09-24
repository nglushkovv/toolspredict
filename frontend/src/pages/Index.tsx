import { useState, useEffect } from "react";
import { OrdersList, Order } from "@/components/OrdersList";
import { OrderDetails } from "@/components/OrderDetails";
import { FileUpload } from "@/components/FileUpload";
import { RecognitionResults } from "@/components/RecognitionResults";
import { useToast } from "@/hooks/use-toast";
import { apiService, ApiError } from "@/lib/api";

type ViewState = "orders" | "details" | "upload" | "results";
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

// Empty initial orders - will be loaded from API
const initialOrders: Order[] = [];

const Index = () => {
  const [currentView, setCurrentView] = useState<ViewState>("orders");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<ActionType>("issue");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selectedOrder = orders.find(order => order.id === selectedOrderId);

  // Load orders on component mount
  useEffect(() => {
    loadOrders();
  }, []);

  // Restore view state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('afl-tools-ui-state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentView) setCurrentView(parsed.currentView);
        if (parsed.selectedOrderId) setSelectedOrderId(parsed.selectedOrderId);
        if (parsed.actionType) setActionType(parsed.actionType);
        if (parsed.jobData) setJobData(parsed.jobData);
      }
    } catch {}
  }, []);

  // Persist view state to localStorage
  useEffect(() => {
    const data = {
      currentView,
      selectedOrderId,
      actionType,
      jobData,
    };
    try {
      localStorage.setItem('afl-tools-ui-state', JSON.stringify(data));
    } catch {}
  }, [currentView, selectedOrderId, actionType, jobData]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const apiOrders = await apiService.getOrders();
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
      setOrders(transformedOrders);
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
      setLoading(false);
    }
  };

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
    try { localStorage.removeItem('afl-tools-ui-state'); } catch {}
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
    switch (currentView) {
      case "orders":
        return (
          <OrdersList
            onIssue={handleIssueOrder}
            onReturn={handleReturnOrder}
            onRequestOrders={handleRequestOrders}
            orders={orders}
            loading={loading}
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

      default:
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
      {renderCurrentView()}
    </div>
  );
};

export default Index;