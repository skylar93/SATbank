// 간단한 LaTeX 추출 테스트
const testHtml = `<span style=""><span style="">If&nbsp;<span class="mq-math-mode" latex-data="6+x=3"><span class="mq-textarea"><textarea autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" x-palm-disable-ste-all="true" data-cke-editable="1" c></textarea></span><span class="mq-root-block" mathquill-block-id="1"><span mathquill-command-id="9">6</span><span mathquill-command-id="10" class="mq-binary-operator">+</span><var mathquill-command-id="11">x</var><span class="mq-binary-operator" mathquill-command-id="12">=</span><span mathquill-command-id="13">3</span></span></span>&nbsp;,what is the value of <span class="mq-math-mode" latex-data="42+7x"><span class="mq-textarea"><textarea autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" x-palm-disable-ste-all="true" data-cke-editable="1" c></textarea></span><span class="mq-root-block" mathquill-block-id="1"><span mathquill-command-id="14">4</span><span mathquill-command-id="16">2</span><span mathquill-command-id="18" class="mq-binary-operator">+</span><span mathquill-command-id="20">7</span><var mathquill-command-id="22">x</var></span></span>?</span></span>`;

console.log('=== 원본 HTML ===');
console.log(testHtml);

// 새로운 LaTeX 추출 함수
function extractLatexSimple(htmlContent) {
  if (!htmlContent) return htmlContent;

  let processed = htmlContent;

  // Step 1: 전체 mathquill span을 LaTeX로 대체 (가장 바깥쪽부터)
  const latexPattern = /<span[^>]*class="mq-math-mode"[^>]*latex-data="([^"]*)"[^>]*>.*?<\/span>/gis;

  processed = processed.replace(latexPattern, (match, latexData) => {
    console.log(`🔄 Found LaTeX: "${latexData}"`);
    console.log(`🗑️ Removing HTML: "${match.slice(0, 100)}..."`);
    return `$${latexData}$`;
  });

  return processed;
}

console.log('\n=== 변환 결과 ===');
const result = extractLatexSimple(testHtml);
console.log(result);

console.log('\n=== 최종 깔끔한 결과 ===');
console.log(result.replace(/&nbsp;/g, ' '));