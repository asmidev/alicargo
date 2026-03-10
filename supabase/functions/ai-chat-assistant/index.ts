import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatAssistRequest {
  messageId?: string;
  chatId?: string;
  customerMessage?: string;
  context?: {
    orderId?: string;
    productName?: string;
    previousMessages?: string[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ChatAssistRequest = await req.json();
    const { messageId, chatId, customerMessage, context } = body;

    if (!customerMessage) {
      throw new Error("customerMessage is required");
    }

    // Analyze sentiment and intent
    const analysis = await analyzeMessage(customerMessage);
    
    // Generate suggested response
    const suggestedResponse = await generateResponse(
      customerMessage, 
      analysis, 
      context
    );

    // Store analysis if messageId provided
    if (messageId) {
      await supabase.from("ai_chat_analysis").insert({
        message_id: messageId,
        chat_id: chatId,
        sentiment: analysis.sentiment,
        intent: analysis.intent,
        urgency: analysis.urgency,
        suggested_response: suggestedResponse,
        response_confidence: analysis.confidence,
        model_used: "ai-chat-assistant-v1",
      });

      // Update message with AI analysis
      await supabase
        .from("marketplace_chat_messages")
        .update({
          ai_sentiment: analysis.sentiment,
          ai_intent: analysis.intent,
          ai_suggested_response: suggestedResponse,
        })
        .eq("id", messageId);
    }

    // Update chat priority if urgent
    if (chatId && analysis.urgency === "critical") {
      await supabase
        .from("marketplace_chats")
        .update({
          priority: "high",
          ai_sentiment: analysis.sentiment,
        })
        .eq("id", chatId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        suggestedResponse,
        templates: getQuickTemplates(analysis.intent),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Chat assistant error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function analyzeMessage(message: string): Promise<{
  sentiment: string;
  intent: string;
  urgency: string;
  confidence: number;
}> {
  const lowerMessage = message.toLowerCase();
  
  // Sentiment detection
  let sentiment: "positive" | "neutral" | "negative" | "angry" = "neutral";
  const positiveWords = ["rahmat", "yaxshi", "ajoyib", "zo'r", "mamnun", "спасибо", "отлично", "супер"];
  const negativeWords = ["yomon", "muammo", "ishlamayapti", "buzilgan", "плохо", "проблема", "сломан"];
  const angryWords = ["aldash", "firibgar", "shikoyat", "sud", "обман", "мошенник", "суд"];

  if (angryWords.some(w => lowerMessage.includes(w))) {
    sentiment = "angry";
  } else if (negativeWords.some(w => lowerMessage.includes(w))) {
    sentiment = "negative";
  } else if (positiveWords.some(w => lowerMessage.includes(w))) {
    sentiment = "positive";
  }

  // Intent detection
  let intent = "general";
  const intents: Record<string, string[]> = {
    order_status: ["buyurtma", "qayerda", "qachon", "yetkazish", "заказ", "где", "когда", "доставка"],
    return_request: ["qaytarish", "almashtirish", "pul qaytarish", "возврат", "обмен"],
    complaint: ["shikoyat", "norozilik", "ishlamayapti", "жалоба", "не работает"],
    product_question: ["narxi", "o'lchami", "rangi", "bor", "цена", "размер", "цвет", "есть"],
    praise: ["rahmat", "yaxshi", "ajoyib", "спасибо", "отлично"],
  };

  for (const [intentName, keywords] of Object.entries(intents)) {
    if (keywords.some(k => lowerMessage.includes(k))) {
      intent = intentName;
      break;
    }
  }

  // Urgency detection
  let urgency: "low" | "medium" | "high" | "critical" = "medium";
  const urgentWords = ["tez", "zudlik", "darrov", "срочно", "быстро", "сейчас"];
  const criticalWords = ["sud", "advokat", "shikoyat qilaman", "суд", "адвокат", "жалоба"];

  if (criticalWords.some(w => lowerMessage.includes(w))) {
    urgency = "critical";
  } else if (urgentWords.some(w => lowerMessage.includes(w))) {
    urgency = "high";
  } else if (sentiment === "angry") {
    urgency = "high";
  } else if (sentiment === "positive") {
    urgency = "low";
  }

  return { sentiment, intent, urgency, confidence: 0.8 };
}

async function generateResponse(
  customerMessage: string,
  analysis: { sentiment: string; intent: string; urgency: string },
  context?: { orderId?: string; productName?: string; previousMessages?: string[] }
): Promise<string> {
  // Response templates based on intent
  const responses: Record<string, string[]> = {
    order_status: [
      "Salom! Buyurtmangiz hozirda yo'lda. Yetkazib berish 1-2 kun ichida kutilmoqda. Buyurtma raqami: {orderId}",
      "Hurmatli mijoz! Buyurtmangiz qayta ishlanmoqda. Tez orada yetkazib beramiz.",
    ],
    return_request: [
      "Qaytarish so'rovingizni qabul qildik. Iltimos, mahsulotni asl qadoqda yuboring. 3 kun ichida pulni qaytaramiz.",
      "Almashtirish uchun tayyor. Qaysi o'lcham/rang kerak?",
    ],
    complaint: [
      "Noqulaylik uchun uzr so'raymiz. Muammoni tezda hal qilish uchun batafsil ma'lumot bering.",
      "Sizning muammongizni jiddiy qabul qilamiz. Menejer siz bilan bog'lanadi.",
    ],
    product_question: [
      "Ha, bu mahsulot mavjud! Qo'shimcha savollar bo'lsa, yozing.",
      "Mahsulot haqida to'liq ma'lumot: {productName}. Buyurtma berishingiz mumkin.",
    ],
    praise: [
      "Rahmat! Bizdan xarid qilganingizdan mamnunmiz. Yana kutamiz! 😊",
      "Ijobiy fikringiz uchun tashakkur! Sizga doim sifatli xizmat ko'rsatishga harakat qilamiz.",
    ],
    general: [
      "Salom! Qanday yordam bera olaman?",
      "Savolingizga javob beraman. Biroz aniqroq yozib bering.",
    ],
  };

  const templates = responses[analysis.intent] || responses.general;
  let response = templates[Math.floor(Math.random() * templates.length)];

  // Replace placeholders
  if (context?.orderId) {
    response = response.replace("{orderId}", context.orderId);
  }
  if (context?.productName) {
    response = response.replace("{productName}", context.productName);
  }

  // Adjust tone based on sentiment
  if (analysis.sentiment === "angry") {
    response = "Hurmatli mijoz, vaziyatni tushunamiz va hal qilishga harakat qilamiz. " + response;
  }

  return response;
}

function getQuickTemplates(intent: string): string[] {
  const templates: Record<string, string[]> = {
    order_status: [
      "Buyurtmangiz yo'lda, 1-2 kun ichida yetkaziladi",
      "Buyurtma holatini tekshiryapmiz, tez orada xabar beramiz",
    ],
    return_request: [
      "Qaytarish qabul qilindi, 3 kun ichida pul qaytariladi",
      "Iltimos, mahsulotni asl qadoqda yuboring",
    ],
    complaint: [
      "Uzr so'raymiz, muammoni hal qilish ustida ishlaymiz",
      "Menejer siz bilan 1 soat ichida bog'lanadi",
    ],
    product_question: [
      "Mahsulot mavjud, buyurtma berishingiz mumkin",
      "Bu haqda batafsil ma'lumot beraman",
    ],
    praise: [
      "Rahmat! Yana kutamiz! 😊",
      "Ijobiy fikringiz uchun tashakkur!",
    ],
    general: [
      "Qanday yordam bera olaman?",
      "Savolingizni aniqroq yozib bering",
    ],
  };

  return templates[intent] || templates.general;
}
