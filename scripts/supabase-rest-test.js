const SUPABASE_URL = 'https://yqlodgboglcicrymywww.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbG9kZ2JvZ2xjaWNyeW15d3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDc4OTMsImV4cCI6MjA4NTk4Mzg5M30.XyztN4RVZyPaHmFIKGKnn7OBccQDcbGXy04btQOSRkw';

(async () => {
  try {
    const testProfile = { ci: 'TEST_CI_12345', alumno: 'Prueba Usuario', ingreso: '2026', malla: '2023', carrera: 'Test' };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(testProfile)
    });

    const text = await res.text();
    console.log('HTTP', res.status, res.statusText);
    console.log('Response body:', text);
  } catch (err) {
    console.error('Request error:', err);
  }
})();
