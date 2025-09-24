// 개선된 LaTeX 추출 - 중첩 구조 완전 제거
function extractLatexImproved(htmlContent) {
  if (!htmlContent) return htmlContent;

  let processed = htmlContent;

  // Step 1: 균형잡힌 괄호 매칭으로 전체 mathquill 구조 제거
  function findCompleteSpan(text, startIndex) {
    let depth = 0;
    let i = startIndex;

    while (i < text.length) {
      if (text.substring(i, i + 5) === '<span') {
        depth++;
        i += 5;
      } else if (text.substring(i, i + 7) === '</span>') {
        depth--;
        i += 7;
        if (depth === 0) {
          return i;
        }
      } else {
        i++;
      }
    }
    return -1;
  }

  // LaTeX data 추출 및 완전한 span 제거
  const latexRegex = /latex-data="([^"]*)"/g;
  let match;
  let latexData = [];

  // 먼저 모든 latex-data 수집
  while ((match = latexRegex.exec(processed)) !== null) {
    latexData.push({
      latex: match[1],
      index: match.index
    });
  }

  // 역순으로 처리 (인덱스 변경 방지)
  for (let i = latexData.length - 1; i >= 0; i--) {
    const data = latexData[i];

    // latex-data가 포함된 span의 시작점 찾기
    let spanStart = processed.lastIndexOf('<span', data.index);
    if (spanStart === -1) continue;

    // 해당 span이 mq-math-mode인지 확인
    let spanOpenEnd = processed.indexOf('>', spanStart);
    let spanTag = processed.substring(spanStart, spanOpenEnd + 1);

    if (!spanTag.includes('mq-math-mode')) continue;

    // 완전한 span 끝점 찾기
    let spanEnd = findCompleteSpan(processed, spanStart);
    if (spanEnd === -1) continue;

    // 전체 span을 LaTeX로 대체
    let beforeSpan = processed.substring(0, spanStart);
    let afterSpan = processed.substring(spanEnd);

    processed = beforeSpan + `$${data.latex}$` + afterSpan;

    console.log(`🔄 Replaced complete mathquill span with: $${data.latex}$`);
  }

  return processed;
}

// 테스트
const testHtml = `<span style=""><span style="">If&nbsp;<span class="mq-math-mode" latex-data="6+x=3"><span class="mq-textarea"><textarea autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" x-palm-disable-ste-all="true" data-cke-editable="1" c></textarea></span><span class="mq-root-block" mathquill-block-id="1"><span mathquill-command-id="9">6</span><span mathquill-command-id="10" class="mq-binary-operator">+</span><var mathquill-command-id="11">x</var><span class="mq-binary-operator" mathquill-command-id="12">=</span><span mathquill-command-id="13">3</span></span></span>&nbsp;,what is the value of <span class="mq-math-mode" latex-data="42+7x"><span class="mq-textarea"><textarea autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" x-palm-disable-ste-all="true" data-cke-editable="1" c></textarea></span><span class="mq-root-block" mathquill-block-id="1"><span mathquill-command-id="14">4</span><span mathquill-command-id="16">2</span><span mathquill-command-id="18" class="mq-binary-operator">+</span><span mathquill-command-id="20">7</span><var mathquill-command-id="22">x</var></span></span>?</span></span>`;

console.log('=== 개선된 버전 테스트 ===');
const result = extractLatexImproved(testHtml);
console.log('Result:', result.replace(/&nbsp;/g, ' '));