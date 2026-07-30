import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      // Fallback: return a helpful local response when no AI key is configured.
      const reply = localReply(message);
      return new Response(
        JSON.stringify({ reply, mode: "local" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are NURA, the built-in AI assistant inside NUVORA, a modern messaging app created by Barry Courage. Be concise, friendly, and helpful. You can help with writing messages, translation, grammar correction, chat summaries, and general questions.",
          },
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ reply: localReply(message), mode: "fallback", error: errText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content ?? localReply(message);

    return new Response(
      JSON.stringify({ reply, mode: "openai" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message, reply: "Sorry, I could not process that right now." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function localReply(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("translate")) {
    const map: Record<string, string> = { hello: "hola", "thank you": "gracias", goodbye: "adiós" };
    const word = Object.keys(map).find((k) => lower.includes(k));
    return word
      ? `"${word}" in Spanish is "${map[word]}".`
      : "I can translate between common languages — tell me the phrase and target language.";
  }
  if (lower.includes("grammar") || lower.includes("fix")) {
    return "Paste the text and I will correct spelling, grammar, and punctuation while keeping your meaning.";
  }
  if (lower.includes("summar")) {
    return "Open a conversation and tap the NURA icon in the chat header to get a concise summary.";
  }
  if (lower.includes("write") || lower.includes("message")) {
    return "Tell me the tone and key points, and I will draft the message for you.";
  }
  if (lower.includes("hello") || lower.includes("hi")) {
    return "Hello! I am NURA, your NUVORA assistant. How can I help?";
  }
  return `I heard: "${input}". I am NURA, NUVORA's built-in assistant. Connect an AI API key to enable full natural conversation.`;
}
