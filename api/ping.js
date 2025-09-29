export default async function handler(req, res) {
  return res.status(200).json({ ok: true, message: "pong from vercel", now: new Date().toISOString() });
}