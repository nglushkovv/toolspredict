import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Upload, File, X, Play, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiService, ApiError } from "@/lib/api";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  uploadDate: Date;
  status: "uploaded" | "processing" | "processed" | "error";
  errorMessage?: string;
}

interface FileUploadProps {
  orderNumber: string;
  actionType: "issue" | "return";
  jobId: number;
  onBack: () => void;
  onNext: (files: UploadedFile[]) => void;
}

export const FileUpload = ({ orderNumber, actionType, jobId, onBack, onNext }: FileUploadProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [recognitionReady, setRecognitionReady] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const actionTitle = actionType === "issue" ? "Выдача инструментария" : "Сдача инструментария";

  // Function to parse recognition errors from error message
  const parseRecognitionErrors = (errorDetails: string): string[] => {
    const lines = errorDetails.split('\n');
    const problematicFiles: string[] = [];
    
    lines.forEach(line => {
      const match = line.match(/^([^:]+):/);
      if (match) {
        const fileName = match[1].trim();
        problematicFiles.push(fileName);
      }
    });
    
    return problematicFiles;
  };

  // Function to reload files from API and mark preprocess status
  const reloadFilesFromAPI = async () => {
    const [apiFiles, preprocess] = await Promise.all([
      apiService.getJobFiles(jobId, 'RAW'),
      apiService.getPreprocessResults(jobId).catch(() => []),
    ]);
    // Build set of successfully preprocessed original fileIds
    const okOriginalIds = new Set<number>();
    if (Array.isArray(preprocess)) {
      preprocess.forEach((p: any) => {
        const originalId = p.originalFile?.id;
        if (typeof originalId === 'number') okOriginalIds.add(originalId);
      });
    }
    const transformedFiles: UploadedFile[] = apiFiles.map(apiFile => {
      const isVideo = apiFile.fileName?.toLowerCase().endsWith('.mp4');
      if (isVideo) {
        return {
          id: apiFile.id.toString(),
          name: apiFile.fileName,
          size: 0,
          uploadDate: new Date(apiFile.createdAt),
          status: "uploaded" as const,
        };
      }
      const ok = okOriginalIds.has(apiFile.id);
      return {
        id: apiFile.id.toString(),
        name: apiFile.fileName,
        size: 0,
        uploadDate: new Date(apiFile.createdAt),
        status: ok ? ("processed" as const) : ("error" as const),
        errorMessage: ok ? undefined : "Не распознано на предобработке",
      };
    });
    
    setUploadedFiles(transformedFiles);
    const newProcessedCount = transformedFiles.filter(f => f.status === 'processed').length;
    // если после загрузки появился новый успешно предобработанный файл — разрешаем повторный запуск
    if (recognitionReady && newProcessedCount > processedCount) {
      setRecognitionReady(false);
    }
    setProcessedCount(newProcessedCount);
    return transformedFiles;
  };

  // Function to load files with retry for video processing
  const loadFilesWithRetry = async (maxRetries = 5, delay = 2000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Loading files attempt ${attempt}/${maxRetries}`);
        const files = await reloadFilesFromAPI();
        
        // If we have files, we're good
        if (files.length > 0) {
          console.log(`Successfully loaded ${files.length} files`);
          return files;
        }
        
        // If no files yet and not the last attempt, wait and retry
        if (attempt < maxRetries) {
          console.log(`No files found, waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.log('Max retries reached, loading files anyway');
    return await reloadFilesFromAPI();
  };

  // Load existing files from API on component mount
  useEffect(() => {
    const loadExistingFiles = async () => {
      try {
        setLoadingFiles(true);
        await reloadFilesFromAPI();
        console.log('Loaded existing files on mount');
      } catch (error) {
        console.error('Failed to load existing files:', error);
        // Don't show error toast here, just log it
      } finally {
        setLoadingFiles(false);
        setRecognitionReady(false);
      }
    };

    loadExistingFiles();
  }, [jobId]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File select event triggered');
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });

    // Validate file type (images and videos)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'video/mp4'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.mp4'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    const isValidType = allowedTypes.includes(file.type) || allowedExtensions.includes(fileExtension);
    
    if (!isValidType) {
      console.log('File type not allowed:', file.type, 'Extension:', fileExtension);
      toast({
        title: "Ошибка загрузки",
        description: `Неподдерживаемый тип файла: ${file.type || fileExtension}. Пожалуйста, выберите файл JPG, PNG или MP4`,
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2GB)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      toast({
        title: "Ошибка загрузки",
        description: "Размер файла не должен превышать 2 ГБ",
        variant: "destructive",
      });
      return;
    }

    const newFile: UploadedFile = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      uploadDate: new Date(),
      status: "processing"
    };

    setUploadedFiles(prev => [...prev, newFile]);

    try {
      await apiService.uploadFile(jobId, file);
      
      // Remove the temporary file from state
      setUploadedFiles(prev => prev.filter(f => f.id !== newFile.id));
      
      // For video files, wait a bit for server processing and retry loading files
      const isVideoFile = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
      
      if (isVideoFile) {
        // Wait for video processing and retry loading files multiple times
        await loadFilesWithRetry();
        toast({
          title: "Видео загружено",
          description: `${file.name} загружено. Предобработка кадров выполняется...`,
          variant: "default",
        });
      } else {
        // For regular files, just reload once
        await reloadFilesFromAPI();
        toast({
          title: "Файл загружен",
          description: `${file.name} успешно загружен`,
        });
      }
    } catch (error) {
      const isVideoFile = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
      
      if (error instanceof ApiError && error.status === 400 && isVideoFile) {
        // For video files with 400 error, this might be partial success with recognition errors
        console.log('Video upload returned 400, checking for partial success...');
        
        try {
          // Try to load files anyway - video might have been processed
          const files = await loadFilesWithRetry();
          
          if (files.length > 0) {
            // Video was processed, show warning about recognition errors
            toast({
              title: "Видео загружено с предупреждениями",
              description: "Видео обработано, но некоторые кадры не удалось распознать. Проверьте список файлов.",
              variant: "default",
            });
            
            // Parse error details to mark problematic files
            const errorDetails = error.originalError || '';
            const problematicFiles = parseRecognitionErrors(errorDetails);
            
            // Update files with error status
            setUploadedFiles(prevFiles => 
              prevFiles.map(file => {
                const isProblematic = problematicFiles.some(probFile => 
                  file.name.includes(probFile) || probFile.includes(file.name)
                );
                return isProblematic ? { ...file, status: "error" as const, errorMessage: "Не удалось распознать инструменты" } : file;
              })
            );
            
            return; // Don't show error toast
          }
        } catch (loadError) {
          console.error('Failed to load files after video error:', loadError);
          // Fall through to show error
        }
      }
      
      // If single photo failed preprocess (422), show it with error state immediately
      if (error instanceof ApiError && error.status === 422 && !isVideoFile) {
        setUploadedFiles(prev => prev.map(f => (
          f.id === newFile.id
            ? { ...f, status: "error" as const, errorMessage: "Не распознано на предобработке" }
            : f
        )));
        // Try to refresh from API to replace temp with actual stored entry if present
        reloadFilesFromAPI().catch(() => {});
        return; // do not show destructive toast
      }
      
      let errorMessage = `Не удалось загрузить файл ${file.name}`;
      
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            // Проверяем, является ли это ошибкой превышения лимита файлов
            if (error.message.includes('Превышен лимит файлов для Job')) {
              errorMessage = "Превышен лимит файлов для Job. Чтобы добавить новый файл, удалите предыдущие.";
            } else {
              errorMessage = "Сервис распознавания недоступен. Попробуйте позже.";
            }
            break;
          case 422:
            errorMessage = "Не удалось распознать инструменты на фото. Проверьте качество изображения.";
            break;
          case 404:
            errorMessage = "Задача обработки не найдена. Обновите страницу и попробуйте снова.";
            break;
          case 413:
            errorMessage = "Файл слишком большой. Выберите файл размером менее 2 ГБ.";
            break;
          case 415:
            errorMessage = "Неподдерживаемый формат файла. Выберите JPG, PNG или MP4.";
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      // For other errors: remove temp and show error
      setUploadedFiles(prev => prev.filter(f => f.id !== newFile.id));
      toast({
        title: "Ошибка загрузки",
        description: errorMessage,
        variant: "destructive",
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    try {
      setDeletingFileId(fileId);
      
      // Convert string ID back to number for API call
      const numericFileId = parseInt(fileId);
      
      // Call API to delete file from MinIO
      await apiService.deleteFile(numericFileId);
      
      // Remove file from local state
      setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
      
      toast({
        title: "Файл удален",
        description: "Файл успешно удален из системы",
      });
    } catch (error) {
      console.error('Failed to delete file:', error);
      
      let errorMessage = "Не удалось удалить файл";
      
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            errorMessage = "Сервис недоступен. Попробуйте позже.";
            break;
          case 404:
            errorMessage = "Файл не найден. Возможно, он уже был удален.";
            break;
          case 500:
            errorMessage = "Внутренняя ошибка сервера. Попробуйте позже.";
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      toast({
        title: "Ошибка удаления",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setDeletingFileId(null);
    }
  };

  const handleStartRecognition = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "Нет файлов",
        description: "Загрузите хотя бы один файл для начала распознавания",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      await apiService.startClassification(jobId);
      toast({ title: "Распознавание запущено" });

      // Вернуть красивую прогресс-полоску (симуляция), статусы не меняем
      const interval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsProcessing(false);
            setRecognitionReady(true);
            return 100;
          }
          return prev + 10;
        });
      }, 300);
    } catch (error) {
      setIsProcessing(false);
      setProcessingProgress(0);
      
      let errorMessage = "Не удалось начать обработку файлов";
      
      if (error instanceof ApiError) {
        switch (error.status) {
          case 400:
            errorMessage = "Сервис распознавания недоступен. Попробуйте позже.";
            break;
          case 422:
            errorMessage = "Не удалось распознать инструменты на фото. Проверьте качество изображения.";
            break;
          case 404:
            errorMessage = "Задача обработки не найдена. Обновите страницу и попробуйте снова.";
            break;
          default:
            errorMessage = error.message;
        }
      }
      
      toast({
        title: "Ошибка распознавания",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const hasAtLeastOneProcessedFrame = uploadedFiles.some(file => file.status === "processed");
  // Переход "Далее" доступен после старта распознавания
  const canProceedToNext = recognitionReady;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-4 mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад</span>
        </Button>
      </div>

      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <Upload className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Загрузка файлов</h1>
            <p className="text-muted-foreground">{actionTitle} - Заказ {orderNumber}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Загрузка документов</CardTitle>
            <CardDescription>
              Загрузите фотографии инструментария. За раз можно загрузить только один файл, но можно сделать несколько загрузок.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Выберите файл для загрузки</p>
              <p className="text-sm text-muted-foreground mb-4">
                Поддерживаются: JPG, PNG, MP4 (максимум 2 ГБ). Для старта распознавания нужен хотя бы один успешно предобработанный кадр.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,video/mp4"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                Выбрать файл
              </Button>
            </div>
          </CardContent>
        </Card>

        {loadingFiles ? (
          <Card>
            <CardContent className="text-center py-8">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Загрузка файлов...</span>
              </div>
            </CardContent>
          </Card>
        ) : uploadedFiles.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Загруженные файлы ({uploadedFiles.length})
                <div className="flex items-center gap-3">
                  {recognitionReady && (
                    <Badge className="flex items-center gap-1 bg-success text-success-foreground">
                      <CheckCircle className="h-4 w-4" /> Успех
                    </Badge>
                  )}
                  {!isProcessing && uploadedFiles.some(file => file.status === "processed") && (
                    <Button 
                      onClick={handleStartRecognition}
                      className="flex items-center space-x-2"
                      disabled={recognitionReady}
                    >
                      <Play className="h-4 w-4" />
                      <span>Начать распознавание</span>
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              {isProcessing && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Обработка файлов...</span>
                    <span className="text-sm text-muted-foreground">{processingProgress}%</span>
                  </div>
                  <Progress value={processingProgress} className="w-full" />
                </div>
              )}
              
              <div className="space-y-3">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {file.status === "error" ? (
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)} • {file.uploadDate.toLocaleTimeString('ru-RU')}
                        </p>
                        {file.status === "error" && file.errorMessage && (
                          <p className="text-sm text-destructive mt-1">{file.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {file.status === "uploaded" && (
                        <span className="text-sm text-muted-foreground">Загружен</span>
                      )}
                      {file.status === "processing" && (
                        <span className="text-sm text-warning">Обработка...</span>
                      )}
                      {file.status === "processed" && (
                        <span className="text-sm text-success">Обработан</span>
                      )}
                      {file.status === "error" && (
                        <span className="text-sm text-destructive">Ошибка распознавания</span>
                      )}
                      
                      {!isProcessing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(file.id)}
                          disabled={deletingFileId === file.id}
                        >
                          {deletingFileId === file.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button 
            onClick={() => onNext(uploadedFiles)} 
            size="lg" 
            className="px-8"
            disabled={!canProceedToNext}
          >
            Продолжить
          </Button>
        </div>
      </div>
    </div>
  );
};