try {
  await import('@mathieuc/tradingview');
  console.log(JSON.stringify({ ok: false, reason: 'expected throw' }));
} catch (error) {
  console.log(JSON.stringify({ ok: true, code: error.code, message: String(error.message) }));
}
