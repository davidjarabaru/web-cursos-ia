// api/generate.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { topic = "", level = "Principiante", audience = "General", goal = "" } = body;
    if (!topic.trim()) return res.status(400).json({ error: "Falta 'topic'" });

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4.1";
    if (!apiKey) return res.status(401).json({ error: "OPENAI_API_KEY no configurada" });

    const system = `Eres un generador de cursos. Devuelve SOLO JSON válido con este esquema:
{
  "id": string, "topic": string, "goal": string, "audience": string, "level": string, "estimatedHours": number,
  "modules": [ { "id": string, "title": string, "summary": string,
    "lessons": [ { "id": string, "title": string, "concept": string, "explainer": string,
      "quiz": [ { "question": string, "options": [string,string,string,string], "answerIndex": 0|1|2|3, "explanation": string } ],
      "flashcards": [ { "front": string, "back": string } ],
      "checklist": [ { "task": string, "done": boolean } ],
      "resources": [ { "label": string, "url": string } ] } ] } ] }`;

    const user = `Tema: ${topic}
Nivel: ${level}
Audiencia: ${audience}
Objetivo: ${goal}
Crea 4 módulos con 3 lecciones cada uno. Responde SOLO JSON.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.7,
        response_format: { type: "json_object" } // fuerza JSON válido
      })
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || "Error OpenAI" });

    const text = data?.choices?.[0]?.message?.content ?? "{}";
    let course = {};
    try { course = JSON.parse(text); }
    catch { return res.status(502).json({ error: "La IA no devolvió JSON válido" }); }

    return res.status(200).json({
      ...course,
      __metrics: { provider: "openai", usage: data?.usage || null }
    });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
