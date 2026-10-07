import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';

interface FullscreenQrModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patientName: string;
    patientPhone: string;
    clinicName?: string;
}

const FullscreenQrModal: React.FC<FullscreenQrModalProps> = ({
    open,
    onOpenChange,
    patientName,
    patientPhone,
    clinicName = 'PasseVite',
}) => {
    const [isMobile, setIsMobile] = useState(false);
    const qrData = `PV:${patientPhone}:${patientName}`;

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 640px)');
        setIsMobile(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const handleDownload = () => {
        const svg = document.querySelector('.qr-code-svg') as SVGSVGElement;
        if (!svg) return;

        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            canvas.width = 800;
            canvas.height = 800;
            ctx?.fillRect(0, 0, 800, 800);
            ctx?.drawImage(img, 0, 0, 800, 800);

            const link = document.createElement('a');
            link.download = `QR-${patientName}-${patientPhone}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            URL.revokeObjectURL(url);
        };

        img.src = url;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={
                    isMobile
                        ? 'w-screen h-[100dvh] max-w-none rounded-none border-0 p-0 bg-black/95'
                        : 'max-w-4xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-black/95 border-0 rounded-2xl'
                }
            >
                <div className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-8">
                    {/* Close Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={
                            isMobile
                                ? 'absolute top-3 right-3 h-10 w-10 text-white hover:bg-white/10 rounded-full'
                                : 'absolute top-3 right-3 sm:top-4 sm:right-4 h-10 w-10 sm:h-12 sm:w-12 text-white hover:bg-white/10 rounded-full'
                        }
                        onClick={() => onOpenChange(false)}
                    >
                        <X className={isMobile ? 'h-5 w-5' : 'h-5 w-5 sm:h-6 sm:w-6'} />
                    </Button>

                    {/* QR Code */}
                    <div className={isMobile ? 'bg-white p-5 rounded-2xl shadow-2xl' : 'bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl'}>
                        <QRCodeSVG
                            value={qrData}
                            size={isMobile ? 220 : 180}
                            className="qr-code-svg"
                            level="M"
                            includeMargin={true}
                        />
                    </div>

                    {/* Patient Info */}
                    <div className={isMobile ? 'mt-4 text-center text-white px-2' : 'mt-4 sm:mt-8 text-center text-white px-2'}>
                        <h2 className={isMobile ? 'text-xl font-black italic mb-1' : 'text-xl sm:text-3xl font-black italic mb-1 sm:mb-2'}>{patientName}</h2>
                        <p className={isMobile ? 'text-sm text-white/70' : 'text-sm sm:text-lg text-white/70'}>
                            {patientPhone}
                        </p>
                        <p className={isMobile ? 'text-xs text-white/50 mt-1' : 'text-xs sm:text-sm text-white/50 mt-1'}>{clinicName}</p>
                    </div>

                    {/* Download Button */}
                    <Button
                        onClick={handleDownload}
                        className={
                            isMobile
                                ? 'mt-4 h-10 px-4 rounded-xl bg-white text-black hover:bg-white/90 font-bold gap-2 text-sm'
                                : 'mt-4 sm:mt-8 h-10 sm:h-12 px-4 sm:px-8 rounded-xl bg-white text-black hover:bg-white/90 font-bold gap-2 text-sm'
                        }
                    >
                        <Download className={isMobile ? 'h-4 w-4' : 'h-4 w-4 sm:h-5 sm:w-5'} />
                        Télécharger le QR Code
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default FullscreenQrModal;