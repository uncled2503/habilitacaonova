import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { QRCodeCanvas } from 'qrcode.react';
import jsPDF from 'jspdf';
import { X, Loader2, AlertTriangle, Copy, CheckCircle, DollarSign, FileDown, Edit } from 'lucide-react';

interface CustomChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CustomChargeModal: React.FC<CustomChargeModalProps> = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('Taxa de Adesão');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') {
        setAmount('');
        return;
    }
    value = String(parseInt(value, 10));
    if (value.length < 3) {
        value = value.padStart(3, '0');
    }
    const formattedValue = value.slice(0, -2) + ',' + value.slice(-2);
    setAmount(formattedValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setPaymentInfo(null);

    const amountInReais = parseFloat(amount.replace(',', '.'));
    if (isNaN(amountInReais) || amountInReais <= 0) {
        setError("Por favor, insira um valor válido.");
        setIsLoading(false);
        return;
    }
    const amountInCents = Math.round(amountInReais * 100);

    try {
      const payload = {
        amount: amountInCents,
        customer: {
          name: "Lukas Nascimento Camelo",
          email: 'cobranca.avulsa@example.com',
          document: { type: 'cpf', number: "14435336707" },
          phone: '11999999999',
        },
        items: [{ 
            title: title, 
            unit_price: amountInCents, 
            quantity: 1,
            tangible: false
        }],
        metadata: { source: 'admin_dashboard' },
      };

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('create-payment', { body: payload });
      if (paymentError) throw paymentError;
      setPaymentInfo(paymentData);
    } catch (err: any) {
      console.error("Erro ao criar cobrança avulsa:", err);
      setError(err.message || "Ocorreu um erro ao gerar o PIX. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

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
    const canvas = document.getElementById('qr-code-canvas-custom') as HTMLCanvasElement;
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
        doc.text(title, 140, 60, { align: 'center' });
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
        doc.save(`cobranca-pix.pdf`);
    };
  };

  const handleClose = () => {
    setError(null);
    setPaymentInfo(null);
    setIsLoading(false);
    setIsCopied(false);
    setAmount('');
    setTitle('Taxa de Adesão');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md relative my-8">
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
              <h3 className="text-lg font-bold text-gray-800">{title}</h3>
              <p className="text-gray-600 mb-4">
                Valor: <strong>{(paymentInfo.data.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </p>
              <div className="flex justify-center mb-4">
                <QRCodeCanvas
                  id="qr-code-canvas-custom"
                  value={paymentInfo.data.pix.qr_code}
                  size={200}
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
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <img src="/Gov.br_logo.svg.png" alt="gov.br" className="h-8 mx-auto mb-6" />
              <div>
                <label className="font-semibold">Título da Cobrança</label>
                <div className="relative">
                    <input type="text" name="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full p-3 border rounded-lg mt-1 pl-10" />
                    <Edit className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
              </div>
              <div>
                <label className="font-semibold">Valor (R$)</label>
                <div className="relative">
                    <input type="text" name="amount" placeholder="0,00" value={amount} onChange={handleAmountChange} required className="w-full p-3 border rounded-lg mt-1 pl-10" />
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
              </div>
              <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition-colors">
                Gerar PIX
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomChargeModal;