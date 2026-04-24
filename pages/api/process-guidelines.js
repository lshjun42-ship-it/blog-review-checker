import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { guidelines } = req.body;

    if (!guidelines || guidelines.trim().length === 0) {
      return res.status(400).json({ error: "가이드라인이 비어있습니다" });
    }

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `다음 가이드라인을 JSON 형식으로 필수/권장/유연으로 분류해주세요.

가이드라인:
${guidelines}

응답 형식:
{
  "required": ["필수 항목 1", "필수 항목 2"],
  "recommended": ["권장 항목 1", "권장 항목 2"],
  "flexible": ["유연한 판단 항목 1"]
}

JSON만 응답하세요.`
        }
      ]
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      return res.status(500).json({ error: "가이드라인 분류 실패" });
    }

    const processed = JSON.parse(jsonMatch[0]);
    return res.status(200).json({ processed });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
