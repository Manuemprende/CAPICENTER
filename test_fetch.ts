
import axios from 'axios';

async function testFetch(url: string, name: string) {
  try {
    const res = await axios.get(url.replace('/edit', '/export').split('?')[0] + '?format=csv&' + url.split('?')[1]);
    console.log(`--- ${name} ---`);
    console.log(res.data.split('\n')[0]);
  } catch (e: any) {
    console.error(`Error fetching ${name}: ${e.message}`);
  }
}

async function run() {
  const sheet1 = '1axSytZtZgoSiSZQ3H6G8Jx8mMG864MN1HAsy2HorqXc';
  const sheet2 = '1hoo9ev1sfYo8k_4Ngl2vtBSksCPyewhAnZS5T8YnaY8';

  console.log('--- SPREADSHEET 1 ---');
  await testFetch(`https://docs.google.com/spreadsheets/d/${sheet1}/edit?gid=934969229`, 'VENTAS_1');
  await testFetch(`https://docs.google.com/spreadsheets/d/${sheet1}/edit?gid=1731322365`, 'CAPI_1');

  console.log('\n--- SPREADSHEET 2 ---');
  await testFetch(`https://docs.google.com/spreadsheets/d/${sheet2}/edit?gid=0`, 'ADMINS_2');
  await testFetch(`https://docs.google.com/spreadsheets/d/${sheet2}/edit?gid=841852057`, 'VENTAS_2');
  await testFetch(`https://docs.google.com/spreadsheets/d/${sheet2}/edit?gid=1264850674`, 'CAPI_2');
}

run();
