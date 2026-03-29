export default async function handler(req, res) {
  // Hanya izinkan metode POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Anda adalah asisten ELING (Engage, Learn, Internalize, Navigate, Grow) untuk remaja Bali. Tugas: 1. Edukasi reproduksi reflektif. 2. Dekonstruksi habitus 'Sing Beling Sing Nganten'. 3. Jelaskan risiko medis & sosial secara suportif dan tidak menghakimi. Gunakan gaya bahasa remaja yang sopan.",
          },
          { role: "user", content: message },
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Gagal terhubung ke OpenAI" });
  }
}
