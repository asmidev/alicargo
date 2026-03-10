import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const YANDEX_API_BASE = 'https://api.partner.market.yandex.ru';

interface YandexQuestion {
  id: number;
  productId: number;
  createdAt: string;
  text: string;
  author?: {
    name?: string;
  };
  answer?: {
    text: string;
    createdAt: string;
  };
  canAnswer: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { store_id, action = 'list', question_id, answer_text, page = 1 } = await req.json();

    if (!store_id) {
      throw new Error('store_id is required');
    }

    // Get store credentials
    const { data: store, error: storeError } = await supabase
      .from('marketplace_stores')
      .select('*')
      .eq('id', store_id)
      .eq('platform', 'yandex')
      .single();

    if (storeError || !store) {
      throw new Error(`Store not found: ${storeError?.message}`);
    }

    const apiKey = Deno.env.get(store.api_key_secret_name);
    if (!apiKey) {
      throw new Error(`API key not configured: ${store.api_key_secret_name}`);
    }

    const businessId = store.business_id;
    if (!businessId) {
      throw new Error('Business ID not configured for this store');
    }

    console.log(`[yandex-questions] Action: ${action} for ${store.name}`);

    // Action: List questions
    if (action === 'list') {
      const response = await fetch(
        `${YANDEX_API_BASE}/businesses/${businessId}/goods-questions`,
        {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page,
            pageSize: 50,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-questions] List error: ${response.status} - ${errorText}`);
        throw new Error(`Yandex API error: ${response.status}`);
      }

      const data = await response.json();
      const questions: YandexQuestion[] = data.result?.questions || [];
      
      const unanswered = questions.filter(q => !q.answer && q.canAnswer);
      console.log(`[yandex-questions] Found ${questions.length} questions, ${unanswered.length} unanswered`);

      return new Response(
        JSON.stringify({
          success: true,
          store: store.name,
          total: questions.length,
          unanswered_count: unanswered.length,
          questions: questions.map(q => ({
            id: q.id,
            product_id: q.productId,
            text: q.text,
            author: q.author?.name || 'Anonim',
            created_at: q.createdAt,
            can_answer: q.canAnswer,
            has_answer: !!q.answer,
            answer: q.answer ? {
              text: q.answer.text,
              created_at: q.answer.createdAt,
            } : null,
          })),
          paging: data.result?.paging,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Answer a question
    if (action === 'answer') {
      if (!question_id || !answer_text) {
        throw new Error('question_id and answer_text are required for answering');
      }

      const response = await fetch(
        `${YANDEX_API_BASE}/businesses/${businessId}/goods-questions/answers`,
        {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            questionId: question_id,
            text: answer_text,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-questions] Answer error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to submit answer: ${response.status}`);
      }

      console.log(`[yandex-questions] Answered question ${question_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Javob muvaffaqiyatli yuborildi',
          question_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Update an answer
    if (action === 'update') {
      if (!question_id || !answer_text) {
        throw new Error('question_id and answer_text are required for updating');
      }

      const response = await fetch(
        `${YANDEX_API_BASE}/businesses/${businessId}/goods-questions/update`,
        {
          method: 'POST',
          headers: {
            'Api-Key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            questionId: question_id,
            text: answer_text,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[yandex-questions] Update error: ${response.status} - ${errorText}`);
        throw new Error(`Failed to update answer: ${response.status}`);
      }

      console.log(`[yandex-questions] Updated answer for question ${question_id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Javob yangilandi',
          question_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    console.error('[yandex-questions] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
