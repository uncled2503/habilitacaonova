import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../integrations/supabase/client';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import { X, Loader2, AlertTriangle, Copy, CheckCircle, FileDown } from 'lucide-react';

interface Lead {
    id: string;
    name: string;
    email: string;
    phone: string;
    cpf: string;
}

interface GenerateChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
}

const PAYMENT_AMOUNT_IN_CENTS = 4790; // R$ 47,90

const GenerateChargeModal: React.FC<GenerateChargeModalProps> = ({ isOpen, onClose, lead }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);
  const hasCreatedPayment = useRef(false);

  useEffect(() => {
    const createPayment = async () => {
      if (!lead) {
        setError("Dados do lead não encontrados.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setPaymentInfo(null);

      try {
        const payload = {
          amount: PAYMENT_AMOUNT_IN_CENTS,
          customer: {
            name: lead.name,
            email: lead.email,
            document: { type: 'cpf', number: lead.cpf.replace(/\D/g, '') },
            phone: lead.phone.replace(/\D/g, ''),
          },
          items: [{ 
              title: 'Taxa de Adesão CNH', 
              unit_price: PAYMENT_AMOUNT_IN_CENTS, 
              quantity: 1,
              tangible: false
          }],
          metadata: { lead_id: lead.id, product: 'cnh_fee_retake' },
        };

        const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment', { body: payload });
        if (paymentError) throw paymentError;
        setPaymentInfo(paymentData);
      } catch (err: any) {
        console.error("Erro ao criar cobrança:", err);
        setError(err.message || "Ocorreu um erro ao gerar o PIX. Tente novamente.");
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen && lead && !hasCreatedPayment.current) {
      hasCreatedPayment.current = true;
      createPayment();
    }
  }, [isOpen, lead]);

  const handleCopy = () => {
    if (paymentInfo?.data?.pix?.qr_code) {
        navigator.clipboard.writeText(paymentInfo.data.pix.qr_code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownloadPDF = () => {
    if (!paymentInfo?.data) return;

    const doc = new jsPDF({ orientation: 'p', unit: 'px', format: [280, 420] });
    const canvas = document.getElementById('qr-code-canvas-charge') as HTMLCanvasElement;
    if (!canvas) {
        console.error("QR Code Canvas não encontrado");
        return;
    }
    const qrCodeDataUrl = canvas.toDataURL('image/png');
    const amountFormatted = (paymentInfo.data.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const logoImg = new Image();
    logoImg.src = '/Gov.br_logo.svg.png';
    logoImg.onload = () => {
        doc.addImage(logoImg, 'PNG', 110, 20, 60, 15);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Valor Pendente - Taxa de Adesão', 140, 60, { align: 'center' });
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Valor: ${amountFormatted}`, 140, 75, { align: 'center' });
        doc.addImage(qrCodeDataUrl, 'PNG', 80, 90, 120, 120);
        doc.setFillColor(243, 244, 246);
        doc.setDrawColor(209, 213, 219);
        doc.roundedRect(30, 225, 220, 70, 5, 5, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(107, 114, 128);
        const pixKey = paymentInfo.data.pix.qr_code;
        const splitText = doc.splitTextToSize(pixKey, 210);
        doc.text(splitText, 35, 235);
        doc.setFillColor(13, 110, 253);
        doc.roundedRect(30, 310, 220, 30, 5, 5, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('Copiar Código PIX', 140, 328, { align: 'center' });
        doc.save(`cobranca-pix-${lead?.name.replace(/\s/g, '_')}.pdf`);
    };
  };

  const handleClose = () => {
    setError(null);
    setPaymentInfo(null);
    setIsLoading(true);
    setIsCopied(false);
    hasCreatedPayment.current = false;
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm relative my-8">
        <button onClick={handleClose} className="absolute right-2 top-2 p-2 text-gray-500 hover:bg-gray-100 rounded-full z-10">
            <X size={20} />
        </button>
        <div className="p-6 pt-10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center text-center h-64">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
              <p className="text-lg text-gray-600">Gerando cobrança...</p>
            </div>
          ) : error ? (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md flex items-center gap-3">
              <AlertTriangle size={20} /> <p>{error}</p>
            </div>
          ) : paymentInfo?.data ? (
            <div className="text-center">
              <img src="/Gov.br_logo.svg.png" alt="gov.br" className="h-8 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-800">Valor Pendente - Taxa de Adesão</h3>
              <p className="text-gray-600 mb-4">
                Valor: <strong>{(paymentInfo.data.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </p>
              <div className="flex justify-center mb-4">
                <QRCodeCanvas
                  id="qr-code-canvas-charge"
                  value={paymentInfo.data.pix.qr_code}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="L"
                />
              </div>
              <div className="relative bg-gray-100 border border-gray-300 rounded-lg p-3 text-xs text-gray-600 text-left break-all">
                {paymentInfo.data.pix.qr_code}
              </div>
              <button onClick={handleCopy} className="w-full mt-3 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                {isCopied ? <><CheckCircle size={20} /> Copiado!</> : <><Copy size={20} /> Copiar Código PIX</>}
              </button>
              <button onClick={handleDownloadPDF} className="w-full mt-3 flex items-center justify-center gap-2 bg-gray-700 text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors">
                <FileDown size={20} /> Baixar PDF
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default GenerateChargeModal;