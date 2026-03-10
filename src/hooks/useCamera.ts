import { useState, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

interface CameraResult {
  dataUrl?: string;
  blob?: Blob;
  error?: string;
}

interface CameraOptions {
  quality?: number; // 0-100
  width?: number;
  height?: number;
  source?: 'camera' | 'photos' | 'prompt';
  resultType?: 'dataUrl' | 'blob';
  direction?: 'front' | 'rear';
}

export function useCamera() {
  const [isNative] = useState(Capacitor.isNativePlatform());
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resolveRef = useRef<((result: CameraResult) => void) | null>(null);

  // Take photo or pick from gallery
  const getPhoto = useCallback(async (options: CameraOptions = {}): Promise<CameraResult> => {
    const {
      quality = 90,
      source = 'prompt',
      resultType = 'dataUrl',
    } = options;

    setIsCapturing(true);

    try {
      if (isNative) {
        // Native: Use @capacitor/camera
        // const image = await Camera.getPhoto({
        //   quality,
        //   allowEditing: false,
        //   resultType: resultType === 'blob' ? CameraResultType.Uri : CameraResultType.DataUrl,
        //   source: source === 'camera' ? CameraSource.Camera : 
        //           source === 'photos' ? CameraSource.Photos : CameraSource.Prompt,
        // });
        
        // Simulate for now - in real app, use Capacitor Camera plugin
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsCapturing(false);
        return { error: 'Native camera not configured. Install @capacitor/camera.' };
      }

      // Web fallback: Use file input
      return new Promise((resolve) => {
        resolveRef.current = resolve;

        // Create hidden file input if not exists
        if (!inputRef.current) {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.style.display = 'none';
          
          if (source === 'camera') {
            input.capture = 'environment';
          }

          input.addEventListener('change', handleFileChange);
          document.body.appendChild(input);
          inputRef.current = input;
        } else {
          // Update capture attribute based on source
          if (source === 'camera') {
            inputRef.current.capture = 'environment';
          } else {
            inputRef.current.removeAttribute('capture');
          }
        }

        inputRef.current.click();
      });
    } catch (error: any) {
      setIsCapturing(false);
      return { error: error?.message || 'Failed to capture photo' };
    }
  }, [isNative]);

  const handleFileChange = useCallback((event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      setIsCapturing(false);
      resolveRef.current?.({ error: 'No file selected' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLastPhoto(dataUrl);
      setIsCapturing(false);
      resolveRef.current?.({ dataUrl, blob: file });
    };
    reader.onerror = () => {
      setIsCapturing(false);
      resolveRef.current?.({ error: 'Failed to read file' });
    };
    reader.readAsDataURL(file);

    // Reset input for next use
    input.value = '';
  }, []);

  // Scan QR/Barcode
  const scanBarcode = useCallback(async (): Promise<{ value?: string; error?: string }> => {
    if (isNative) {
      // Would use @capacitor-community/barcode-scanner
      return { error: 'Native barcode scanner not configured' };
    }

    // Web: Use html5-qrcode (already in project)
    return { error: 'Use QRScannerDialog component for web scanning' };
  }, [isNative]);

  // Check camera permissions
  const checkPermissions = useCallback(async (): Promise<'granted' | 'denied' | 'prompt'> => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return result.state as 'granted' | 'denied' | 'prompt';
    } catch {
      return 'prompt';
    }
  }, []);

  // Request camera permissions
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch {
      return false;
    }
  }, []);

  // Cleanup
  const cleanup = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.remove();
      inputRef.current = null;
    }
  }, []);

  return {
    isCapturing,
    lastPhoto,
    getPhoto,
    scanBarcode,
    checkPermissions,
    requestPermissions,
    cleanup,
  };
}
