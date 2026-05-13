import axios from 'axios';

async function check() {
  const source = { id: '1hoo9ev1sfYo8k_4Ngl2vtBSksCPyewhAnZS5T8YnaY8', gid: '1264850674' };
  const url = `https://docs.google.com/spreadsheets/d/${source.id}/export?format=csv&gid=${source.gid}`;
  const res = await axios.get(url);
  const lines = String(res.data).split(/\r?\n/);
  console.log('--- SHEET DATA ---');
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    // Replace non-ascii characters to avoid encoding issues in windows print
    console.log(lines[i].replace(/[^\x00-\x7F]/g, ""));
  }
}

check().catch(console.error);
