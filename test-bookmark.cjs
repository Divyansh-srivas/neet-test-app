const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.text().includes('bkd for')) {
      console.log('BROWSER_LOG:', msg.text());
    }
  });

  await page.goto('http://localhost:5173');
  
  await page.evaluate(() => {
    localStorage.setItem('ntp_tests', JSON.stringify([{
      id: 'test_123',
      name: 'Mock Test',
      completed: true,
      duration: 3600,
      finalScore: 10,
      maxScore: 20,
      timeTaken: 1800,
      questions: [{id: 'q1', subject: 'physics', question: 'Test Question 1', correct: 'A', options: {A: 'True', B: 'False'}}]
    }]));
    localStorage.setItem('ntp_profile', JSON.stringify({id: 'u1', name: 'Student'}));
  });
  
  await page.reload();
  await page.waitForSelector('text="View Result"');
  await page.click('text="View Result"');
  
  await page.waitForSelector('text="Test Question 1"');
  console.log('Analysis Page Loaded');
  
  // Find the bookmark button inside the question review card
  const bookmarkBtn = await page.locator('button').filter({ has: page.locator('svg.lucide-bookmark') }).first();
  
  console.log('Clicking bookmark button...');
  await bookmarkBtn.click();
  
  await page.waitForTimeout(1000); // Wait for re-render
  
  console.log('Clicking again...');
  await bookmarkBtn.click();
  
  await page.waitForTimeout(1000);
  
  await browser.close();
})();
