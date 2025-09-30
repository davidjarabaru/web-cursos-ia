export default async function handler(req, res) {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { topic, level, audience, goal } = body;

    const system = `Eres un generador de cursos. Devuelve SOLO JSON válido con este esquema:
{
  "id": string,
  "topic": string,
  "goal": string,
  "audience": string,
  "level": string,
  "estimatedHours": number,
  "modules": [
    {
      "id": string,
      "title": string,
      "summary": string,
      "lessons": [
        {
          "id": string,
          "title": string,
          "concept": string,
          "explainer": string,
          "quiz": [ { "question": string, "options": [string,string,string,string], "answerIndex": 0|1|2|3, "explanation": string } ],
          "flashcards": [ { "front": string, "back": string } ],
          "checklist": [ { "task": string, "done": boolean } ],
          "resources": [ { "label": string, "url": string } ]
        }
      ]
    }
  ]
}`;

    const user = `Tema: ${topic}
Nivel: ${level}
Audiencia: ${audience}
Objetivo: ${goal}
Crea 4 módulos con 3 lecciones cada uno. Responde SOLO JSON.`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content ?? "{}";
    let course = {};
    try { course = JSON.parse(text); } catch { throw new Error("La IA no devolvió JSON válido"); }
    const usage = data?.usage || null;
    return res.status(200).json({ ...course, __metrics: { provider: "openai", usage } });
  } catch (err) {
    return res.status(400).json({ error: String(err?.message || err) });
  }
}