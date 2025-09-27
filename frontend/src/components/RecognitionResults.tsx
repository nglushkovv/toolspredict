import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle, Package, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService, ApiRecognitionResultDetailed } from "@/lib/api";
import { ImageWithBbox } from "./ImageWithBbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface RecognitionItem {
  id: string;
  name: string;
  partNumber: string;
  required: number;
  found: number;
  status: "found" | "not_found" | "not_expected";
  confidence?: number; // 0-100
  marking?: string; // маркировка инструмента
  orderedMarking?: string; // маркировка из заказа (для сравнения)
  markingStatus?: "match" | "mismatch" | "not_specified" | "not_recognized"; // статус соответствия маркировки
  // New fields for image display
  originalImageId?: number;
  preprocessFileId?: number;
  detailedResult?: ApiRecognitionResultDetailed;
}

interface RecognitionResultsProps {
  orderNumber: string;
  orderId: string;
  actionType: "issue" | "return";
  jobId: number;
  onBack: () => void;
  onComplete: () => void;
}

// No mocks – will load from API

export const RecognitionResults = ({ orderNumber, orderId, actionType, jobId, onBack, onComplete }: RecognitionResultsProps) => {
  const [results, setResults] = useState<RecognitionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  const actionTitle = actionType === "issue" ? "Выдача инструментария" : "Сдача инструментария";
  
  const foundItems = results.filter(item => item.status === "found").length;
  const notFoundItems = results.filter(item => item.status === "not_found").length;
  const unexpectedItems = results.filter(item => item.status === "not_expected").length;
  
  const isCompleteMatch = notFoundItems === 0 && unexpectedItems === 0;

  useEffect(() => {
    loadResults();
  }, [jobId, orderId]);

  const loadResults = async () => {
    try {
      setLoading(true);
      const [orderTools, detailedResults] = await Promise.all([
        apiService.getOrderTools(orderId), // returns ApiOrderTool[]
        apiService.getDetailedResults(jobId), // returns ApiRecognitionResultDetailed[]
      ]);

      const orderedToolIds = new Set<number>(
        orderTools.map((ot: any) => ot.tool?.id ?? ot.toolId)
      );

      // Build map for recognized by toolId - use array to handle duplicates
      const recognizedItems = Array.isArray(detailedResults) ? detailedResults : [];
      const recognizedByToolId = new Map<number, ApiRecognitionResultDetailed[]>();
      recognizedItems.forEach((r: ApiRecognitionResultDetailed) => {
        const tid = r.tool?.id;
        if (typeof tid === 'number') {
          if (!recognizedByToolId.has(tid)) {
            recognizedByToolId.set(tid, []);
          }
          recognizedByToolId.get(tid)!.push(r);
        }
      });

      const items: RecognitionItem[] = [];
      const usedRecognitions = new Set<number>(); // Track which recognition results we've used

      // 1) Items that were ordered: mark found/not_found
      orderTools.forEach((ot: any, idx: number) => {
        const tool = ot.tool;
        const rid = tool?.id;
        const orderedMarking = ot.marking; // маркировка из заказа
        const recognizedArray = rid != null ? recognizedByToolId.get(rid) : [];
        
        // Find the best recognition result with priority: matching marking > highest confidence
        let bestRecognition = null;
        let bestRecognitionIndex = -1;
        let bestScore = -1;
        let markingStatus: "match" | "mismatch" | "not_specified" | "not_recognized" = "not_specified";
        
        if (recognizedArray && recognizedArray.length > 0) {
          recognizedArray.forEach((recog: ApiRecognitionResultDetailed, recogIdx: number) => {
            const confidence = typeof recog.confidence === 'number' ? recog.confidence : 0;
            const recogMarking = recog.marking;
            
            // Calculate score: priority for matching markings
            let score = confidence;
            
            // If ordered marking is specified, prioritize matching markings
            if (orderedMarking && orderedMarking.trim()) {
              if (recogMarking && recogMarking.trim() === orderedMarking.trim()) {
                score += 1000; // High priority for matching markings
                markingStatus = "match";
              } else if (recogMarking && recogMarking.trim()) {
                score += 500; // Medium priority for any marking vs no marking
                markingStatus = "mismatch";
              } else {
                // No marking recognized but ordered marking exists
                markingStatus = "not_recognized";
              }
            }
            
            if (score > bestScore) {
              bestScore = score;
              bestRecognition = recog;
              bestRecognitionIndex = recogIdx;
            }
          });
        }
        
        const confidence = bestRecognition ? Math.round(bestRecognition.confidence * 100) : undefined;
        const found = bestRecognition ? 1 : 0;
        const recogMarking = bestRecognition?.marking;
        
        // Determine final status - упрощенная логика
        let status: "found" | "not_found" | "not_expected" = found ? 'found' : 'not_found';
        
        // Mark this recognition as used
        if (bestRecognition && bestRecognitionIndex >= 0) {
          const globalIndex = recognizedItems.findIndex((r: any) => r === recognizedArray[bestRecognitionIndex]);
          if (globalIndex >= 0) {
            usedRecognitions.add(globalIndex);
          }
        }
        
        items.push({
          id: String(ot.id ?? `ord-${idx}`),
          name: tool?.name ?? tool?.toolReference?.toolName ?? `Инструмент ${idx + 1}`,
          partNumber: tool?.partNumber ?? '',
          required: 1,
          found,
          status,
          confidence,
          marking: recogMarking,
          orderedMarking: orderedMarking,
          markingStatus: markingStatus,
          // Add image data if available
          originalImageId: bestRecognition?.preprocessResult?.originalFile?.id,
          preprocessFileId: bestRecognition?.preprocessResult?.file?.id,
          detailedResult: bestRecognition,
        });
      });

      // 2) Items recognized but not ordered, or excess duplicates: not_expected
      recognizedItems.forEach((r: ApiRecognitionResultDetailed, idx: number) => {
        const tid = r.tool?.id;
        if (typeof tid === 'number' && !usedRecognitions.has(idx)) {
          items.push({
            id: String(r.id ?? `rec-${idx}`),
            name: r.tool?.name ?? r.tool?.toolReference?.toolName ?? `Распознанный инструмент ${idx + 1}`,
            partNumber: r.tool?.partNumber ?? '',
            required: 0,
            found: 1,
            status: 'not_expected',
            confidence: typeof r.confidence === 'number' ? Math.round(r.confidence * 100) : undefined,
            marking: r.marking,
            markingStatus: "not_specified",
            // Add image data
            originalImageId: r.preprocessResult?.originalFile?.id,
            preprocessFileId: r.preprocessResult?.file?.id,
            detailedResult: r,
          });
        }
      });

      setResults(items);
    } catch (error) {
      console.error('Failed to load results:', error);
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить результаты распознавания",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteClick = () => {
    if (isCompleteMatch) {
      onComplete();
    } else {
      setConfirmOpen(true);
    }
  };

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const getStatusIcon = (status: RecognitionItem["status"]) => {
    switch (status) {
      case "found":
        return <CheckCircle className="h-5 w-5 text-success" />;
      case "not_found":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "not_expected":
        return <AlertCircle className="h-5 w-5 text-info" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (item: RecognitionItem) => {
    switch (item.status) {
      case "found":
        return (
          <Badge className="bg-success text-success-foreground">
            Найдено {item.found}/{item.required}
          </Badge>
        );
      case "not_found":
        return (
          <Badge variant="destructive">
            Не найдено (0/{item.required})
          </Badge>
        );
      case "not_expected":
        return (
          <Badge className="bg-info text-info-foreground">
            Лишний предмет
          </Badge>
        );
      default:
        return null;
    }
  };

  const getStatusDescription = (status: RecognitionItem["status"]) => {
    switch (status) {
      case "found":
        return "Было - найдено";
      case "not_found":
        return "Было - не найдено";
      case "not_expected":
        return "Не было - найдено";
      default:
        return "";
    }
  };

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
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Результаты распознавания</h1>
            <p className="text-muted-foreground">{actionTitle} - Заказ {orderNumber}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Сводка результатов
              {isCompleteMatch ? (
                <Badge className="bg-success text-success-foreground">Полное соответствие</Badge>
              ) : (
                <Badge variant="destructive">Есть расхождения</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Результаты автоматического распознавания загруженных изображений
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <CheckCircle className="h-6 w-6 text-success" />
                <div>
                  <p className="text-2xl font-bold text-success">{foundItems}</p>
                  <p className="text-sm text-muted-foreground">Найдено</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <XCircle className="h-6 w-6 text-destructive" />
                <div>
                  <p className="text-2xl font-bold text-destructive">{notFoundItems}</p>
                  <p className="text-sm text-muted-foreground">Не найдено</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-4 border rounded-lg">
                <AlertCircle className="h-6 w-6 text-info" />
                <div>
                  <p className="text-2xl font-bold text-info">{unexpectedItems}</p>
                  <p className="text-sm text-muted-foreground">Лишние</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Детальные результаты</CardTitle>
            <CardDescription>Список всех позиций с результатами распознавания</CardDescription>
          </CardHeader>
          
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map((item) => {
                  // Only show expandable content for found or not_expected items
                  const shouldShowImage = item.status === "found" || item.status === "not_expected";
                  
                  if (shouldShowImage) {
                    return (
                      <Collapsible key={item.id} open={expandedItems.has(item.id)} onOpenChange={() => toggleExpanded(item.id)}>
                        <div className="border rounded-lg">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                              <div className="flex items-center space-x-3">
                                {getStatusIcon(item.status)}
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-sm text-muted-foreground">Номер: {item.partNumber}</p>
                                  {/* Показываем маркировки только если они есть */}
                                  {item.orderedMarking && (
                                    <p className="text-sm text-muted-foreground">
                                      Заказанная маркировка: <span className="font-medium">{item.orderedMarking}</span>
                                    </p>
                                  )}
                                  {item.orderedMarking && (
                                    <p className="text-sm text-muted-foreground">
                                      Найденная маркировка: {
                                        item.marking ? (
                                          <>
                                            <span className={`font-medium ${item.markingStatus === "match" ? "text-success" : "text-orange-500"}`}>
                                              {item.marking}
                                            </span>
                                            {item.markingStatus === "match" && <span className="text-success ml-2">✓</span>}
                                            {item.markingStatus === "mismatch" && <span className="text-orange-500 ml-2">⚠</span>}
                                          </>
                                        ) : (
                                          <span className="text-orange-500 font-medium">Не распознана</span>
                                        )
                                      }
                                    </p>
                                  )}
                                  <div className="flex items-center space-x-2">
                                    <p className="text-xs text-muted-foreground">{getStatusDescription(item.status)}</p>
                                    {item.confidence && (
                                      <p className="text-xs text-muted-foreground">• Уверенность: {item.confidence}%</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                {getStatusBadge(item)}
                                {expandedItems.has(item.id) ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          
                          <CollapsibleContent>
                            <div className="px-4 pb-4 border-t bg-muted/20">
                              {item.originalImageId && (
                                <div className="mt-4">
                                  <ImageWithBbox
                                    originalImageId={item.originalImageId}
                                    preprocessFileId={item.preprocessFileId || null}
                                    toolName={item.name}
                                    confidence={item.detailedResult?.confidence || 0}
                                    className="w-full"
                                  />
                                </div>
                              )}
                              {!item.originalImageId && (
                                <div className="mt-4 p-4 text-center text-muted-foreground">
                                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                                  <p>Изображение недоступно</p>
                                </div>
                              )}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  } else {
                    // For not_found items, show simple non-expandable card
                    return (
                      <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(item.status)}
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">Номер: {item.partNumber}</p>
                            {/* Показываем маркировки только если они есть */}
                            {item.orderedMarking && (
                              <p className="text-sm text-muted-foreground">
                                Заказанная маркировка: <span className="font-medium">{item.orderedMarking}</span>
                              </p>
                            )}
                            <div className="flex items-center space-x-2">
                              <p className="text-xs text-muted-foreground">{getStatusDescription(item.status)}</p>
                            </div>
                          </div>
                        </div>
                        
                        {getStatusBadge(item)}
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {isCompleteMatch 
              ? "Все позиции найдены и соответствуют заказу. Можно продолжить." 
              : "Есть расхождения. Проверьте список перед продолжением."}
          </div>
          
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                onClick={handleCompleteClick}
                size="lg" 
                className="px-8"
              >
                {actionType === "issue" ? "Выдать" : "Принять"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Подтверждение выдачи при расхождениях</AlertDialogTitle>
                <AlertDialogDescription>
                  В результатах найдены расхождения с заказом. Подтвердите, что вы отметили вручную изменения в системе ТОиР.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setConfirmOpen(false);
                    onComplete();
                  }}
                >
                  Подтверждаю
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
};