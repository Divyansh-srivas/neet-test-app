
async function check() {
  const htmlRes = await fetch('https://neogravix.in/');
  const html = await htmlRes.text();
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!match) return console.log('No js found');
  const jsRes = await fetch('https://neogravix.in' + match[1]);
  const js = await jsRes.text();
  console.log('Has api.neogravix.in:', js.includes('api.neogravix.in'));
  console.log('Has onrender.com:', js.includes('onrender.com'));
}
check();
