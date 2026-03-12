// --- BrazoPay API Configuration ---
const BRAZOPAY_API_URL = 'https://api.SUA_NOVA_API.com/v1'; // <-- Substitua pela URL base correta
const BRAZOPAY_PUBLIC_KEY = Deno.env.get('BRAZOPAY_PUBLIC_KEY'); // <-- Use a variável de ambiente correta
const BRAZOPAY_SECRET_KEY = Deno.env.get('BRAZOPAY_SECRET_KEY'); // <-- Use a variável de ambiente correta

/**
 * Gera o header de autenticação Basic para a BrazoPay.
 */
export function getBrazoPayAuthHeader(): string {
  if (!BRAZOPAY_PUBLIC_KEY || !BRAZOPAY_SECRET_KEY) {
    console.error('[getBrazoPayAuthHeader] As chaves da BrazoPay não estão configuradas.');
    throw new Error('Configuração do provedor de pagamento incompleta.');
  }
  
  const credentials = `${BRAZOPAY_PUBLIC_KEY}:${BRAZOPAY_SECRET_KEY}`;
  const base64Credentials = btoa(credentials);
  return `Basic ${base64Credentials}`;
}

/**
 * Cria uma nova transação de pagamento usando a API da BrazoPay.
 * @param payload - Os dados da transação.
 * @returns Os dados da transação criada.
 */
export async function createBrazoPayTransaction(payload: object) {
  const authHeader = getBrazoPayAuthHeader();
  const url = `${BRAZOPAY_API_URL}/payment-transaction/create`; // <-- Substitua pelo endpoint correto

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
    console.error('[createBrazoPayTransaction] Falha na API da BrazoPay. Status:', response.status);
    console.error('[createBrazoPayTransaction] Resposta recebida:', responseText);
    try {
      const errorData = JSON.parse(responseText);
      const errorMessage = errorData.message || (errorData.errors && JSON.stringify(errorData.errors)) || 'Falha na comunicação com o provedor de pagamento.';
      throw new Error(errorMessage);
    } catch (e) {
      throw new Error('Falha na comunicação com o provedor de pagamento.');
    }
  }

  try {
    const data = JSON.parse(responseText);
    return data;
  } catch (e) {
    console.error('[createBrazoPayTransaction] Falha ao analisar a resposta JSON de sucesso da BrazoPay. Status:', response.status, 'Texto da Resposta:', responseText);
    throw new Error('Resposta inválida do provedor de pagamento.');
  }
}

/**
 * Busca os dados da empresa na BrazoPay.
 * @returns Os dados da empresa.
 */
export async function getBrazoPayCompanyData() {
    const authHeader = getBrazoPayAuthHeader();
    const url = `${BRAZOPAY_API_URL}/company`; // <-- Substitua pelo endpoint correto

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        },
    });

    const data = await response.json();

    if (!response.ok) {
        console.error('[getBrazoPayCompanyData] Falha ao buscar dados da empresa:', response.status, data);
        throw new Error(data.message || 'Falha na comunicação com o provedor de pagamento para buscar dados da empresa.');
    }

    return data;
}

/**
 * Busca informações de uma transação na BrazoPay.
 * @param transactionId - O ID da transação.
 * @returns Os dados da transação.
 */
export async function getBrazoPayTransaction(transactionId: string) {
  const authHeader = getBrazoPayAuthHeader();
  const url = `${BRAZOPAY_API_URL}/payment-transaction/info/${transactionId}`; // <-- Substitua pelo endpoint correto

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'accept': 'application/json',
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`[getBrazoPayTransaction] Falha ao buscar transação ${transactionId} na BrazoPay:`, response.status, data);
    throw new Error(data.message || 'Falha na comunicação com o provedor de pagamento.');
  }

  return data;
}