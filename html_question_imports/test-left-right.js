function cleanLeftRightBrackets(latex) {
  if (!latex || typeof latex !== 'string') return latex;

  return latex
    // Remove \left and \right with their corresponding brackets
    .replace(/\\left\s*\(/g, '(')
    .replace(/\\right\s*\)/g, ')')
    .replace(/\\left\s*\[/g, '[')
    .replace(/\\right\s*\]/g, ']')
    .replace(/\\left\s*\{/g, '{')
    .replace(/\\right\s*\}/g, '}')
    .replace(/\\left\s*\|/g, '|')
    .replace(/\\right\s*\|/g, '|')
    // Handle any remaining \left \right pairs
    .replace(/\\left\s*/g, '')
    .replace(/\\right\s*/g, '');
}

const test1 = '$x^5\\left(7x-2\\right)$';
const test2 = '$x^4\\left(7x^2−2x+9\\right)$ ​​​​​​​';
const test3 = '$9x^4\\left(7x^2−2x+1\\right)$';

console.log('Test 1:');
console.log('Before:', test1);
console.log('After: ', cleanLeftRightBrackets(test1));

console.log('\nTest 2:');
console.log('Before:', test2);
console.log('After: ', cleanLeftRightBrackets(test2));

console.log('\nTest 3:');
console.log('Before:', test3);
console.log('After: ', cleanLeftRightBrackets(test3));