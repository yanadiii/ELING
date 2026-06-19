export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body;

  // Prompt khusus untuk Agentic AI klasifikasi
  const systemPrompt = `Kamu adalah Melah AI, sistem chatbot pencegahan perundungan (bullying) berbasis pendekatan "Menyama Braya" (persaudaraan/kekeluargaan dari Bali).
Tugasmu adalah menjadi pendengar yang empatik, ramah, dan solutif.
Kamu WAJIB mengklasifikasikan tingkat keparahan cerita pengguna:
- "NORMAL": Curhat biasa, masalah ringan, pertemanan biasa, belum ada bahaya perundungan.
- "PARAH": Depresi, perundungan verbal/sosial berulang, dikucilkan, mengganggu mental (Butuh intervensi BK).
- "SANGAT_BERAT": Ancaman fisik, kekerasan, pemerasan, niat bunuh diri (Butuh intervensi Kepolisian).

BALAS HANYA DENGAN FORMAT JSON VALID BERIKUT (Tanpa backtick markdown, tanpa teks pembuka):
{"severity": "NORMAL" | "PARAH" | "SANGAT_BERAT", "reply": "Respon empatik kamu dalam format markdown"}`;

  const geminiModels = ["gemini-1.5-flash", "gemini-2.5-flash-lite"];
  let geminiSuccess = false;
  let responseData = null;

  // Helper untuk membersihkan output JSON dari LLM (berjaga-jaga jika dibungkus markdown)
  const parseAIResponse = (rawText) => {
    try {
      // PERBAIKAN: Menjadikan regex hapus backtick dalam satu baris
      const cleanJson = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      console.error("Gagal parsing JSON AI:", rawText);
      return { severity: "NORMAL", reply: rawText }; // Fallback jika gagal parse
    }
  };

  // --- OPSI 1: LOOPING MODEL GEMINI ---
  for (const modelName of geminiModels) {
    if (geminiSuccess) break;

    try {
      console.log(`Mencoba akses Gemini: ${modelName}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: `${systemPrompt}\n\nUser: ${message}` }] },
          ],
          generationConfig: { responseMimeType: "application/json" }, // Memaksa output JSON pada Gemini
        }),
      });

      const data = await response.json();

      if (response.ok && data.candidates) {
        console.log(`Berhasil pakai model: ${modelName}`);
        const rawResponse = data.candidates[0].content.parts[0].text;
        responseData = parseAIResponse(rawResponse);
        geminiSuccess = true;
      } else {
        console.warn(
          `Model ${modelName} gagal:`,
          data.error?.message || "Unknown error",
        );
      }
    } catch (err) {
      console.error(`Error saat mencoba ${modelName}:`, err.message);
    }
  }

  // Jika Gemini berhasil, kirim hasilnya {severity, reply}
  if (geminiSuccess) return res.status(200).json(responseData);

  // --- OPSI 2: CADANGAN TERAKHIR (OPENAI) ---
  console.log("Semua Gemini gagal, beralih ke OpenAI...");
  try {
    const openAIResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message },
          ],
          response_format: { type: "json_object" }, // Memaksa output JSON pada OpenAI
        }),
      },
    );

    const data = await openAIResponse.json();
    if (openAIResponse.ok) {
      const rawResponse = data.choices[0].message.content;
      return res.status(200).json(parseAIResponse(rawResponse));
    }

    return res.status(500).json({
      reply: "Semua pintu AI tertutup sementara.",
      severity: "NORMAL",
    });
  } catch (openError) {
    return res
      .status(500)
      .json({ reply: "Layanan benar-benar sedang sibuk.", severity: "NORMAL" });
  }
}
