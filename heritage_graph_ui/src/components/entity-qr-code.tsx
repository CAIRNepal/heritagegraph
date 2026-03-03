'use client';

import { useState, useRef, useCallback } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { QrCode, Download, Printer, Copy, Check } from 'lucide-react';

export interface EntityQRCodeProps {
  /** Entity ID (UUID or numeric ID) */
  entityId: string | number;
  /** Entity name/label for display */
  entityName: string;
  /** Entity type/category for context */
  entityType?: string;
  /** Optional location name for context */
  locationName?: string;
  /** Custom URL override (defaults to /contribute/scan/[id]) */
  customUrl?: string;
  /** Size of the QR code in pixels */
  qrSize?: number;
  /** Button size variant */
  size?: 'sm' | 'default' | 'lg' | 'icon';
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Whether to show the trigger button or just the QR code itself */
  showTrigger?: boolean;
  /** Custom trigger element */
  trigger?: React.ReactNode;
}

/**
 * QR Code component for entities that links to a public contribution page.
 * When scanned, visitors can contribute information they know about the entity.
 * 
 * Ideal for placing on walls of historical sites, monuments, temples, etc.
 */
export function EntityQRCode({
  entityId,
  entityName,
  entityType = 'Heritage Site',
  locationName,
  customUrl,
  qrSize = 256,
  size = 'sm',
  variant = 'ghost',
  showTrigger = true,
  trigger,
}: EntityQRCodeProps) {
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Generate the contribution URL
  const baseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_APP_URL || 'https://heritagegraph.org';
  
  const contributeUrl = customUrl || `${baseUrl}/contribute/scan/${entityId}`;
  
  // Copy URL to clipboard
  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(contributeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  }, [contributeUrl]);
  
  // Download QR code as PNG
  const handleDownload = useCallback(() => {
    // Create a temporary canvas with the QR code
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const padding = 40;
    const qrCodeSize = qrSize;
    const textHeight = 80;
    const totalWidth = qrCodeSize + padding * 2;
    const totalHeight = qrCodeSize + padding * 2 + textHeight;
    
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    
    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, totalWidth, totalHeight);
    
    // Draw QR code
    const qrCanvas = document.querySelector('#qr-code-canvas') as HTMLCanvasElement;
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, padding, padding, qrCodeSize, qrCodeSize);
    }
    
    // Draw text below QR code
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entityName.length > 30 ? entityName.substring(0, 30) + '...' : entityName, totalWidth / 2, qrCodeSize + padding + 25);
    
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Scan to contribute what you know!', totalWidth / 2, qrCodeSize + padding + 45);
    ctx.fillText('HeritageGraph.org', totalWidth / 2, qrCodeSize + padding + 65);
    
    // Download
    const link = document.createElement('a');
    link.download = `qr-${entityName.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [entityName, qrSize]);
  
  // Print QR code
  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${entityName}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
              font-family: system-ui, sans-serif;
              box-sizing: border-box;
            }
            .qr-container {
              text-align: center;
              padding: 40px;
              border: 3px solid #1e40af;
              border-radius: 16px;
              background: white;
            }
            .qr-title {
              font-size: 24px;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 8px;
            }
            .qr-type {
              font-size: 14px;
              color: #64748b;
              margin-bottom: 20px;
            }
            .qr-code {
              margin: 20px 0;
            }
            .qr-cta {
              font-size: 18px;
              font-weight: 600;
              color: #0f172a;
              margin-top: 20px;
            }
            .qr-subtitle {
              font-size: 14px;
              color: #64748b;
              margin-top: 8px;
            }
            .qr-logo {
              font-size: 12px;
              color: #94a3b8;
              margin-top: 16px;
            }
            @media print {
              body { padding: 0; }
              .qr-container { border: 2px solid #1e40af; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <div class="qr-title">${entityName}</div>
            <div class="qr-type">${entityType}${locationName ? ` • ${locationName}` : ''}</div>
            <div class="qr-code">
              <img src="${document.querySelector('#qr-code-canvas')?.toDataURL()}" width="${qrSize}" height="${qrSize}" />
            </div>
            <div class="qr-cta">📱 Scan to Share What You Know!</div>
            <div class="qr-subtitle">Help preserve our cultural heritage</div>
            <div class="qr-logo">HeritageGraph.org</div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [entityName, entityType, locationName, qrSize]);
  
  const qrContent = (
    <div className="flex flex-col items-center gap-6">
      {/* QR Code with gradient border */}
      <div className="relative p-4 bg-white rounded-2xl shadow-lg border-2 border-blue-200">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-sky-500 rounded-2xl opacity-10" />
        <QRCodeCanvas
          id="qr-code-canvas"
          value={contributeUrl}
          size={qrSize}
          level="H"
          includeMargin={true}
          imageSettings={{
            src: '/logo.png',
            height: 40,
            width: 40,
            excavate: true,
          }}
        />
      </div>
      
      {/* Entity info */}
      <div className="text-center space-y-1">
        <h3 className="font-bold text-lg text-blue-900 dark:text-blue-100">
          {entityName}
        </h3>
        <p className="text-sm text-muted-foreground">
          {entityType}{locationName && ` • ${locationName}`}
        </p>
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
          Scan to contribute what you know!
        </p>
      </div>
      
      {/* URL display */}
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg w-full max-w-sm">
        <code className="text-xs flex-1 truncate">{contributeUrl}</code>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleCopyUrl}
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          Download PNG
        </Button>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>
      
      {/* Instructions */}
      <div className="text-xs text-muted-foreground text-center max-w-sm">
        <p className="font-medium mb-1">💡 Placement Tips:</p>
        <p>
          Print and place this QR code near the site entrance, on information boards,
          or anywhere visitors can easily scan it. When they do, they&apos;ll be able
          to share stories, photos, and knowledge about this place.
        </p>
      </div>
    </div>
  );
  
  if (!showTrigger) {
    return qrContent;
  }
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={variant} size={size} className="gap-2">
            <QrCode className="h-4 w-4" />
            {size !== 'icon' && 'QR Code'}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-600" />
            Crowdsource Contributions
          </DialogTitle>
          <DialogDescription>
            Place this QR code at the site so visitors can contribute information they know.
          </DialogDescription>
        </DialogHeader>
        {qrContent}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact QR code button for tables/lists
 */
export function QRCodeButton({
  entityId,
  entityName,
  entityType,
}: {
  entityId: string | number;
  entityName: string;
  entityType?: string;
}) {
  return (
    <EntityQRCode
      entityId={entityId}
      entityName={entityName}
      entityType={entityType}
      qrSize={200}
      trigger={
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <QrCode className="h-4 w-4" />
        </Button>
      }
    />
  );
}
