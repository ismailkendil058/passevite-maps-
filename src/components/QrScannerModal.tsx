import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, XCircle } from 'lucide-react';

interface QrScannerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScanResult: (phone: string, name: string) => void;
}

const QrScannerModal: React.FC<QrScannerModalProps> = ({
    open,
    onOpenChange,
    onScanResult,
}) => {
    const [error, setError] = useState<string | null>(null);
    const [scanning, setScanning] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const containerId = 'qr-reader-container';
    const hasStarted = useRef(false);

    const stopScanner = async () => {
        try {
            if (scannerRef.current) {
                const state = scannerRef.current.getState();
                // Only stop if currently scanning (state 2) or paused (state 3)
                if (state === 2 || state === 3) {
                    await scannerRef.current.stop();
                }
                scannerRef.current.clear();
                scannerRef.current = null;
            }
        } catch (err) {
            // Ignore cleanup errors
            console.warn('Scanner cleanup:', err);
            scannerRef.current = null;
        }
        hasStarted.current = false;
        setScanning(false);
    };

    const startScanner = async () => {
        if (hasStarted.current) return;
        hasStarted.current = true;
        setError(null);
        setScanning(true);

        try {
            // Clean up any existing instance
            if (scannerRef.current) {
                try {
                    const state = scannerRef.current.getState();
                    if (state === 2 || state === 3) {
                        await scannerRef.current.stop();
                    }
                    scannerRef.current.clear();
                } catch (e) { /* ignore */ }
                scannerRef.current = null;
            }

            const scanner = new Html5Qrcode(containerId);
            scannerRef.current = scanner;

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 220, height: 220 },
                    aspectRatio: 1.0,
                },
                (decodedText) => {
                    // Parse QR data: "PV:{phone}:{name}"
                    if (decodedText.startsWith('PV:')) {
                        const parts = decodedText.split(':');
                        const phone = parts[1] || '';
                        const name = parts.slice(2).join(':') || '';
                        if (phone) {
                            onScanResult(phone, name);
                            stopScanner();
                            onOpenChange(false);
                        }
                    } else {
                        // Try treating the entire value as a phone number
                        const cleaned = decodedText.replace(/\D/g, '');
                        if (cleaned.length >= 8) {
                            onScanResult(cleaned, '');
                            stopScanner();
                            onOpenChange(false);
                        } else {
                            setError('QR code non reconnu. Veuillez scanner un QR PasseVite.');
                        }
                    }
                },
                () => {
                    // Ignore scan failures (camera is just looking)
                }
            );
        } catch (err: any) {
            console.error('Scanner error:', err);
            hasStarted.current = false;
            setScanning(false);
            if (err?.message?.includes('NotAllowedError') || err?.name === 'NotAllowedError') {
                setError('Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres du navigateur.');
            } else if (err?.message?.includes('NotFoundError') || err?.name === 'NotFoundError') {
                setError('Aucune caméra détectée sur cet appareil.');
            } else {
                setError('Impossible de démarrer la caméra. Veuillez réessayer.');
            }
        }
    };

    useEffect(() => {
        if (open) {
            // Wait for the dialog DOM to render the container
            const timer = setTimeout(() => {
                startScanner();
            }, 500);
            return () => clearTimeout(timer);
        } else {
            stopScanner();
        }
    }, [open]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopScanner();
        };
    }, []);

    return (
        <Dialog open={open} onOpenChange={(v) => {
            if (!v) stopScanner();
            onOpenChange(v);
        }}>
            <DialogContent className="max-w-sm w-[95vw] rounded-2xl p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-2">
                    <DialogTitle className="text-lg font-bold italic text-primary flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Scanner QR Patient
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground">
                        Placez le QR code du patient devant la caméra
                    </DialogDescription>
                </DialogHeader>

                <div className="px-5 pb-5 space-y-3">
                    {/* Camera viewport */}
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                        <div id={containerId} className="w-full h-full" />
                        {!scanning && !error && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                                <div className="w-10 h-10 rounded-full border-4 border-white/20 border-t-white animate-spin" />
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <p className="text-xs text-destructive font-medium">{error}</p>
                        </div>
                    )}

                    {error && (
                        <Button
                            variant="outline"
                            className="w-full h-10 rounded-xl"
                            onClick={() => {
                                hasStarted.current = false;
                                startScanner();
                            }}
                        >
                            Réessayer
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default QrScannerModal;
