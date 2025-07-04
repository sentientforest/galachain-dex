/*
 * Copyright (c) Gala Games Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ConflictError } from "@gala-chain/api";
import { GalaChainContext } from "@gala-chain/chaincode";
import BigNumber from "bignumber.js";

import {
  Pool,
  StepComputations,
  SwapState,
  TickData,
  computeSwapStep,
  f18,
  nextInitialisedTickWithInSameWord,
  sqrtPriceToTick,
  tickToSqrtPrice
} from "../../api/";
import { fetchOrCreateAndCrossTick } from "./tickData.helper";

/**
 * Processes swap steps through liquidity ticks until the swap is complete or hits price limits.
 *
 * This function implements the core logic for executing token swaps in a concentrated liquidity pool.
 * It iterates through price ticks, computing swap amounts at each step while respecting:
 * - Available liquidity at each tick
 * - Protocol and liquidity provider fees
 * - Price impact and slippage limits
 * - Exact input vs exact output semantics
 *
 * @param ctx - The GalaChain context for blockchain operations
 * @param state - Current swap state including price, liquidity, and remaining amounts
 * @param pool - The liquidity pool being traded against
 * @param sqrtPriceLimit - Maximum price impact allowed (slippage protection)
 * @param exactInput - Whether this is an exact input (true) or exact output (false) swap
 * @param zeroForOne - Swap direction: token0→token1 (true) or token1→token0 (false)
 * @returns Updated swap state after processing all possible steps
 * @throws ConflictError when insufficient liquidity is available
 */
export async function processSwapSteps(
  ctx: GalaChainContext,
  state: SwapState,
  pool: Pool,
  sqrtPriceLimit: BigNumber,
  exactInput: boolean,
  zeroForOne: boolean
): Promise<SwapState> {
  while (
    // Continue while there's amount left to swap and price hasn't hit the limit
    !f18(state.amountSpecifiedRemaining).isEqualTo(0) &&
    !state.sqrtPrice.isEqualTo(sqrtPriceLimit)
  ) {
    // Initialize step state
    const step: StepComputations = {
      sqrtPriceStart: state.sqrtPrice,
      tickNext: 0,
      sqrtPriceNext: new BigNumber(0),
      initialised: false,
      amountOut: new BigNumber(0),
      amountIn: new BigNumber(0),
      feeAmount: new BigNumber(0)
    };

    // Find the next initialized tick and whether it's initialized
    [step.tickNext, step.initialised] = nextInitialisedTickWithInSameWord(
      pool.bitmap,
      state.tick,
      pool.tickSpacing,
      zeroForOne,
      state.sqrtPrice
    );

    // Reject if next tick is out of bounds
    if (step.tickNext < TickData.MIN_TICK || step.tickNext > TickData.MAX_TICK) {
      throw new ConflictError("Not enough liquidity available in pool");
    }

    // Compute the sqrt price for the next tick
    step.sqrtPriceNext = tickToSqrtPrice(step.tickNext);

    // Compute the result of the swap step based on price movement
    [state.sqrtPrice, step.amountIn, step.amountOut, step.feeAmount] = computeSwapStep(
      state.sqrtPrice,
      (
        zeroForOne
          ? step.sqrtPriceNext.isLessThan(sqrtPriceLimit)
          : step.sqrtPriceNext.isGreaterThan(sqrtPriceLimit)
      )
        ? sqrtPriceLimit
        : step.sqrtPriceNext,
      state.liquidity,
      state.amountSpecifiedRemaining,
      pool.fee
    );

    // Adjust remaining and calculated amounts depending on exact input/output
    if (exactInput) {
      state.amountSpecifiedRemaining = state.amountSpecifiedRemaining.minus(
        step.amountIn.plus(step.feeAmount)
      );
      state.amountCalculated = state.amountCalculated.minus(step.amountOut);
    } else {
      state.amountSpecifiedRemaining = state.amountSpecifiedRemaining.plus(step.amountOut);
      state.amountCalculated = state.amountCalculated.plus(step.amountIn.plus(step.feeAmount));
    }

    // Apply protocol fee if it's enabled
    if (pool.protocolFees > 0) {
      const delta = step.feeAmount.multipliedBy(new BigNumber(pool.protocolFees));
      step.feeAmount = step.feeAmount.minus(delta);
      state.protocolFee = state.protocolFee.plus(delta);
    }

    // Update the global fee growth accumulator
    if (state.liquidity.isGreaterThan(0)) {
      state.feeGrowthGlobalX = state.feeGrowthGlobalX.plus(step.feeAmount.dividedBy(state.liquidity));
    }

    // Check if we crossed into the next tick
    if (state.sqrtPrice.isEqualTo(step.sqrtPriceNext)) {
      // Handle liquidity change at the tick if initialized
      if (step.initialised) {
        let liquidityNet = await fetchOrCreateAndCrossTick(
          ctx,
          pool.genPoolHash(),
          step.tickNext,
          zeroForOne ? state.feeGrowthGlobalX : pool.feeGrowthGlobal0,
          zeroForOne ? pool.feeGrowthGlobal1 : state.feeGrowthGlobalX
        );
        if (zeroForOne) {
          liquidityNet = liquidityNet.times(-1); // Negate if zeroForOne
        }
        state.liquidity = state.liquidity.plus(liquidityNet); // Update liquidity
      }
      // Move the tick pointer
      state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext;
    } else if (!state.sqrtPrice.isEqualTo(step.sqrtPriceStart)) {
      // Update tick based on new sqrtPrice
      state.tick = sqrtPriceToTick(state.sqrtPrice);
    }
  }

  return state;
}
