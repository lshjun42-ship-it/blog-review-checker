import Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function crawlBlog(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const fullText = $('body').text();
    const title = $('title').text() || $('h1').first().text() || '';
    const topText = fullText.substring(0, 500);
    const imageCount = $('img').length;
    const videoCount = $('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length;
    const charCount = fullText.replace(/\s/g, '').length;
    
    return {
      success: true,
      fullText: fullText,
      title: title,
      topText: topText,
      imageCount: imageCount,
      videoCount: videoCount,
      charCount: charCount
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function detectFTC(text) {
  const ftcKeywords = [
    '소정의 원고료',
    '협찬',
    '체험단',
    '파트너스 활동',
    '광고',
    '제공받아',
    '제공받',
    '소정의 대가',
    '무상으로 제공',
    '업체로부터',
    '제품 또는 서비스를 제공받아'
  ];
  
  const normalizedText = text.replace(/\s+/g, ' ');
  
  for (const keyword of ftcKeywords) {
    const pattern = keyword.split('').join('\\s*');
    const regex = new RegExp(pattern, 'i');
    if (regex.test(normalizedText)) {
      const topText = normalizedText.substring(0, 500);
      const isTop = regex.test(topText);
      return {
        found: true,
        location: isTop ? 'text_top' : 'text_other',
        keyword: keyword
      };
    }
  }
  
  return { found: false, location: 'not_found' };
}

async function analyzeWithAI(crawlData, guidelines) {
  try {
    const prompt = `당신은 블로그 체험단 검수 전문가입니다.
필수 항목은 엄격하게, 권장/유연 항목은 유연하게 판단하세요.

【 가이드라인 】
필수(*):
${guidelines.required.map((r, i) => `${i + 1}. ${r}`).join('\n')}

권장(+):
${guidelines.recommended.map((r, i) => `${i + 1}. ${r}`).join('\n')}

유연(~):
${guidelines.flexible.map((f, i) => `${i + 1}. ${f}`).join('\n')}

【 블로그 정보 】
제목: ${crawlData.title}
글자: ${crawlData.charCount}자
사진: ${crawlData.imageCount}장
영상: ${crawlData.videoCount}개

【 판단 기준 】
- 필수(*): 하나라도 없으면 불통과
- 권장(+): 부족하면 경고 (필수 충족하면 통과 가능)
- 유연(~): 전반적으로 판단

【 응답 (JSON만) 】
{
  "status": "pass/warning/fail",
  "guideline_match": 85,
  "missing_items": ["구체적으로 부족한 것 3개까지"],
  "overall_assessment": "종합 평가"
}`;

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      status: "fail",
      guideline_match: 0,
      missing_items: ["분석 오류"],
      overall_assessment: "AI 분석 실패"
    };
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return {
      status: "fail",
      guideline_match: 0,
      missing_items: ["분석 오류: " + error.message],
      overall_assessment: "AI 분석 실패"
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { urls, guidelines } = req.body;

    if (!urls || urls.length === 0) {
      return res.status(400).json({ error: "URL이 없습니다" });
    }

    if (!guidelines) {
      return res.status(400).json({ error: "가이드라인이 없습니다" });
    }

    const reviews = [];
    const totalUrls = urls.length;

    for (let i = 0; i < totalUrls; i++) {
      const url = urls[i];
      
      console.log(`[${i + 1}/${totalUrls}] 검수 중: ${url}`);
      
      const crawlData = await crawlBlog(url);
      
      if (!crawlData.success) {
        reviews.push({
          url: url,
          status: "fail",
          ftc: { found: false, location: 'not_found' },
          guideline_match: 0,
          missing_items: ["블로그 접근 실패"],
          crawlData: null
        });
        continue;
      }

      const ftc = detectFTC(crawlData.fullText);

      const analysis = await analyzeWithAI(crawlData, guidelines);

      let finalStatus = analysis.status;
      if (!ftc.found && guidelines.required.some(r => r.includes('공정위'))) {
        finalStatus = 'fail';
      }

      reviews.push({
        url: url,
        title: crawlData.title,
        status: finalStatus,
        ftc: ftc,
        guideline_match: analysis.guideline_match,
        missing_items: analysis.missing_items || [],
        overall_assessment: analysis.overall_assessment,
        crawlData: {
          charCount: crawlData.charCount,
          imageCount: crawlData.imageCount,
          videoCount: crawlData.videoCount
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return res.status(200).json({
      reviews: reviews,
      summary: {
        total: reviews.length,
        passed: reviews.filter(r => r.status === 'pass').length,
        warnings: reviews.filter(r => r.status === 'warning').length,
        failed: reviews.filter(r => r.status === 'fail').length
      }
    });
  } catch (error) {
    console.error("Review Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
