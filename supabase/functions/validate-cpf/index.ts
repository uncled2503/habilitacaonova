import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// --- Standardized Response Interface ---
interface CpfData {
  name: string;
  birthDate: string;
  gender: string;
}

interface StandardizedResponse {
  success: boolean;
  data?: CpfData;
  message?: string;
}

// --- API Provider Handlers ---

/**
 * Handler for the BrasilAPI. (New primary provider)
 */
async function handleBrasilApi(cpf: string): Promise<StandardizedResponse> {
  const url = `https://brasilapi.com.br/api/cpf/v1/${cpf}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `BrasilAPI failed with status ${response.status}`);
  }

  const data = await response.json();
  
  // BrasilAPI returns 'MASCULINO' or 'FEMININO', we need 'M' or 'F'
  const gender = data.genero?.toUpperCase().startsWith('F') ? 'F' : 'M';
  
  return {
    success: true,
    data: {
      name: data.nome,
      birthDate: data.nascimento,
      gender: gender,
    }
  };
}


/**
 * Handler for the CPFHub.io API.
 */
async function handleCpfHub(cpf: string, apiKey: string): Promise<StandardizedResponse> {
  const url = `https://api.cpfhub.io/cpf/${cpf}`;
  const response = await fetch(url, {
    headers: { 'x-api-key': apiKey }
  });
  const data = await response.json();

  if (response.ok && data.success) {
    return {
      success: true,
      data: {
        name: data.data.name,
        birthDate: data.data.birthDate,
        gender: data.data.gender,
      }
    };
  } else {
    throw new Error(data.message || `CPFHub failed with status ${response.status}`);
  }
}

/**
 * Handler for the HubDoDesenvolvedor API.
 */
async function handleHubDev(cpf: string, apiKey: string): Promise<StandardizedResponse> {
  const url = `https://ws.hubdodesenvolvedor.com.br/v2/cadastropf/?cpf=${cpf}&token=${apiKey}`;
  const response = await fetch(url, { method: 'GET' });
  const data = await response.json();

  if (response.ok && data.status === true && data.return === "OK") {
    // Transform the response to the standardized format
    const gender = data.result.genero?.toUpperCase().startsWith('F') ? 'F' : 'M';
    return {
      success: true,
      data: {
        name: data.result.nomeCompleto,
        birthDate: data.result.dataDeNascimento,
        gender: gender,
      }
    };
  } else {
    throw new Error(data.result || `HubDev failed with status ${response.status}`);
  }
}


// --- API Provider Configuration ---
// The function will try these providers in order.
const apiProviders = [
  { name: 'BrasilAPI', handler: (cpf: string) => handleBrasilApi(cpf) },
  { name: 'CPF_API_KEY', handler: (cpf: string) => handleCpfHub(cpf, Deno.env.get('CPF_API_KEY')!) },
  { name: 'CPF_API_KEY_2', handler: (cpf: string) => handleCpfHub(cpf, Deno.env.get('CPF_API_KEY_2')!) },
  { name: 'CPF_API_KEY_3', handler: (cpf: string) => handleHubDev(cpf, Deno.env.get('CPF_API_KEY_3')!) },
];


// --- Main Server Logic ---
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { cpf } = await req.json();
    if (!cpf) {
      console.error('[validate-cpf] CPF is missing in the request body.');
      return new Response(JSON.stringify({ error: 'CPF is required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const unformattedCpf = cpf.replace(/\D/g, '');
    
    for (const provider of apiProviders) {
      // For keyed APIs, check if the key exists before trying.
      if (provider.name.includes('API_KEY') && !Deno.env.get(provider.name)) {
        console.log(`[validate-cpf] Skipping provider ${provider.name} because key is not set.`);
        continue;
      }

      console.log(`[validate-cpf] Attempting validation with provider: ${provider.name}`);
      try {
        const result = await provider.handler(unformattedCpf);
        
        if (result.success) {
          console.log(`[validate-cpf] CPF validation successful with ${provider.name} for CPF: ${cpf}`);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });
        }
      } catch (error) {
        console.warn(`[validate-cpf] Provider ${provider.name} failed:`, error.message);
      }
    }

    console.error('[validate-cpf] All CPF validation providers failed.');
    return new Response(JSON.stringify({ success: false, message: 'Não foi possível validar o CPF no momento. Tente novamente mais tarde.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503,
    });

  } catch (error) {
    console.error('[validate-cpf] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})