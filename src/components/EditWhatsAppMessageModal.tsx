import React, { useState, useEffect } from 'react';
import { X, Save, MessageCircle } from 'lucide-react';

interface EditWhatsAppMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMessage: string;
  onSave: (newMessage: string) => void;
}

const EditWhatsAppMessageModal: React.FC<EditWhatsAppMessageModalProps> = ({ isOpen, onClose, currentMessage, onSave }) => {
  const [message, setMessage] = useState(currentMessage);

  useEffect(() => {
    setMessage(currentMessage);
  }, [currentMessage, isOpen]);

  const handleSave = () => {
    onSave(message);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl relative">
        <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
                <MessageCircle className="text-green-500" />
                <h3 className="text-lg font-bold text-gray-800">Editar Mensagem do WhatsApp</h3>
            </div>
            <button onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                <X size={20} />
            </button>
        </div>
        <div className="p-6">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-md mb-4 text-sm text-blue-800">
                <p className="font-semibold">Use as seguintes variáveis para personalizar a mensagem:</p>
                <ul className="list-disc list-inside mt-1">
                    <li><code>{'{name}'}</code> - Será substituído pelo nome completo do cliente.</li>
                    <li><code>{'{cpf}'}</code> - Será substituído pelo CPF formatado do cliente.</li>
                </ul>
            </div>
            <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full h-64 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite sua mensagem aqui..."
            />
        </div>
        <div className="flex justify-end items-center p-4 border-t gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md font-semibold hover:bg-gray-300">
                Cancelar
            </button>
            <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 flex items-center gap-2">
                <Save size={16} /> Salvar Mensagem
            </button>
        </div>
      </div>
    </div>
  );
};

export default EditWhatsAppMessageModal;