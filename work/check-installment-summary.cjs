const startedAt = Date.now();

fetch("http://localhost:3000/api/summary?month=7&year=2026&bank=all", {
  signal: AbortSignal.timeout(15000),
})
  .then(async (response) => {
    const data = await response.json();
    console.log(
      `${response.status} ${Date.now() - startedAt}ms active=${data.installmentSummary?.activeInstallments?.length ?? "?"} monthly=${data.installmentSummary?.monthlyInstallmentTotals?.length ?? "?"} remaining=${data.installmentSummary?.remainingTotal ?? "?"}`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
