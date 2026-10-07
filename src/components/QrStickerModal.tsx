import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface QrStickerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    patientName: string;
    patientPhone: string;
    clinicName?: string;
}

const QrStickerModal: React.FC<QrStickerModalProps> = ({
    open,
    onOpenChange,
    patientName,
    patientPhone,
    clinicName = 'PasseVite',
}) => {
    const printRef = useRef<HTMLDivElement>(null);

    // The QR code data: just the phone number for unique lookup
    const qrData = `PV:${patientPhone}:${patientName}`;

    const handlePrint = () => {
        if (!printRef.current) return;
        const content = printRef.current.innerHTML;
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) return;

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Sticker - ${patientName}</title>
        <style>
          @page {
            size: 62mm 40mm;
            margin: 0;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', 'Inter', Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding: 0;
          }
          .sticker-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0;
            width: 100%;
          }
          .sticker {
            width: 62mm;
            height: 40mm;
            border: 0.5px dashed #ccc;
            display: flex;
            align-items: center;
            padding: 3mm 4mm;
            gap: 3mm;
            page-break-inside: avoid;
          }
          .qr-section {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .qr-section svg {
            width: 28mm !important;
            height: 28mm !important;
          }
          .info-section {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 1mm;
          }
          .clinic-name {
            font-size: 8pt;
            font-weight: 900;
            font-style: italic;
            color: #1a1a2e;
            letter-spacing: -0.5px;
            line-height: 1;
          }
          .patient-name {
            font-size: 8pt;
            font-weight: 700;
            color: #333;
            line-height: 1.1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .patient-phone {
            font-size: 7pt;
            color: #666;
            font-weight: 500;
            line-height: 1;
          }
          .divider {
            width: 100%;
            height: 0.5px;
            background: #e0e0e0;
          }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 300);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm w-[95vw] rounded-2xl p-0 overflow-hidden">
                <DialogHeader className="p-5 pb-2">
                    <DialogTitle className="text-lg font-bold italic text-primary">Imprimer QR Sticker</DialogTitle>
                </DialogHeader>

                <div className="p-5 pt-2 space-y-4">
                    {/* Preview */}
                    <div className="border-2 border-dashed border-primary/20 rounded-xl p-4 bg-primary/[0.02]">
                        <div ref={printRef}>
                            <div className="sticker-grid">
                                <div className="sticker" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                }}>
                                    <div className="qr-section">
                                        <QRCodeSVG
                                            value={qrData}
                                            size={100}
                                            level="M"
                                            includeMargin={false}
                                        />
                                    </div>
                                    <div className="info-section" style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                        <div className="clinic-name" style={{ fontSize: '11px', fontWeight: 900, fontStyle: 'italic', color: '#1a1a2e', letterSpacing: '-0.5px' }}>
                                            {clinicName}
                                        </div>
                                        <div className="divider" style={{ width: '100%', height: '1px', background: '#e0e0e0' }} />
                                        <div className="patient-name" style={{ fontSize: '11px', fontWeight: 700, color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {patientName}
                                        </div>
                                        <div className="patient-phone" style={{ fontSize: '10px', color: '#666', fontWeight: 500 }}>
                                            {patientPhone}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Print Button */}
                    <Button
                        className="w-full h-12 rounded-xl text-md font-bold gap-2 shadow-lg shadow-primary/20"
                        onClick={handlePrint}
                    >
                        <Printer className="h-5 w-5" />
                        Imprimer le Sticker
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default QrStickerModal;
