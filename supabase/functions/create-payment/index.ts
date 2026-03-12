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
      amount,
      payment_method: 'pix',
      postback_url: WEBHOOK_URL,
      customer,
      items,
      pix: {
        expires_in_days: 1,
      },
      metadata, // A API espera um objeto, não uma string.
    };

    console.log('[create-payment] Sending payload to Paguex:', JSON.stringify(paguexPayload, null, 2));
    const paguexResponse = await createPaguexTransaction(paguexPayload);
    console.log('[create-payment] Received response from Paguex:', JSON.stringify(paguexResponse, null, 2));

    // Validação e extração dos dados da resposta da Paguex
    const gatewayTransactionId = paguexResponse?.Id;
    const amountInReais = paguexResponse?.Amount;
    const qrCodeText = paguexResponse?.Pix?.QrCodeText;

    if (!gatewayTransactionId || amountInReais === undefined || !qrCodeText) {
      console.error('[create-payment] Invalid response structure from Paguex:', paguexResponse);
      throw new Error('Resposta inválida do provedor de pagamento. Não foi possível extrair os dados do PIX.');
    }

    console.log('[create-payment] Response from Paguex is valid. Proceeding to save transaction.');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const transactionToInsert = {
      lead_id: metadata.lead_id || null,
      starlink_customer_id: metadata.starlink_customer_id || null,
      gateway_transaction_id: gatewayTransactionId,
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
    
    console.log('[create-payment] Formatting response for frontend and sending.');
    return new Response(JSON.stringify(paguexResponse), {
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