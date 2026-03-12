// --- Paguex API Configuration ---
const PAGUEX_API_URL = 'https://api.paguex.online/v1';
const PAGUEX_PUBLIC_KEY = Deno.env.get('PAGUEX_PUBLIC_KEY');
const PAGUEX_SECRET_KEY = Deno.env.get('PAGUEX_SECRET_KEY');

/**
 * Gera o header de autenticação Basic para a Paguex.
 */
export function getPaguexAuthHeader(): string {
  if (!PAGUEX_PUBLIC_KEY || !PAGUEX_SECRET_KEY) {
    console.error('[getPaguexAuthHeader] As chaves da Paguex não estão configuradas.');
    throw new Error('Configuração do provedor de pagamento incompleta.');
  }
  
  const credentials = `${PAGUEX_PUBLIC_KEY}:${PAGUEX_SECRET_KEY}`;
  const base64Credentials = btoa(credentials);
  return `Basic ${base64Credentials}`;
}

/**
 * Cria uma nova transação de pagamento usando a API da Paguex.
 * @param payload - Os dados da transação.
 * @returns Os dados da transação criada.
 */
export async function createPaguexTransaction(payload: object) {
  const authHeader = getPaguexAuthHeader();
  const url = `${PAGUEX_API_URL}/payment-transaction/create`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error('[createPaguexTransaction] Falha na API da Paguex. Status:', response.status);
    console.error('[createPaguexTransaction] Resposta recebida:', responseText);
    try {
      const errorData = JSON.parse(responseText);
      const errorMessage = errorData.message || (errorData.errors && JSON.stringify(errorData.errors)) || 'Falha na comunicação com o provedor de pagamento.';
      throw new Error(errorMessage);
    } catch (e) {
      const genericMessage = `Falha na comunicação com o provedor de pagamento. Status: ${response.status}`;
      throw new Error(responseText || genericMessage);
    }
  }

  try {
    const data = JSON.parse(responseText);
    return data;
  } catch (e) {
    console.error('[createPaguexTransaction] Falha ao analisar a resposta JSON de sucesso da Paguex. Status:', response.status, 'Texto da Resposta:', responseText);
    throw new Error('Resposta inválida do provedor de pagamento.');
  }
}

/**
 * Busca os dados da empresa na Paguex.
 * @returns Os dados da empresa.
 */
export async function getPaguexCompanyData() {
    const authHeader = getPaguexAuthHeader();
    const url = `${PAGUEX_API_URL}/company`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('[getPaguexCompanyData] Falha ao buscar dados da empresa:', response.status, data);
        throw new Error(data.message || 'Falha na comunicação com o provedor de pagamento para buscar dados da empresa.');
    }

    return data;
}

/**
 * Busca informações de uma transação na Paguex.
 * @param transactionId - O ID da transação.
 * @returns Os dados da transação, ou null se não for encontrada (404).
 */
export async function getPaguexTransaction(transactionId: string) {
  const authHeader = getPaguexAuthHeader();
  const url = `${PAGUEX_API_URL}/payment-transaction/info/${transactionId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'accept': 'application/json',
    },
  });

  if (!response.ok) {
    const responseText = await response.text();
    console.warn(`[getPaguexTransaction] Falha ao buscar transação ${transactionId}. Status: ${response.status}. Resposta: "${responseText}"`);
    
    if (response.status === 404) {
        return null; // Retorna null para que a função chamadora saiba que não foi encontrado.
    }

    let errorMessage = `Falha na comunicação com o provedor. Status: ${response.status}`;
    if (responseText) {
        try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.message || JSON.stringify(errorData.errors) || errorMessage;
        } catch (e) {
            errorMessage = responseText.substring(0, 150);
        }
    }
    throw new Error(errorMessage);
  }

  return await response.json();
}