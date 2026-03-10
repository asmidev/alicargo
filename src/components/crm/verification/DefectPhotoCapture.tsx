import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, X, Upload, Image, Loader2, Sparkles, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface AIAnalysisResult {
  hasDefect: boolean;
  defectType?: string | null;
  severity?: 'minor' | 'moderate' | 'severe' | null;
  confidence: number;
  description: string;
}

interface DefectPhotoCaptureProps {
  sessionId: string;
  itemId: string;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  disabled?: boolean;
  onPhotoUploaded?: () => void;
  productName?: string;
  productCategory?: string;
  onAIAnalysis?: (analysis: AIAnalysisResult) => void;
}

export function DefectPhotoCapture({
  sessionId,
  itemId,
  photos,
  onPhotosChange,
  disabled,
  onPhotoUploaded,
  productName,
  productCategory,
  onAIAnalysis,
}: DefectPhotoCaptureProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast({
        title: t('vr_camera_error'),
        description: t('vr_camera_error_desc'),
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCapturing(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await uploadPhoto(blob);
      stopCamera();
    }, 'image/jpeg', 0.8);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({
        title: t('auth_error'),
        description: t('vr_only_images'),
        variant: 'destructive',
      });
      return;
    }

    await uploadPhoto(file);
    e.target.value = '';
  };

  const analyzeWithAI = async (imageUrl: string) => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-defect', {
        body: {
          imageUrl,
          productName,
          productCategory,
        },
      });

      if (error) throw error;

      if (data?.success && data?.analysis) {
        setAiAnalysis(data.analysis);
        onAIAnalysis?.(data.analysis);
        
        toast({
          title: t('vr_ai_done'),
          description: data.analysis.hasDefect 
            ? `${t('vr_defect_found')}: ${data.analysis.description.substring(0, 50)}...`
            : t('vr_no_defect'),
        });
      }
    } catch (error: any) {
      console.error('AI analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const uploadPhoto = async (file: Blob | File) => {
    setIsUploading(true);
    try {
      const fileName = `${sessionId}/${itemId}/${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('defect-photos')
        .upload(fileName, file, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('defect-photos')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      if (urlError) throw urlError;

      const photoUrl = signedUrlData.signedUrl;
      onPhotosChange([...photos, photoUrl]);
      
      toast({
        title: t('vr_photo_uploaded'),
        description: t('vr_photo_saved'),
      });

      analyzeWithAI(photoUrl);
      onPhotoUploaded?.();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: t('vr_upload_error'),
        description: error.message || t('vr_upload_error'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    onPhotosChange(newPhotos);
  };

  const getSeverityColor = (severity: string | null | undefined) => {
    switch (severity) {
      case 'minor': return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
      case 'moderate': return 'bg-orange-500/20 text-orange-600 border-orange-500/30';
      case 'severe': return 'bg-red-500/20 text-red-600 border-red-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSeverityLabel = (severity: string | null | undefined) => {
    switch (severity) {
      case 'minor': return t('vr_severity_minor');
      case 'moderate': return t('vr_severity_moderate');
      case 'severe': return t('vr_severity_severe');
      default: return '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{t('vr_defect_photos')}</p>
        {isAnalyzing && (
          <Badge variant="outline" className="gap-1 animate-pulse">
            <Sparkles className="h-3 w-3" />
            {t('vr_ai_analyzing')}
          </Badge>
        )}
      </div>
      
      {aiAnalysis && (
        <div className={cn(
          "p-3 rounded-lg border",
          aiAnalysis.hasDefect ? "bg-destructive/10 border-destructive/30" : "bg-green-500/10 border-green-500/30"
        )}>
          <div className="flex items-start gap-2">
            {aiAnalysis.hasDefect ? (
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-medium">
                  {aiAnalysis.hasDefect ? t('vr_defect_found') : t('vr_no_defect')}
                </span>
                {aiAnalysis.severity && (
                  <Badge variant="outline" className={cn("text-xs", getSeverityColor(aiAnalysis.severity))}>
                    {getSeverityLabel(aiAnalysis.severity)}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  {t('vr_confidence', { pct: Math.round(aiAnalysis.confidence * 100) })}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {aiAnalysis.description}
              </p>
              {aiAnalysis.defectType && (
                <p className="text-xs text-muted-foreground mt-1">
                  {t('vr_type_label')} <span className="font-medium">{aiAnalysis.defectType}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img 
                src={photo} 
                alt={`${t('vr_defective')} ${index + 1}`} 
                className="w-full h-full object-cover"
              />
              {!disabled && (
                <button
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isCapturing && (
        <div className="relative rounded-lg overflow-hidden border border-border">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full aspect-video object-cover"
          />
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={stopCamera}
              className="gap-1"
            >
              <X className="h-4 w-4" />
              {t('vr_cancel')}
            </Button>
            <Button
              size="sm"
              onClick={capturePhoto}
              className="gap-1 bg-red-500 hover:bg-red-600"
            >
              <Camera className="h-4 w-4" />
              {t('vr_capture')}
            </Button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!isCapturing && !disabled && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={startCamera}
            disabled={isUploading}
            className="flex-1 gap-2"
          >
            <Camera className="h-4 w-4" />
            {t('vr_camera')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex-1 gap-2"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t('vr_upload')}
          </Button>
        </div>
      )}

      {photos.length === 0 && !isCapturing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Image className="h-4 w-4" />
          <span>{t('vr_add_photo_hint')}</span>
        </div>
      )}
    </div>
  );
}
