import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { apiService, ApiPreprocessData } from "@/lib/api";

interface ImageWithBboxProps {
  originalImageId: number;
  preprocessFileId: number | null;
  toolName: string;
  confidence: number;
  className?: string;
}

export const ImageWithBbox = ({
  originalImageId,
  preprocessFileId,
  toolName,
  confidence,
  className = ""
}: ImageWithBboxProps) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preprocessData, setPreprocessData] = useState<ApiPreprocessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadImageData();
    return () => {
      // Clean up object URL when component unmounts
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [originalImageId, preprocessFileId]);

  const loadImageData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load original image using file ID
      const imgUrl = await apiService.getFileFromMinIO(originalImageId);
      setImageUrl(imgUrl);

      // Load preprocess data if available
      if (preprocessFileId) {
        try {
          const data = await apiService.getPreprocessDataFromMinIO(preprocessFileId);
          setPreprocessData(data);
        } catch (err) {
          console.warn("Failed to load preprocess data:", err);
          // Continue without bbox data
        }
      }
    } catch (err) {
      console.error("Failed to load image:", err);
      setError("Не удалось загрузить изображение");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (imageUrl && canvasRef.current && preprocessData) {
      drawImageWithBbox();
    }
  }, [imageUrl, preprocessData]);

  const drawImageWithBbox = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl || !preprocessData) return;

    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas size to image size
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the original image
      ctx.drawImage(img, 0, 0);

      // Draw bounding box if available
      const [x1, y1, x2, y2] = preprocessData.bbox;
      
      // Set box style - thicker lines for better visibility
      ctx.strokeStyle = "#10b981"; // green-500
      ctx.lineWidth = Math.max(4, Math.min(img.width, img.height) / 100); // Dynamic thickness based on image size
      ctx.fillStyle = "rgba(16, 185, 129, 0.2)"; // Slightly more opaque
      
      // Draw rectangle
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

      // Draw label background - larger and more visible
      const labelText = `${toolName} (${Math.round(confidence * 100)}%)`;
      const labelPadding = 12;
      const labelHeight = 32;
      const fontSize = Math.max(16, Math.min(img.width, img.height) / 50); // Dynamic font size
      
      ctx.font = `bold ${fontSize}px sans-serif`;
      const textMetrics = ctx.measureText(labelText);
      const labelWidth = textMetrics.width + labelPadding * 2;
      
      // Calculate label position to avoid going outside image bounds
      let labelX = x1;
      let labelY = y1 - labelHeight - 5; // Add small buffer (5px) above bbox
      
      // Check if label would go above the image
      if (labelY < 0) {
        // Position to the right side of bbox, aligned with top edge
        labelX = x2 + 10;
        labelY = y1; // Align top edge of label with top edge of bbox
        
        // If right side doesn't fit, try left side
        if (labelX + labelWidth > img.width) {
          labelX = x1 - labelWidth - 10;
          labelY = y1; // Align top edge of label with top edge of bbox
        }
        
        // If left side also doesn't fit, try below bbox
        if (labelX < 0) {
          labelX = x1;
          labelY = y2 + 10; // Position below bbox with buffer
        }
        
        // Final fallback - center horizontally
        if (labelX < 0 || labelX + labelWidth > img.width) {
          labelX = Math.max(0, Math.min(img.width - labelWidth, (img.width - labelWidth) / 2));
        }
      } else {
        // Check if label would go to the left of the image
        if (labelX < 0) {
          labelX = 0;
        }
        
        // Check if label would go to the right of the image
        if (labelX + labelWidth > img.width) {
          labelX = img.width - labelWidth;
        }
        
        // If label still goes outside bounds horizontally, move to side
        if (labelX < 0 || labelX + labelWidth > img.width) {
          // Try right side of bbox
          labelX = x2 + 10;
          labelY = y1;
          
          // If still outside, try left side
          if (labelX + labelWidth > img.width) {
            labelX = x1 - labelWidth - 10;
            labelY = y1;
          }
          
          // Final fallback - below bbox
          if (labelX < 0 || labelX + labelWidth > img.width) {
            labelX = Math.max(0, Math.min(x1, img.width - labelWidth));
            labelY = y2 + 10;
          }
        }
      }
      
      ctx.fillStyle = "#10b981";
      ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
      
      // Draw label text
      ctx.fillStyle = "white";
      ctx.fillText(labelText, labelX + labelPadding, labelY + labelHeight - labelPadding);
    };
    
    img.src = imageUrl;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <Skeleton className="w-full h-64" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4 flex items-center justify-center h-64">
          <div className="flex items-center space-x-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            Распознанный инструмент: <span className="font-medium">{toolName}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Уверенность модели: <span className="font-medium">{Math.round(confidence * 100)}%</span>
          </div>
          
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto border rounded-lg"
              style={{ maxHeight: "400px" }}
            />
            
            {!preprocessData && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                <div className="text-white text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Координаты рамки недоступны</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
