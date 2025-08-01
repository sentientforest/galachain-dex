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
import { TokenInstanceKey, ValidationFailedError } from "@gala-chain/api";
import {
  GalaChainContext,
  fetchTokenClass,
  getObjectsByPartialCompositeKeyWithPagination
} from "@gala-chain/chaincode";

import {
  DexPositionData,
  DexPositionOwner,
  GetUserPositionsDto,
  GetUserPositionsResDto,
  IPosition
} from "../../api/";
import { genBookMark, parseTickRange, splitBookmark } from "./dexUtils";
import { getDexPosition } from "./position.helper";

/**
   * 
   * @dev The getUserPositions function retrieves all liquidity positions owned by a specific user across multiple Decentralized exchange pools within the GalaChain ecosystem. It provides details on the user's staked liquidity and associated rewards.
   * @param ctx GalaChainContext – The execution context providing access to the GalaChain environment.
   * @param dto GetUserPositionsDto – A data transfer object containing:
    - User address – The identifier for the user whose positions are being queried.
   * @returns GetUserPositionsResDto
   */
export async function getUserPositions(
  ctx: GalaChainContext,
  dto: GetUserPositionsDto
): Promise<GetUserPositionsResDto> {
  const { chainBookmark, localBookmark } = splitBookmark(dto.bookmark); // Split global and local bookmark

  let currentPageBookmark = chainBookmark;
  let positionsToSkip = Number(localBookmark); // Track how many positions to skip from current page
  let positionsRequired = dto.limit; // Total number of positions needed
  let newLocalBookmark = positionsToSkip + positionsRequired;
  let isLastIteration = false;
  const userPositions: DexPositionData[] = [];

  do {
    // Fetch user position ownership data with pagination
    const userPositionInfo = await getObjectsByPartialCompositeKeyWithPagination(
      ctx,
      DexPositionOwner.INDEX_KEY,
      [dto.user],
      DexPositionOwner,
      currentPageBookmark,
      10
    );
    newLocalBookmark = positionsToSkip + positionsRequired;

    // Flatten position ownership data into a list of pool/tick/position triplets
    const positionInfoList = userPositionInfo.results.flatMap((owner) =>
      Object.entries(owner.tickRangeMap).flatMap(([tickRange, positionIds]) =>
        positionIds.map((positionId) => ({
          poolHash: owner.poolHash,
          tickRange,
          positionId
        }))
      )
    );

    if (positionInfoList.length === 0) {
      if (userPositionInfo.metadata.bookmark) {
        // Skip empty user position objects
        currentPageBookmark = userPositionInfo.metadata.bookmark;
        continue;
      }
      // Return early if user has no positions
      isLastIteration = true;
      currentPageBookmark = "";
      break;
    }

    // If the number of skipped positions exceeds current page, move to next page
    if (positionsToSkip >= positionInfoList.length) {
      positionsToSkip -= positionInfoList.length;
      currentPageBookmark = userPositionInfo.metadata.bookmark ?? "";
      continue;
    }

    // Slice off positions that were present in the last page and start fetching the rest
    const selectedPositionId = positionInfoList.slice(positionsToSkip);
    positionsToSkip = 0;

    // Fetch position data for each selected position
    for (const [positionInfoIndex, positionInfo] of selectedPositionId.entries()) {
      const { tickLower, tickUpper } = parseTickRange(positionInfo.tickRange);
      const position = await getDexPosition(
        ctx,
        positionInfo.poolHash,
        tickUpper,
        tickLower,
        positionInfo.positionId
      );
      userPositions.push(position);
      positionsRequired--;
      isLastIteration = positionInfoIndex === selectedPositionId.length - 1;
      if (positionsRequired === 0) break;
    }

    // Only update bookmark if the last position on this page was processed
    currentPageBookmark = isLastIteration ? (userPositionInfo.metadata.bookmark ?? "") : currentPageBookmark;
  } while (positionsRequired && currentPageBookmark); // Repeat while more positions are needed and more pages exist

  // If we still have positions to skip but ran out of data, the bookmark was invalid
  if (positionsToSkip) {
    throw new ValidationFailedError("Invalid bookmark");
  }

  // Generate new bookmark for pagination
  const newBookmark =
    !currentPageBookmark && isLastIteration
      ? ""
      : genBookMark(currentPageBookmark, isLastIteration ? "" : newLocalBookmark.toString());

  // Add token metadata to response
  const userPositionWithMetadata = await addMetaDataToUserPositions(ctx, userPositions);

  return new GetUserPositionsResDto(userPositionWithMetadata, newBookmark);
}

/**
 * Adds token metadata (image, symbol, etc.) to each user position.
 */
async function addMetaDataToUserPositions(
  ctx: GalaChainContext,
  positions: DexPositionData[]
): Promise<IPosition[]> {
  const userPositionWithMetadata: IPosition[] = [];
  for (const position of positions) {
    // Construct keys to fetch token metadata
    const token0Key = TokenInstanceKey.fungibleKey(position.token0ClassKey);
    const token1Key = TokenInstanceKey.fungibleKey(position.token1ClassKey);

    // Fetch token metadata from chain
    const token0Class = await fetchTokenClass(ctx, token0Key);
    const token1Class = await fetchTokenClass(ctx, token1Key);

    // Add metadata fields to position object
    userPositionWithMetadata.push({
      poolHash: position.poolHash,
      tickUpper: position.tickUpper,
      tickLower: position.tickLower,
      liquidity: position.liquidity.toFixed(),
      positionId: position.positionId,
      token0Img: token0Class.image,
      token1Img: token1Class.image,
      token0ClassKey: position.token0ClassKey,
      token1ClassKey: position.token1ClassKey,
      fee: position.fee,
      token0Symbol: token0Class.symbol,
      token1Symbol: token1Class.symbol
    });
  }
  return userPositionWithMetadata;
}
