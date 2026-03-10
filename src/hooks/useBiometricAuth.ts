import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

interface BiometricResult {
  success: boolean;
  error?: string;
}

interface BiometricInfo {
  isAvailable: boolean;
  biometryType: 'fingerprint' | 'face' | 'iris' | 'none';
  isEnrolled: boolean;
}

export function useBiometricAuth() {
  const [isNative] = useState(Capacitor.isNativePlatform());
  const [biometricInfo, setBiometricInfo] = useState<BiometricInfo>({
    isAvailable: false,
    biometryType: 'none',
    isEnrolled: false,
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Check biometric availability
  useEffect(() => {
    const checkBiometrics = async () => {
      if (!isNative) {
        // Web: Check for WebAuthn support
        const webAuthnAvailable = 
          window.PublicKeyCredential !== undefined &&
          typeof window.PublicKeyCredential === 'function';
        
        setBiometricInfo({
          isAvailable: webAuthnAvailable,
          biometryType: webAuthnAvailable ? 'fingerprint' : 'none',
          isEnrolled: webAuthnAvailable,
        });
        return;
      }

      try {
        // For native, we'd use @capacitor-community/biometric-auth
        // Simulating the check for now
        const platform = Capacitor.getPlatform();
        setBiometricInfo({
          isAvailable: true,
          biometryType: platform === 'ios' ? 'face' : 'fingerprint',
          isEnrolled: true,
        });
      } catch (error) {
        console.error('Biometric check failed:', error);
        setBiometricInfo({
          isAvailable: false,
          biometryType: 'none',
          isEnrolled: false,
        });
      }
    };

    checkBiometrics();
  }, [isNative]);

  // Authenticate with biometrics
  const authenticate = useCallback(async (reason?: string): Promise<BiometricResult> => {
    if (!biometricInfo.isAvailable) {
      return { success: false, error: 'Biometrics not available' };
    }

    setIsAuthenticating(true);

    try {
      if (!isNative) {
        // Web: Use WebAuthn if available, otherwise simulate success
        // In a real app, you'd implement proper WebAuthn flow
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsAuthenticating(false);
        return { success: true };
      }

      // Native: Would use @capacitor-community/biometric-auth
      // BiometricAuth.authenticate({ reason: reason || 'Verify your identity' })
      await new Promise(resolve => setTimeout(resolve, 1000));
      setIsAuthenticating(false);
      return { success: true };
    } catch (error: any) {
      setIsAuthenticating(false);
      return { 
        success: false, 
        error: error?.message || 'Authentication failed' 
      };
    }
  }, [isNative, biometricInfo.isAvailable]);

  // Check if user has enabled biometric login
  const isBiometricLoginEnabled = useCallback(() => {
    return localStorage.getItem('biometric-login-enabled') === 'true';
  }, []);

  // Enable/disable biometric login
  const setBiometricLoginEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem('biometric-login-enabled', enabled.toString());
  }, []);

  return {
    ...biometricInfo,
    isAuthenticating,
    authenticate,
    isBiometricLoginEnabled,
    setBiometricLoginEnabled,
  };
}
