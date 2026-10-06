const result = { resolve: { threw: false }, imported: { ok: false } };
try { import.meta.resolve('ws'); } catch { result.resolve.threw = true; }
try { await import('@mathieuc/tradingview'); } catch (error) { result.imported = { ok: true, code: error.code, message: String(error.message) }; }
console.log(JSON.stringify(result));
