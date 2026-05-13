import axios from 'axios';

async function check() {
  const source = { id: '1hoo9ev1sfYo8k_4Ngl2vtBSksCPyewhAnZS5T8YnaY8', gid: '1264850674' };
  const url = `https://docs.google.com/spreadsheets/d/${source.id}/export?format=csv&gid=${source.gid}`;
  const res = await axios.get(url);
  const lines = String(res.data).split(/\r?\n/);
  console.log('--- SHEET DATA (First 10 lines) ---');
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    console.log(lines[i]);
  }
}

check().catch(console.error);
