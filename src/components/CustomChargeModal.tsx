import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Loader2, AlertTriangle, Copy, CheckCircle, DollarSign } from 'lucide-react';

interface CustomChargeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CustomChargeModal: React.FC<CustomChargeModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    amount: '',
    name: '',
    cpf: '',
    email: '',
    phone: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cpf') {
        formattedValue = value.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').substring(0, 14);
    } else if (name === 'phone') {
        formattedValue = value.replace(/\D/g, '').replace(/^(\d{2})(\d)/g, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').substring(0, 15);
    } else if (name === 'amount') {
        formattedValue = value.replace(/\D/g, '');
    }

    setFormData(prev => ({ ...prev, [name]: formattedValue }));
  };

  const getAmountInReais = () => {
    const amountNumber = parseFloat(formData.amount) / 100;
    if (isNaN(amountNumber)) return 'R$ 0,00';
    return amountNumber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setPaymentInfo(null);

    const amountInCents = parseInt(formData.amount, 10);
    if (isNaN(amountInCents) || amountInCents <= 0) {
        setError("Por favor, insira um valor válido.");
        setIsLoading(false);
        return;
    }

    try {
      const payload = {
        amount: amountInCents,
        customer: {
          name: formData.name,
          email: formData.email,
          document: { type: 'cpf', number: formData.cpf.replace(/\D/g, '') },
          phone: formData.phone.replace(/\D/g, ''),
        },
        items: [{ 
            title: 'Cobrança Avulsa', 
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

  const handleClose = () => {
    setError(null);
    setPaymentInfo(null);
    setIsLoading(false);
    setIsCopied(false);
    setFormData({ amount: '', name: '', cpf: '', email: '', phone: '' });
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
          <h2 className="text-xl font-bold text-center text-gray-800 mb-6">Gerar Cobrança PIX Avulsa</h2>
          
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
              <h3 className="text-lg font-bold text-gray-800">Cobrança Gerada com Sucesso!</h3>
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
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="font-semibold">Valor (em centavos)</label>
                <div className="relative">
                    <input type="text" name="amount" placeholder="Ex: 4790 para R$ 47,90" value={formData.amount} onChange={handleInputChange} required className="w-full p-3 border rounded-lg mt-1 pl-10" />
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
                <p className="text-sm text-gray-500 mt-1 text-right font-medium">Valor a ser cobrado: {getAmountInReais()}</p>
              </div>
              <div>
                <label className="font-semibold">Nome Completo</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="w-full p-3 border rounded-lg mt-1" />
              </div>
              <div>
                <label className="font-semibold">CPF</label>
                <input type="text" name="cpf" value={formData.cpf} onChange={handleInputChange} required className="w-full p-3 border rounded-lg mt-1" />
              </div>
              <div>
                <label className="font-semibold">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleInputChange} required className="w-full p-3 border rounded-lg mt-1" />
              </div>
              <div>
                <label className="font-semibold">Celular (com DDD)</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} required className="w-full p-3 border rounded-lg mt-1" />
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