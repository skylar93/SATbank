// Add this to any admin page to see cookie details
console.log('=== COOKIE DEBUG ===');
document.cookie.split(';').forEach(cookie => {
  const [name, ...valueParts] = cookie.trim().split('=');
  const value = valueParts.join('=');
  if (name.includes('sb-') || name.includes('supabase')) {
    console.log(`Cookie: ${name}`);
    console.log(`Length: ${value.length}`);
    console.log(`First 50 chars: ${value.substring(0, 50)}...`);
    try {
      const parsed = JSON.parse(value);
      console.log(`Structure:`, Object.keys(parsed));
    } catch (e) {
      console.log('Not JSON format');
    }
  }
});