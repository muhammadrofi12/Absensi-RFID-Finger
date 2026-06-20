import postgres from 'postgres';

async function test() {
  const url = 'postgresql://postgres.svsqieryxdrjvmcdcyta:Muhammadrofi%402004@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres';
  console.log('Testing connection string with postgres.js...');
  const sql = postgres(url, {
    ssl: 'require',
    prepare: false,
  });
  try {
    const res = await sql`SELECT current_user, current_database()`;
    console.log('✅ SUCCESS postgres.js:', JSON.stringify(res));
  } catch (e) {
    console.error('❌ FAIL postgres.js:', e.message);
  } finally {
    await sql.end();
  }
}

test().then(() => process.exit(0));
