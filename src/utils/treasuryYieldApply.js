/** Figures for the yield Apply confirmation modal (amounts from liquidity buffer + transactions). */
export function computeYieldApplyFigures({ liquidity, productRateDec, currentYieldDec }) {
  const recommendedGbp = Math.round(Math.max(0, Number(liquidity?.eligibleForYield) || 0))
  const monthlyBurn = Number(liquidity?.monthlyBurn) || 0
  const totalCash = Number(liquidity?.totalCash) || 0

  const currentAnnualGbp = Math.round(recommendedGbp * currentYieldDec)
  const newAnnualGbp = Math.round(recommendedGbp * productRateDec)
  const annualGainGbp = newAnnualGbp - currentAnnualGbp

  let bufferMonthsAfter = null
  if (monthlyBurn > 0) {
    const remainingCash = Math.max(0, totalCash - recommendedGbp)
    bufferMonthsAfter = remainingCash / monthlyBurn
  }

  const bufferMonthsBefore = liquidity?.bufferMonths != null && Number.isFinite(liquidity.bufferMonths)
    ? liquidity.bufferMonths
    : null

  const runwayImpactLabel =
    annualGainGbp > 0
      ? 'Unchanged on base runway; bull-case runway can improve slightly once yield accrues on the moved slice.'
      : 'Unchanged — total cash on your import is unchanged.'

  return {
    recommendedGbp,
    currentAnnualGbp,
    newAnnualGbp,
    annualGainGbp,
    bufferMonthsBefore,
    bufferMonthsAfter,
    runwayImpactLabel,
  }
}
