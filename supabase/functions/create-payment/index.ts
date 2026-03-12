import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { createPaguexTransaction } from '../_shared/paguex.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WEBHOOK_URL = `https://lubhskftgevcgfkzxozx.supabase.co/functions/v1/payment-webhook`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { amount, customer, items, metadata } = await req.json();

    const isAdminPayment = metadata && metadata.source === 'admin_dashboard';

    if (!amount || !customer || !items || !metadata || (!isAdminPayment && !metadata.lead_id && !metadata.starlink_customer_id)) {
      console.error('[create-payment] Missing required fields in request body.');
      return new Response(JSON.stringify({ error: 'Dados insuficientes para criar a transação.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const paguexPayload = {
      amount, // O valor deve ser enviado em centavos
      payment_method: 'pix',
      postback_url: WEBHOOK_URL,
      customer,
      items,
      pix: {
        expires_in_days: 1,
      },
      metadata,
    };

    console.log('[create-payment] Sending payload to Paguex:', JSON.stringify(paguexPayload, null, 2));
    const paguexResponse = await createPaguexTransaction(paguexPayload);
    console.log('[create-payment] Received response from Paguex:', JSON.stringify(paguexResponse, null, 2));

    // Extrai os dados da resposta da Paguex, que vem em um array 'data'
    const transactionDataArray = paguexResponse?.data;
    if (!Array.isArray(transactionDataArray) || transactionDataArray.length === 0) {
      throw new Error('Estrutura de resposta da Paguex para criação de transação é inválida (esperado `data` como array).');
    }
    const transactionData = transactionDataArray[0];

    // O campo 'pix' também é um array
    const pixDataArray = transactionData?.pix;
    if (!Array.isArray(pixDataArray) || pixDataArray.length === 0) {
      throw new Error('Estrutura de resposta da Paguex para criação de transação é inválida (esperado `pix` como array).');
    }
    const pixData = pixDataArray[0];

    if (!transactionData.id || !pixData.qr_code) {
      throw new Error('Dados essenciais (ID da transação ou QR Code) não encontrados na resposta da Paguex.');
    }

    console.log('[create-payment] Response from Paguex is valid. Proceeding to save transaction.');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const amountInReais = transactionData.amount / 100;

    const transactionToInsert = {
      lead_id: metadata.lead_id || null,
      starlink_customer_id: metadata.starlink_customer_id || null,
      gateway_transaction_id: transactionData.id,
      amount: amountInReais,
      status: 'pending',
      provider: 'paguex',
    };

    console.log('[create-payment] Attempting to insert transaction into database with data:', JSON.stringify(transactionToInsert));
    const { data: insertedTransaction, error: dbError } = await supabaseAdmin
      .from('transactions')
      .insert(transactionToInsert)
      .select('id')
      .single();

    if (dbError || !insertedTransaction) {
      console.error('[create-payment] Error saving transaction to DB:', dbError);
      console.error('[create-payment] Data that failed to insert:', JSON.stringify(transactionToInsert));
      throw new Error('Falha ao registrar a transação. Por favor, tente novamente.');
    } else {
        console.log(`[create-payment] Transaction saved to DB successfully. Internal ID: ${insertedTransaction.id}`);
    }

    // Formata a resposta para ser idêntica à da API antiga, como solicitado
    const responseForFrontend = {
        Id: transactionData.id,
        Amount: amountInReais,
        Pix: {
            QrCodeText: pixData.qr_code,
        },
    };
    
    console.log('[create-payment] Formatting response for frontend and sending.');
    return new Response(JSON.stringify(responseForFrontend), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('[create-payment] Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})