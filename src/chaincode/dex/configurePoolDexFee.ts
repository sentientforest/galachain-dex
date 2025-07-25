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
import { NotFoundError, UnauthorizedError } from "@gala-chain/api";
import { GalaChainContext, getObjectByKey, putChainObject } from "@gala-chain/chaincode";

import { ConfigurePoolDexFeeDto, ConfigurePoolDexFeeResDto, Pool } from "../../api";
import { fetchDexProtocolFeeConfig, validateTokenOrder } from "./dexUtils";

/**
   * @dev The configurePoolDexFee function updates the protocol fee percentage for a previously exisiting Decentralized exchange pool within the GalaChain ecosystem.
   * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
   * @param dto ConfigurePoolDexFeeDto – A data transfer object containing:
    - Pool identifier – The specific pool where the protocol fee is being updated.
  - fee value – The new protocol fee percentage, ranging from 0 to 1 (0% to 100%).
   * @returns New fee for the pool
   */
export async function configurePoolDexFee(
  ctx: GalaChainContext,
  dto: ConfigurePoolDexFeeDto
): Promise<ConfigurePoolDexFeeResDto> {
  // Verify if calling user is allowed to update this value
  const protocolFeeConfig = await fetchDexProtocolFeeConfig(ctx);
  if (!protocolFeeConfig) {
    throw new NotFoundError(
      "Protocol fee configuration has yet to be defined. Dex fee configuration is not defined."
    );
  } else if (!protocolFeeConfig.authorities.includes(ctx.callingUser)) {
    throw new UnauthorizedError(`CallingUser ${ctx.callingUser} is not authorized to create or update`);
  }

  // Fetch and validate pool
  const [token0, token1] = validateTokenOrder(dto.token0, dto.token1);

  const key = ctx.stub.createCompositeKey(Pool.INDEX_KEY, [token0, token1, dto.fee.toString()]);
  const pool = await getObjectByKey(ctx, Pool, key);

  // Update protocol fee and save pool on chain
  pool.configureProtocolFee(dto.protocolFee);
  await putChainObject(ctx, pool);

  return new ConfigurePoolDexFeeResDto(dto.protocolFee);
}
